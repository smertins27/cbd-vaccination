const os = require('os')
const dns = require('dns').promises
const { program: optionparser } = require('commander')
const { Kafka } = require('kafkajs')
const mysqlx = require('@mysql/xdevapi');
const MemcachePlus = require('memcache-plus');
const express = require('express')
const path = require('path')

const app = express();
const cacheTimeSecs = 15

/* ########################################################################## */
/* ########################### COMMANDLINE CONFIG ########################### */
/* ########################################################################## */

let options = optionparser
	.storeOptionsAsProperties(true)
	// Web server
	.option('--port <port>', "Web server port", 3000)
	// Kafka options
	.option('--kafka-broker <host:port>', "Kafka bootstrap host:port", "my-cluster-kafka-bootstrap:9092")
	.option('--kafka-topic-tracking <topic>', "Kafka topic to tracking data send to", "tracking-data")
	.option('--kafka-client-id < id > ', "Kafka client ID", "tracker-" + Math.floor(Math.random() * 100000))
	// Memcached options
	.option('--memcached-hostname <hostname>', 'Memcached hostname (may resolve to multiple IPs)', 'my-memcached-service')
	.option('--memcached-port <port>', 'Memcached port', 11211)
	.option('--memcached-update-interval <ms>', 'Interval to query DNS for memcached IPs', 5000)
	// Database options
	.option('--mysql-host <host>', 'MySQL host', 'my-app-mysql-service')
	.option('--mysql-port <port>', 'MySQL port', 33060)
	.option('--mysql-schema <db>', 'MySQL Schema/database', 'vaccination')
	.option('--mysql-username <username>', 'MySQL username', 'root')
	.option('--mysql-password <password>', 'MySQL password', 'mysecretpw')
	// Misc
	.addHelpCommand()
	.parse()
	.opts()

/* -------------------------------------------------------------------------- */


/* ########################################################################## */
/* ############################ DATABASE CONFIG ############################# */
/* ########################################################################## */

const dbConfig = {
	host: options.mysqlHost,
	port: options.mysqlPort,
	user: options.mysqlUsername,
	password: options.mysqlPassword,
	schema: options.mysqlSchema
};

async function executeQuery(query, data) {
	let session = await mysqlx.getSession(dbConfig);
	return await session.sql(query, data).bind(data).execute()
}

/* -------------------------------------------------------------------------- */


/* ########################################################################## */
/* ########################### MEMCACHED CONFIG ############################# */
/* ########################################################################## */

let memcached = null
let memcachedServers = []

async function getMemcachedServersFromDns() {
	try {
		// Query all IP addresses for this hostname
		let queryResult = await dns.lookup(options.memcachedHostname, { all: true })

		// Create IP:Port mappings
		let servers = queryResult.map(el => el.address + ":" + options.memcachedPort)

		// Check if the list of servers has changed
		// and only create a new object if the server list has changed
		if (memcachedServers.sort().toString() !== servers.sort().toString()) {
			console.log("Updated memcached server list to ", servers)
			memcachedServers = servers

			//Disconnect an existing client
			if (memcached)
				await memcached.disconnect()

			memcached = new MemcachePlus(memcachedServers);
		}
	} catch (e) {
		console.log("Unable to get memcache servers", e)
	}
}

//Initially try to connect to the memcached servers, then each 5s update the list
getMemcachedServersFromDns().then();
setInterval(() => getMemcachedServersFromDns(), options.memcachedUpdateInterval)

//Get data from cache if a cache exists yet
async function getFromCache(key) {
	if (!memcached) {
		console.log(`No memcached instance available, memcachedServers = ${memcachedServers}`)
		return null;
	}
	return await memcached.get(key);
}

/* -------------------------------------------------------------------------- */


/* ########################################################################## */
/* ############################## KAFKA CONFIG ############################## */
/* ########################################################################## */

// Kafka connection
const kafka = new Kafka({
	clientId: options.kafkaClientId,
	brokers: [options.kafkaBroker],
	retry: {
		retries: 0
	}
})

const producer = kafka.producer()
// End

// Send tracking message to Kafka
async function sendTrackingMessage(data) {
	//Ensure the producer is connected
	await producer.connect()

	//Send message
	await producer.send({
		topic: options.kafkaTopicTracking,
		messages: [
			{ value: JSON.stringify(data) }
		]
	})
}

/* -------------------------------------------------------------------------- */


/* ########################################################################## */
/* ############################# APP ENDPOINTS ############################## */
/* ########################################################################## */

// Return HTML for start page
app.get('/', (req, res) => {
	const topX = 10;
	Promise.all([getStates(), getVaccines()]).then(values => {
		const states = values[0];
		const vaccines = values[1];
		const parameters = {
			states: states.result,
			vaccines: vaccines.result,
			pageInfo: { hostname: os.hostname(), date: new Date(), memcachedServers, cachedState: states.cached}
		}
		res.render(path.join(__dirname, 'public/overview/overview.html'), parameters);
	}).catch(e => {// Catch error to prevent server crash
		console.error(e);
	});
})

// Return HTML for state page
app.get('/state/:iso', function(req, res){
	let isoCode = req.params.iso.toUpperCase();

	Promise.all([getState(isoCode)]).then(values => {
		const state = values[0];

		const parameters = {
			state,
			pageInfo: { hostname: os.hostname(), date: new Date(), memcachedServers, cachedState: state.cached}
		}
		console.log(state);
		res.render(path.join(__dirname, 'public/state/state.html'), parameters);

	}).catch(e => { // Catch error to prevent server crash
		console.error(e);
	});
});

/* -------------------------------------------------------------------------- */


/* ########################################################################## */
/* ########################### DATA FROM CACHE/DB ########################### */
/* ########################################################################## */

/**
 * Method for getting all states from database or memcached
 * @return {Promise<{result: *, cached: boolean}|{result: *, cached: boolean}>}
 */
async function getStates(){
	const key = 'states';
	let cacheData = await getFromCache(key);

	if (cacheData){
		cacheHit(key, cacheData);
		return { result: cacheData, cached: true }
	}else{
		cacheMiss(key);
		let executeResult = await executeQuery("SELECT iso, name FROM states", [])
		let data = executeResult.fetchAll()
		if (data) {
			console.log(`Got result=${data}, storing in cache`)
			let result = data.map(row => ({iso: row[0], name: row[1]}));
			if (memcached)
				await memcached.set(key, result, cacheTimeSecs);
			return { result, cached: false }
		} else {
			throw "No states data found"
		}
	}
}

/**
 * Method for getting all available vaccines from database or memcached
 * @return {Promise<{result: *, cached: boolean}|{result: *, cached: boolean}>}
 */
async function getVaccines(){
	const key = 'vaccines';
	let cacheData = await getFromCache(key);

	if (cacheData){
		cacheHit(key, cacheData);
		return { result: cacheData, cached: true }
	}else{
		cacheMiss(key);
		let executeResult = await executeQuery("SELECT code, name FROM vaccines", [])
		let data = executeResult.fetchAll()
		if (data) {
			console.log(`Got result=${data}, storing in cache`)
			let result = data.map(row => ({code: row[0], name: row[1]}));
			if (memcached)
				await memcached.set(key, result, cacheTimeSecs);
			return { result, cached: false }
		} else {
			throw "No vaccines data found"
		}
	}
}

/**
 * Method for getting a specific state from database or memcached
 * @param key String of the iso code
 * @return {Promise<{iso: *, cached: boolean, name: *, population: *}|{cached: boolean}>}
 */
async function getState(key) {
	const query = 'SELECT iso, name, population FROM states WHERE iso = ?';
	let cacheData = await getFromCache(key);

	if(cacheData){
		cacheHit(key, cacheData);
		return { ...cacheData, cached: true };
	}else{
		cacheMiss(key);
		let data = (await executeQuery(query, [key])).fetchOne();
		if (data) {
			let result = { iso: data[0], name: data[1], population: data[2] }
			console.log(`Got result=${data}, storing in cache`);
			if (memcached)
				await memcached.set(key, result, cacheTimeSecs);

			return { ...result, cached: false }
		} else {
			throw "No data found for this state"
		}
	}
}

/* -------------------------------------------------------------------------- */


/* ########################################################################## */
/* ############################ HELPER FUNCTIONS ############################ */
/* ########################################################################## */

/**
 * Helper function to dump a cache hit on the console
 * @param key String of the cache key
 * @param data Any
 */
function cacheHit(key, data){
	console.log(`Cache hit for key=${key}, cachedata = ${JSON.stringify(data)}`)
}

/**
 * Helper function for dump a cache miss on the console
 * @param key String of the missed key
 */
function cacheMiss(key) {
	console.log(`Cache miss for key=${key}, querying database`);
}

/* -------------------------------------------------------------------------- */


/* ########################################################################## */
/* ########################### EXPRESS APP CONFIG ########################### */
/* ########################################################################## */

// The app uses Embedded JavaScript templates as template engine to provide a cleaner project structure
// It serves the html files out of the /public dir
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

// Serve the file from public dir
app.use('/public', express.static(`${__dirname}/public`));

app.listen(options.port, function () {
	console.log("Node app is running at http://localhost:" + options.port)
});

/* -------------------------------------------------------------------------- */


/* ########################################################################## */
/* ############################# DEVELOP DUMP ############################### */
/* ########################################################################## */

/*app.get("/missions/:mission", (req, res) => {
	let mission = req.params["mission"]

	// Send the tracking message to Kafka
	sendTrackingMessage({
		mission,
		timestamp: Math.floor(new Date() / 1000)
	}).then(() => console.log("Sent to kafka"))
		.catch(e => console.log("Error sending to kafka", e))

	// Send reply to browser
	getMission(mission).then(data => {
		sendResponse(res, `<h1>${data.mission}</h1><p>${data.heading}</p>` +
			data.description.split("\n").map(p => `<p>${p}</p>`).join("\n"),
			data.cached
		)
	}).catch(err => {
		sendResponse(res, `<h1>Error</h1><p>${err}</p>`, false)
	})
});*/
