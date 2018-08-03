'use strict';

var path		= require('path');
var requestIp	= require('request-ip');
var geoip		= require('geoip-lite');
var config		= require( path.join(__dirname, '../../server/config' + (process.env.NODE_ENV!=='development' ? ('.'+process.env.NODE_ENV) : '') + '.json') );


function isString(val) {
	return typeof val === 'string' || ((!!val && typeof val === 'object') && Object.prototype.toString.call(val) === '[object String]');
}

function shorten(str, len) {
	if (isString(str)) {
		len = (typeof len === 'number') ? len : 5;
		if (str.length > len) {
			var deb = str.substring(0,len);
			return deb + '\u2026';
		}
		return str;
	} else {
		return str;
	}
}


function shorten2(str, len) {
	if (isString(str)) {
		len = (typeof len !== 'undefined') ? len : 5;
		var deb = str.substring(0,len);
		var end = str.slice(-len);
		return deb + '\u2026' + end;
	} else {
		return str;
	}
}

module.exports = function(server) {

	server.locals.env = process.env.NODE_ENV; 
	server.locals.db = server.dataSources.db.settings.host ? server.dataSources.db.settings.host : server.dataSources.db.settings.file;
	
	var router	= server.loopback.Router();
	
	// ------------------------------------------------
	// Add Expires header to /images and /stylesheets directories
	// ------------------------------------------------

	router.get('/*', function (req, res, next) {
		var ip = requestIp.getClientIp(req);
		var geo = geoip.lookup(ip);
		if (geo) {
			console.log(config.appName + ' received request: '+shorten(req.url,64)+' from : '+ip+' ('+geo.city+' '+geo.zip+' '+geo.region+' '+geo.country+')' );
		} else {
			console.log(config.appName + ' received request: '+shorten(req.url,64)+' from : '+ip+' (geolocalisation failed)' );
		}
		if (req.url.indexOf('/img/') === 0 || req.url.indexOf('/css/') === 0) {
			res.setHeader('Cache-Control', 'public, max-age=2592000');
			res.setHeader('Expires', new Date(Date.now() + 2592000000).toUTCString());
		}

		res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
		res.setHeader('Expires', '0');
		res.setHeader('Pragma', 'no-cache');

		next();
	});

	// ------------------------------------------------
	// Install a `/` route that returns server status
	// ------------------------------------------------
	//router.get('/', server.loopback.status());
	router.get('/', function (req, res) {
		res.render('index', {
			appName: config.appName,
			err: ''
		});
	});
	
	// ------------------------------------------------
	// create and deplay smart contract
	// ------------------------------------------------
	
	router.get('/createSC', function (req, res) {
		var de = require('../commands/detectEthIncome')(server, "detectEthIncome");
		de.BackupParams( (err, result) => {
			if (err) return res.send('Error: '+err);
			var sc = require('../commands/createSC')(server);
			sc.create( (err, tokenInfos) => {
				if (err) return res.send('Error: '+err);
				res.send(tokenInfos);
			});
		});
	});

	// ------------------------------------------------
	// start ethereum send for tests
	// ------------------------------------------------

	router.get('/StartSendEth', function (req, res) {
		var se = require('../commands/testSendEth')(server, "testSendEth");
		se.StartSend( (err, result) => {
			if (err) return res.send('Error: '+err);
			res.send(result);
		});
	});

	// ------------------------------------------------
	// stop ethereum send for tests
	// ------------------------------------------------

	router.get('/StopSendEth', function (req, res) {
		var se = require('../commands/testSendEth')(server, "testSendEth");
		se.StopSend( (err, result) => {
			if (err) return res.send('Error: '+err);
			res.send(result);
		});
	});
	
	// ------------------------------------------------
	// start token send for ethereum received
	// ------------------------------------------------
	
	router.get('/StartTokenSend', function (req, res) {
		var de = require('../commands/detectEthIncome')(server, "detectEthIncome");
		de.StartSendToken( (err, result) => {
			if (err) return res.send('Error: '+err);
			res.send(result);
		});
	});
	
	// ------------------------------------------------
	// stop token send for ethereum received
	// ------------------------------------------------
	
	router.get('/StopTokenSend', function (req, res) {
		var de = require('../commands/detectEthIncome')(server, "detectEthIncome");
		de.StopSendToken( (err, result) => {
			if (err) return res.send('Error: '+err);
			res.send(result);
		});
	});
	
	// ------------------------------------------------
	// Check transaction table with blockchaine and fix
	// ------------------------------------------------
	
	router.get('/CheckAndFix', function (req, res) {
		var de = require('../commands/detectEthIncome')(server, "detectEthIncome");
		de.CheckAndFix( (err, result) => {
			if (err) return res.send('Error: '+err);
			res.send(result);
		});
	});

	// ------------------------------------------------
	// backup params
	// ------------------------------------------------
	
	router.get('/BackupParams', function (req, res) {
		var de = require('../commands/detectEthIncome')(server, "detectEthIncome");
		de.BackupParams( (err, result) => {
			if (err) return res.send('Error: '+err);
			res.send(result);
		});
	});

	// ------------------------------------------------
	// kill smart contract
	// ------------------------------------------------
	
	router.get('/killSC', function (req, res) {
		var sc = require('../commands/KillContract')(server, "KillContract");
		sc.kill( (err, result) => {
			if (err) return res.send('Error: '+err);
			res.send(result);
		});
	});

	server.use(router);
};
