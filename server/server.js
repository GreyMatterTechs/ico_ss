'use strict';
global.reqlocal = require('app-root-path').require;

const path			= require('path');
const appRoot		= require('app-root-path');
const loopback		= require('loopback');
const boot			= require('loopback-boot');
const bodyParser	= require('body-parser');
const helmet		= require('helmet');
const config	= reqlocal(path.join('server', 'config' + (process.env.NODE_ENV === undefined ? '' : ('.' + process.env.NODE_ENV)) + '.json'));
const logger	= reqlocal(path.join('server', 'boot', 'winston.js')).logger;

var app = module.exports = loopback();

// configure view handler
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// format json responses for easier viewing
app.set('json spaces', 2); 

// configure body parser
//app.use(bodyParser.urlencoded({extended: true}));

// Setting up loopback
app.use(loopback.static(path.resolve(__dirname, '../client')));
app.use(loopback.token());

// a bit of security
app.use(helmet());
app.set('trust proxy', 'loopback');

// $$$ TODO https://github.com/strongloop/loopback-example-ssl
//          et passer en TLS

app.start = function(httpOnly) {
  // start the web server
  return app.listen(function() {
    app.emit('started');
    var baseUrl = app.get('url').replace(/\/$/, '');
    console.log('Web server listening at: %s', baseUrl);
	console.log('Running Environment: ' + config.currentEnv);
	console.log('NodeJS server URL: ' + 'http://' + config.host + ':' + config.port);
	console.log('Nginx  server URL: ' + 'http://' + config.nginxhost + ':' + config.nginxport);

    if (app.get('loopback-component-explorer')) {
      var explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
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
