/**
 * Module for Express HTTP Server.
 *
 * @module:		server
 * @file		server.js
 * @version:	1.0.0
 * @author		Alain Saffray
 * @link        http://greymattertechs.com
 * @copyright:	Copyright (c) 2017, GreyMatterTechs.com. All rights reserved.
 */

'use strict';

// ------------------------------------------------------------------------------------------------------
// globals
// ------------------------------------------------------------------------------------------------------

global.reqlocal = require('app-root-path').require;

// ------------------------------------------------------------------------------------------------------
// includes
// ------------------------------------------------------------------------------------------------------

const path			= require('path');
const appRoot		= require('app-root-path');
const loopback		= require('loopback');
const boot			= require('loopback-boot');
const bodyParser	= require('body-parser');
const helmet		= require('helmet');
const config		= reqlocal(path.join('server', 'config' + (process.env.NODE_ENV === undefined ? '' : ('.' + process.env.NODE_ENV)) + '.js'));
const logger		= reqlocal(path.join('server', 'boot', 'winston.js')).logger;

// ------------------------------------------------------------------------------------------------------
// Local Vars
// ------------------------------------------------------------------------------------------------------

var app = module.exports = loopback();

// ------------------------------------------------------------------------------------------------------
// Main program
// ------------------------------------------------------------------------------------------------------

// configure view handler
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Setting up loopback
app.use(loopback.static(path.resolve(__dirname, '../client')));
app.use(loopback.token());

// a bit of security
app.use(helmet());
app.set('trust proxy', 'loopback');

var port = normalizePort(process.env.PORT || config.port);
app.set('port', port);

app.start = function(httpOnly) {
	// start the web server
	return app.listen(function() {
		app.emit('started');
		var baseUrl = app.get('url').replace(/\/$/, '');
		logger.info('Web server listening at: ' + baseUrl);
		logger.info('Running Environment: ' + config.currentEnv);
		logger.info('NodeJS server URL: ' + 'http://' + config.host + ':' + port);
		logger.info('Nginx  server URL: ' + 'http://' + config.nginxhost + ':' + config.nginxport);

		if (app.get('loopback-component-explorer')) {
			var explorerPath = app.get('loopback-component-explorer').mountPath;
			logger.info('Browse your REST API at ' + baseUrl + explorerPath);
		}
	});
};

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function(err) {
	if (err) throw err;

	// start the server if `$ node server.js`
	if (require.main === module)
		app.start();
});

// Normalize a port into a number, string, or false.
function normalizePort(val) {
	var port = parseInt(val, 10);
	if (isNaN(port)) { return val; }
	if (port >= 0) { return port; }
	return false;
}
