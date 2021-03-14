const os = require('os')
const dns = require('dns').promises
const { program: optionparser } = require('commander')
const { Kafka } = require('kafkajs')
const mysqlx = require('@mysql/xdevapi');
const MemcachePlus = require('memcache-plus');
const express = require('express')
const path = require('path')

const app = express()
// The app uses Embedded JavaScript templates as template engine to provide a cleaner project structure
// It serves the html files out of the /public dir
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

const cacheTimeSecs = 15

// -------------------------------------------------------
// Command-line options
// -------------------------------------------------------

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

// -------------------------------------------------------
// Database Configuration
// -------------------------------------------------------

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

// -------------------------------------------------------
// Memcache Configuration
// -------------------------------------------------------

//Connect to the memcached instances
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

// -------------------------------------------------------
// Kafka Configuration
// -------------------------------------------------------

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
// End

// -------------------------------------------------------
// Start page
// -------------------------------------------------------

// Get popular missions (from db only)
async function getPopular(maxCount) {
	const query = "SELECT mission, count FROM popular ORDER BY count DESC LIMIT ?"
	return (await executeQuery(query, [maxCount]))
		.fetchAll()
		.map(row => ({ mission: row[0], count: row[1] }))
}

// Return HTML for start page
app.get('/', (req, res) => {
	const topX = 10;
	Promise.all([getStates()]).then(values => {
		const states = values[0];
		const parameters = {
			states: states.result,
			pageInfo: { hostname: os.hostname(), date: new Date(), memcachedServers, cachedState: states.cached}
		}
		res.render(path.join(__dirname, 'public/overview/overview.html'), parameters);
	}).catch(e => {
		console.error(e);
	});
})

app.get('/state/:iso', function(req, res){
	let isoCode = req.params.iso.toUpperCase();

	Promise.all([getState(isoCode)]).then(values => {
		const state = values[0];
		const parameters = {
			state: state.result,
			pageInfo: { hostname: os.hostname(), date: new Date(), memcachedServers, cachedState: state.cached}
		}
		console.log(state);
		res.render(path.join(__dirname, 'public/state/state.html'), parameters);

	}).catch(e => {
		console.error(e);
	});
});


// Get list of states (from cache or db)
async function getStates(){
	const key = 'states';
	let cacheData = await getFromCache(key);

	if (cacheData){
		cacheHit(key, cacheData);
		return { result: cacheData, cached: true }
	}else{
		cacheMiss(key);
		let executeResult = await executeQuery("SELECT iso, name, population FROM states", [])
		let data = executeResult.fetchAll()
		if (data) {
			console.log(`Got result=${data}, storing in cache`)
			let result = data.map(row => ({iso: row[0], name: row[1], population: row[2]}));
			if (memcached)
				await memcached.set(key, result, cacheTimeSecs);
			return { result, cached: false }
		} else {
			throw "No states data found"
		}
	}
}

// Get a specific state by key (from cache or db)
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

function cacheHit(key, data){
	console.log(`Cache hit for key=${key}, cachedata = ${JSON.stringify(data)}`)
}

function cacheMiss(key) {
	console.log(`Cache miss for key=${key}, querying database`);
}

app.get("/missions/:mission", (req, res) => {
	let mission = req.params["mission"]

	// Send the tracking message to Kafka
	/*sendTrackingMessage({
		mission,
		timestamp: Math.floor(new Date() / 1000)
	}).then(() => console.log("Sent to kafka"))
		.catch(e => console.log("Error sending to kafka", e))*/

	// Send reply to browser
	/*getMission(mission).then(data => {
		sendResponse(res, `<h1>${data.mission}</h1><p>${data.heading}</p>` +
			data.description.split("\n").map(p => `<p>${p}</p>`).join("\n"),
			data.cached
		)
	}).catch(err => {
		sendResponse(res, `<h1>Error</h1><p>${err}</p>`, false)
	})*/
});

// Serve the file from public dir
app.use('/public', express.static(`${__dirname}/public`));


// -------------------------------------------------------
// Main method
// -------------------------------------------------------

app.listen(options.port, function () {
	console.log("Node app is running at http://localhost:" + options.port)
});
