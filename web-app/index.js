const os = require('os')
const dns = require('dns').promises
const { program: optionparser, combineFlagAndOptionalValue } = require('commander')
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
async function sendVaccinationMessage(data) {
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

	Promise.all([getState(isoCode), getVaccinations(), getVaccinationProgress(isoCode)]).then(values => {//
		console.log(values);
		const state = values[0];
		const percentage = values[2];//
		const summedUp = addPercentages(percentage);
		console.log(summedUp);
		/* console.log(id);
		console.log(vaccinescode); */
		const parameters = {
			state,
			percentage,
			summedUp,
			pageInfo: { hostname: os.hostname(), date: new Date(), memcachedServers, cachedState: state.cached}
		}
		res.render(path.join(__dirname, 'public/state/state.html'), parameters);
	}).catch(e => { // Catch error to prevent server crash
		console.error(e);
	});
});


app.use(express.json())
 app.post('/vaccinations', function(req, res){
	const data = req.body;
	res.send(true);
	Promise.all([getPopulationOfState(data.statesiso), checkIfStateWithVaccineIsInDatabase(data.statesiso, data.vaccinescode)]).then(values =>{
		console.log('daten',values)
		const pop = values[0].population;
		const progressId = values[1].progressId;
		const vacId = values[1].vacId;
		data.progressId = parseInt(progressId);
		data.vacId = parseInt(vacId)
		vacAmount = parseInt(data.vac_amount);
		data.vac_amount = vacAmount;
		const per = vacAmount / pop;
		const percent = per.toFixed(6);
		data.percent = parseFloat(percent);
		console.log(data);
		sendVaccinationMessage(data).then(() => console.log("Sent to kafka"))
		.catch(e => console.log("Error sending to kafka", e)) 
	}).catch(e => { // Catch error to prevent server crash
		console.error(e);
	});
		
}) 

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

//Method for getting vaccination_progress from database
async function getVaccinationProgress(vaccination_progress) {
	const query = "SELECT id, percentage, statesiso, vaccinescode FROM vaccination_progress WHERE statesiso = ?";
	let cacheData = await getFromCache(vaccination_progress);
	
	if(cacheData) {
		console.log("Cache hit!");
		cacheHit(vaccination_progress, cacheData);
		return { ...cacheData, cached: true}
	} else {
		cacheMiss(vaccination_progress);
		let data = (await executeQuery(query, [vaccination_progress])).fetchAll();
		if (data) {
			let result = data.map(row => ({id: row[0], percentage: row[1], statesiso: row[2], vaccinescode: row[3]}));
			console.log(`Got result=${data}, storing in cache tom`);
			if (memcached)
				await memcached.set(vaccination_progress, result, cacheTimeSecs);
			return {...result, cached: false}
		} else {
			throw "No data found for this state"
		}
	}
}



async function getPopulationOfState(state){
	const query = 'SELECT iso, population FROM states WHERE iso = ?'
	let cacheData = await getFromCache(state);

	if(cacheData){
		cacheHit(state, cacheData);
		return { ...cacheData, cached: true}
	}else{
		cacheMiss(state);
		let executeResult = await executeQuery(query, [state])
		let data = executeResult.fetchOne();
		if (data) {
			let result = {iso: data[0], population: data[1]}
			console.log(`Got result=${data}, storing in cache`)
			if(memcached)
				await memcached.set(state, result, cacheTimeSecs);
			return { ...result, cached: false}	
		}else {
			throw "No Population of States found"
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

async function checkIfStateWithVaccineIsInDatabase(state, vaccinescode) {
	const key = state.concat(vaccinescode);
	const progressQuery = 'SELECT id FROM vaccination_progress WHERE statesiso = ? AND vaccinescode = ?';
	const query = 'SELECT id FROM vaccinations WHERE statesiso = ? AND vaccinescode = ?';
	let cacheData = await getFromCache(key);
	if(cacheData){
		cacheHit(key, cacheData);
		console.log("DAS WAR MEIN CHACHE HIT!")
		return { ...cacheData, cached: true };
	}else{
		cacheMiss(key);
		let data = (await executeQuery(progressQuery, [state, vaccinescode])).fetchAll();
		let vacData = (await executeQuery(query, [state, vaccinescode])).fetchAll();
		if (data && vacData){
			let result = { progressId: data[0], vacId: vacData[0] }
			console.log(`Got result=${data, vacData}, storing in cache`);
			if (memcached)
				await memcached.set(key, result, cacheTimeSecs);

			return { ...result, cached: false }
		} else {
			throw "No data found for this state"
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

async function getVaccinations() {
	const key = 'vaccinationsFromDb';
	const query = 'SELECT id, vaccinescode, statesiso, vac_amount FROM vaccinations';
	let cacheData = await getFromCache(key);
	console.log(cacheData);
	if (cacheData){
		cacheHit(key, cacheData);
		return{ ...cacheData, cached: true };
	}else{
		cacheMiss(key);
		let executeResult = await executeQuery("SELECT * FROM vaccinations", [])
		let data = executeResult.fetchAll();
		if (data) {
			console.log(`Got result=${data}, storing in cache`);
			let result = data.map(row => ({id: row[0], vaccinescode: row[1], statesiso: row[2], vac_amount: row[3]}));
			if (memcached)
				await memcached.set(key, result, cacheTimeSecs);	
			return {result, cached: false}
		} else{
			throw "No vaccination data found"
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

//Function for adding up every vaccines percentage
function addPercentages(percentage) {
	const percentageLength = Object.keys(percentage).length-2;
	var i = 0;
	var summedUp = 0;
	for(i = 0; i <= percentageLength; i++) {
		summedUp = summedUp + percentage[i].percentage;
	}
	return summedUp;
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
