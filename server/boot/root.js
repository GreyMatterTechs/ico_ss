'use strict';

module.exports = function(server) {
	// Install a `/` route that returns server status
	var router = server.loopback.Router();
	router.get('/', server.loopback.status());
	// create and deplay smat contract
	router.get('/createSC', function (req, res) {
		var sc = require('../commands/createSC')(server, "createSC");
		sc.create( (err, result) => {
			if (err) return res.send('Error: '+err);
			res.send(result);
		});
	});
	router.get('/StartSendEth', function (req, res) {
		var se = require('../commands/testSendEth')(server, "testSendEth");
		se.StartSend( (err, result) => {
			if (err) return res.send('Error: '+err);
			res.send(result);
		});
	});
	router.get('/StopSendEth', function (req, res) {
		var se = require('../commands/testSendEth')(server, "testSendEth");
		se.StopSend( (err, result) => {
			if (err) return res.send('Error: '+err);
			res.send(result);
		});
	});
	// start token send for ethereum received
	router.get('/SendTokenStart', function (req, res) {
		var de = require('../commands/detectEthIncome')(server, "detectEthIncome");
		de.StartSendToken( (err, result) => {
			if (err) return res.send('Error: '+err);
			res.send(result);
		});
	});
	// stop token send for ethereum received
	router.get('/SendTokenStop', function (req, res) {
		var de = require('../commands/detectEthIncome')(server, "detectEthIncome");
		de.StopSendToken( (err, result) => {
			if (err) return res.send('Error: '+err);
			res.send(result);
		});
	});
	// Check transaction table with blockchaine and fix
	router.get('/CheckAndFix', function (req, res) {
		var de = require('../commands/detectEthIncome')(server, "detectEthIncome");
		de.CheckAndFix( (err, result) => {
			if (err) return res.send('Error: '+err);
			res.send(result);
		});
	});
	server.use(router);
};
