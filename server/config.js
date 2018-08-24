'use strict';

module.exports = {
	restApiRoot: '/api',
	remoting: {
		context: false,
		rest: {
			handleErrors: false,
			normalizeHttpPath: false,
			xml: false
		},
		json: {
			strict: false,
			limit: '100kb'
		},
		urlencoded: {
			extended: true,
			limit: '100kb'
		},
		cors: false
	},
	legacyExplorer: false,
	currentEnv: process.env.NODE_ENV || 'development',
	host: process.env.LB_HOST,
	port: process.env.LB_PORT,
	nginxhost: process.env.NGINX_HOST,
	nginxport: process.env.NGINX_PORT,
	appName: 'ico_ss',
	webURI: process.env.WEB_URI,
	webUser: process.env.WEB_USER,
	webPass: process.env.WEB_PASS,
	cmcURI: process.env.CMC_URI,
	trackIP: true,
	logger2console: true,
	web3Provider: process.env.WEB3_PROVIDER
};
