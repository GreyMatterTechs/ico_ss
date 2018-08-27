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
	web3Provider: process.env.WEB3_PROVIDER,
	walletTokenAddress: process.env.WALLET_TOKEN_ADDRESS,
	walletEthereumAddress: process.env.WALLET_ETHEREUM_ADDRESS,
	walletDiscount1Address: process.env.WALLET_DISCOUNT1_ADDRESS,
	walletDiscount2Address: process.env.WALLET_DISCOUNT2_ADRESSE,
	usdEthereumPrice: process.env.USD_ETHEREUM_PRICE,
	usdTokenPrice: process.env.USD_TOKEN_PRICE,
	discount1Factor: process.env.DISCOUNT1_FACTOR,
	discount2Factor: process.env.DISCOUNT2_FACTOR,
	transactionGaz: process.env.TRANSACTION_GAZ,
	gazPrice: process.env.GAZ_PRICE,
	dateIcoStart: process.env.DATE_ICO_START,
	dateIcoEnd: process.env.DATE_ICO_END,
	softCap: process.env.SOFT_CAP,
	hardCap: process.env.HARD_CAP
};
