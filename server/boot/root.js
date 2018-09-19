'use strict';

const path		= require('path');
const appRoot	= require('app-root-path');
const requestIp	= require('request-ip');
const geoip		= require('geoip-lite');
const config	= reqlocal(path.join('server', 'config' + (process.env.NODE_ENV === undefined ? '' : ('.' + process.env.NODE_ENV)) + '.js'));
const logger	= reqlocal(path.join('server', 'boot', 'winston.js')).logger;

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


function hrtime2human(diff) {
	const num = diff[0] * 1e9 + diff[1];
	if (num < 1e3) {
		return num + ' ns';
	} else if (num >= 1e3 && num < 1e6) {
		return num / 1e3 + ' µs';
	} else if (num >= 1e6 && num < 1e9) {
		return num / 1e6 + ' ms';
	} else if (num >= 1e9) {
		return num / 1e9 + ' s';
	}
};


module.exports = function(server) {

	server.locals.env		= config.currentEnv;
	server.locals.dbMem		= server.dataSources.dbMemory.settings.host ? server.dataSources.dbMemory.settings.host : 'local';
	server.locals.dbSql		= server.dataSources.dbSql.settings.host ? server.dataSources.dbSql.settings.host : 'local';

	var router	= server.loopback.Router();

	// ------------------------------------------------
	// Add Expires header to /images and /stylesheets directories
	// ------------------------------------------------

	router.get('/*', function(req, res, next) {
		if (config.trackIP) {
			const time = process.hrtime();
			const ip = requestIp.getClientIp(req);
			const geo = geoip.lookup(ip);
			const diff = process.hrtime(time);
			if (geo) {
				logger.info('Received request: ' + shorten(req.url, 64) + ' from: ' + ip + ' (' + geo.city + ',' + geo.region + ',' + geo.country + ') [geoip: ' + hrtime2human(diff) + ']');
			} else {
				logger.info('Received request: ' + shorten(req.url, 64) + ' from: ' + ip + ' (machine locale) [geoip: ' + hrtime2human(diff) + ']');
			}
		}
		if (req.url.indexOf('assets/images') >= 0 || req.url.indexOf('assets/css/') >= 0) {
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
	// router.get('/', server.loopback.status());
	router.get('/', function(req, res) {
		res.render('index', {
			appName: config.appName,
			err: ''
		});
	});

	// ------------------------------------------------
	// create and deplay smart contract
	// ------------------------------------------------
	router.get('/createSC', function(req, res) {
		var de = require('../commands/detectEthIncome')(server, "detectEthIncome");
		de.BackupParams((err, result) => {
			if (err) return res.send('Error: '+err);
			var sc = require('../commands/createSC')(server, "createSC");
			sc.create((err, tokenInfos) => {
				if (err) return res.send('Error: '+err);
				res.send(tokenInfos);
			});
		});
	});

	// ------------------------------------------------
	// Clean transaction table
	// ------------------------------------------------
	router.get('/cleanTransaction', function(req, res) {
		var sc = require('../commands/createSC')(server, "cleanTransaction");
		sc.cleanTransaction((err, tokenInfos) => {
			if (err) return res.send('Error: '+err);
			res.send(tokenInfos);
		});
	});

	// ------------------------------------------------
	// Clean param table
	// ------------------------------------------------
	router.get('/cleanParam', function(req, res) {
		var sc = require('../commands/createSC')(server, "cleanParam");
		sc.cleanParam((err, tokenInfos) => {
			if (err) return res.send('Error: '+err);
			res.send(tokenInfos);
		});
	});

	// ------------------------------------------------
	// Resent emited token
	// ------------------------------------------------
	router.get('/ResendEmitedToken', function(req, res) {
		var sc = require('../commands/detectEthIncome')(server, "ResendEmitedToken");
		sc.ResendEmitedToken((err, tokenInfos) => {
			if (err) return res.send('Error: '+err);
			res.send(tokenInfos);
		});
	});

	// ------------------------------------------------
	// start ethereum send for tests
	// ------------------------------------------------
	router.get('/StartSendEth', function(req, res) {
		var se = require('../commands/testSendEth')(server, "testSendEth");
		se.StartSend((err, result) => {
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
		var sc = require('../commands/killContract')(server, "killContract");
		sc.kill( (err, result) => {
			if (err) return res.send('Error: '+err);
			res.send(result);
		});
	});


	// ------------------------------------------------
	// Send tokens to destination wallet
	//
	// example usage :
	// localhost:3000/sendTokens?w=0x54sdff54sdf5g34354g&t=21631
	// ------------------------------------------------
	router.get('/sendTokens', function (req, res) {
		if (!req.query.w || !req.query.t) {
			return res.send('Error: bad params.');
		}
		var command = require('../commands/sendTokens')(server, "sendTokens");
		command.send(req.query.w, +req.query.t, (err, result) => {
			if (err) return res.send('Error: ' + err);
			res.send(result);
		});
	});

	// ------------------------------------------------
	// Send tokens to destination wallet
	//
	// example usage :
	// localhost:3000/sendTokens?w=0x54sdff54sdf5g34354g&t=21631
	// ------------------------------------------------
	router.get('/fixParam', function (req, res) {
		var sc = require('../commands/createSC')(server, "fixParam");
		sc.fixParam( (err, result) => {
			if (err) return res.send('Error: '+err);
			res.send(result);
		});
	});

	server.use(router);
};
