'use strict';

const path      = require('path');
const appRoot	= require('app-root-path');
const Web3      = require('web3');
const Fs        = require('fs');
const Solc      = require('solc');
const Async		= require("async");
const request   = require('superagent');
const config	= reqlocal(path.join('server', 'config' + (process.env.NODE_ENV === undefined ? '' : ('.' + process.env.NODE_ENV)) + '.json'));
const logger	= reqlocal(path.join('server', 'boot', 'winston.js')).logger;

var mParam;
var mTransaction;

//---------------------------------------------------------------------------
// Class SmartContract
//---------------------------------------------------------------------------

/**
 * Constructor
 *
 * @param {Object} _server The Loopback server
 * @class SmartContract
 * @constructor
 * @public
 */
var SmartContract = function (_server) {
    mParam = _server.models.Param;
    mTransaction = _server.models.Transaction;
};

//---------------------------------------------------------------------------
// private methods
//---------------------------------------------------------------------------

// sleep time expects milliseconds
function sleep (ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Compile our SecureSwapToken solidity source code
 * Create ERC20 contract
 * Deploy (mine) the contract
 *
 * @param {object} param Wallet adress of Token owner
 * @callback {Function} cb A callback which is called when token is created and deployed, or an error occurs. Invoked with (err, tokenInfos).
 * @param {Error} err Error information
 * @param {string} tokenInfos New Token ERC20 infos
 *
 * @class SmartContract
 * @private
 */
async function WalletReceived(param, web3, cb) {
	var tokenInitialOwnerAddress = param.ICOWalletTokenAddress;
	logger.info("Inital token owner is: " + tokenInitialOwnerAddress);

	let source = Fs.readFileSync('server/commands/SecureSwapToken.sol', 'utf8');
	let compiledContract = Solc.compile(source, 1);
	if (compiledContract.errors !== undefined) {
        logger.error("Error or warning during contract compilation: " + JSON.stringify(compiledContract.errors));
		return cb("Error or warning during contract compilation: " + JSON.stringify(compiledContract.errors), null);
	}

	let abi = compiledContract.contracts[':SecureSwapToken'].interface;
	let bytecode = "0x" + compiledContract.contracts[':SecureSwapToken'].bytecode;
	let gasEstimate = web3.eth.estimateGas({ data: bytecode });

	let formatedAbi = JSON.parse(abi);
	logger.info("contract compiled, abi: " + JSON.stringify(formatedAbi) + " gasEstimated: " + gasEstimate + "\n");

	// create ERC20 contract
	let secureswapContract = web3.eth.contract(formatedAbi);

	// deploy the contract
	var secureswapContractInstance = secureswapContract.new(
		{
			from: tokenInitialOwnerAddress,
			data: bytecode,
			gas: gasEstimate
		});

	// we wait for contract be mined
	if (secureswapContractInstance.address === undefined) {
		var transactionReceipt = web3.eth.getTransactionReceipt(secureswapContractInstance.transactionHash);
		while(transactionReceipt === null) {
			await sleep(5000);
			transactionReceipt = web3.eth.getTransactionReceipt(secureswapContractInstance.transactionHash);
		}
		secureswapContractInstance.address = transactionReceipt.contractAddress;
	}

	if (secureswapContractInstance.transactionHash === undefined || secureswapContractInstance.address === undefined) {
		logger.error("Contract not mined, contract transaction hash: " + secureswapContractInstance.transactionHash + " contract address: " + secureswapContractInstance.address);
		return cb("Contract not mined, contract transaction hash: " + secureswapContractInstance.transactionHash + " contract address: " + secureswapContractInstance.address, null);
	}

	logger.info("Contract Mined !, contract transaction hash: " + secureswapContractInstance.transactionHash + " contract address: " + secureswapContractInstance.address);

	var tokenContractInterface = web3.eth.contract(secureswapContractInstance.abi).at(secureswapContractInstance.address);
	var decimal = tokenContractInterface.decimals();
	var balance = tokenContractInterface.balanceOf(tokenInitialOwnerAddress);
	var adjustedBalance = balance.dividedBy(Math.pow(10, decimal)).toNumber();
	var tokenName = tokenContractInterface.name();
	var tokenSymbol = tokenContractInterface.symbol();
	var ethereumPrice = 475;
	var dateIcoStart = new Date("2018-08-09T00:00:00.000Z");
	var dateIcoEnd = new Date("2018-12-31T00:00:00.000Z")

	getCoinMarketCapId("Ethereum", (err, id) => {
		if (id === null || id === -1)
		{
			logger.error("Can't read Ethereum Id on CoinMarketCap, use id 1027 by default");
			id = 1027;
		}

		getCotation(id, (err, cotation) => {
			if (cotation) {
				ethereumPrice = Number(cotation.data.quotes.USD.price);
				logger.info("Ethereum cotation on CoinMarketCap is: " + ethereumPrice);
			}
			else
			{
				logger.error("Can't read Ethereum cotation on CoinMarketCap, use old value: " + ethereumPrice);
			}

			// AS ajouter contract adresse dans la table
			param.updateAttributes( { "TokenContractTransactionHash" : secureswapContractInstance.transactionHash, "TokenContractAddress" : secureswapContractInstance.address, "NbTotalToken": adjustedBalance, "NbTokenToSell": 80000000, 
									"USDTokenPrice": 0.45, "USDEthereumPrice": ethereumPrice, "NbTokenSold": 0.0, "NbEthereum": 0.0, "LastProcessedBlock": transactionReceipt.blockNumber, "BlockTokenStart": transactionReceipt.blockNumber, 
									"NbBlockTransactionConfirmation": 6, "IcoDateStart": dateIcoStart.getTime(), "IcoDateEnd": dateIcoEnd.getTime() }, function (err, instance) {
				if (err) {
					logger.error("Can't update param.attributes for param.id: " + param.id);
					return cb(err, null);
				}
				logger.info("New Token ERC20 infos: TokenName: " + tokenName + " TokenSymbol: " + tokenSymbol + " Decimal: " + decimal.toNumber() + " Token owner balance: " + adjustedBalance + " Token transaction block created: " + transactionReceipt.blockNumber + " TokenContractTransactionHash: " + secureswapContractInstance.transactionHash + " Contract address: " + secureswapContractInstance.address);
				return cb(null, "New Token ERC20 infos: TokenName: " + tokenName + " TokenSymbol: " + tokenSymbol + " Decimal: " + decimal.toNumber() + " Token owner balance: " + adjustedBalance);
			});

			var tokenPriceUSD = web3.toBigNumber(0.45);
			var tokenPriceETH = tokenPriceUSD.dividedBy(ethereumPrice);

			var stateIco = 1;
			if (new Date(dateIcoStart).getTime() < new Date().getTime()) {
				stateIco = 2;
				if (new Date(dateIcoEnd).getTime() < new Date().getTime()) {
					stateIco = 3;
				}
			}

			/**
			 * Send ICO params to website
			 */
			var params = {
				state:			stateIco,
				wallet:			tokenInitialOwnerAddress,
				tokenName:  	"SSW",
				tokenPriceUSD:	tokenPriceUSD.toNumber(),
				tokenPriceETH:	tokenPriceETH.toNumber(),
				softCap:		10000000,
				hardCap:  		80000000,
				tokensTotal:  	100000000,
				ethTotal:   	0,
				tokensSold:  	0,
				dateStart:   	dateIcoStart.getTime(),
				dateEnd:  		dateIcoEnd.getTime()
			}

			sendParams("sswp", "Xv4hmDly", "setParams", params, (err, responseTxt) => {
				if (err) return err;
			});
		});
	});
}

/**
* Get crypto quote on CoinMarketCap, in USD and in EUR
*/
function getCotation(cryptoId, cb) {
	var url = 'https://api.coinmarketcap.com/v2/ticker/' + cryptoId + '/?convert=EUR';
	request
	.get(url)
	.query({convert: 'EUR'})
	.end((err, res) => {
		if (err) return cb(err, null);
		if (res.body && !res.error && res.statusCode===200 && res.text && res.text.length>0) {
			return cb(null, JSON.parse(res.text));
		} else {
			return cb('request() error. url:' + url, null);
		}
	});
}

/**
* Get crypto CoinMarketCap id
*/
function getCoinMarketCapId(cryptoName, cb) {
	var url = 'https://api.coinmarketcap.com/v2/listings/';
	request
	.get(url)
	.end((err, res) => {
		if (err) return cb(err, null);
		if (res.body && !res.error && res.statusCode===200 && res.text && res.text.length>0) {
			var rep = JSON.parse(res.text);
			var id = -1;
			rep.data.forEach(function(element) {
				if (element.name === cryptoName)
				{
					id = Number(element.id);
				}
			});
			return cb(null, id);
		} else {
			return cb('request() error. url:' + url, null);
		}
	});
}

/**
 * Get a valid token
 */
function login(login, pass, cb) {
	const url = 'https://www.secure-swap.com/login';
	request
	.post(url)
	.send({username: login, password: pass})
	.end((err, res) => {
		if (err) return cb(err);
		if (res.body && !res.error && res.statusCode===200) {
			return cb(null, res.body.accessToken);
		} else {
			return cb('request() error. url:' + url, null);
		}
	});
}

/**
 * Send data on public website API
 */
function sendParams(log, pass, api, params, cb) {
	// first : login and get a valid token
	login(log, pass, (err, tokenId) => {
		// second : send data
		const url = 'https://www.secure-swap.com/api/ICOs/' + api;
		request
		.post(url)
		.send({tokenId: tokenId, params: params})
		.end((err, res) => {
			if (err) return cb(err);
			return cb(null, true);
		});
	});
}

/**
 * Public methods
 */

/**
 * Connect to local node,
 * Creates the SecureSwap Smart Contract
 * 
 * @callback {Function} cb A callback which is called when token is created and deployed, or an error occurs. Invoked with (err, tokenInfos).
 * @param {Error} err Error information
 * @param {string} tokenInfos New Token ERC20 infos object
 * 
 * @class SmartContract
 * @public
 */
SmartContract.prototype.create = function (cb) {
	logger.info(config.appName + ': Creating...');
    
  	var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8101"));  
  
	// get parameters from table Param
	mParam.destroyAll(function(err, param) {
		if (err){
			logger.error("Error occurs when cleaning Param table. error: " + JSON.stringify(err));
			return cb("Error occurs when cleaning param table. error: " + JSON.stringify(err), null);
		}
		logger.info("Table Param empty, create default params");
//			mParam.create({ ICOWalletTokenAddress: "0x10b0afcadd2de0cc4e6418d8d234075de0710384", ICOWalletEthereumAddress: "0x21953969bb5a33697502756ca3129566d03b6490", USDEthereumPrice: 600.0, USDTokenPrice: 0.44, TransactionGaz: 150000, GazPice: 6 }, (err, instance) => {
//		mParam.create({ ICOWalletTokenAddress: "0x4e80dd9239327e74ea156ef1caa9e9abcfa179f9", ICOWalletEthereumAddress: "0x4c0af32cd1d1721a6c6f191bc9ba127926467930", ICOWalletDiscount1Address: "0xfdccc6008e99ea09392600ebf72ad7b30c4b73c4", 
//			ICOWalletDiscount2Address: "0x21953969bb5a33697502756ca3129566d03b6490", USDEthereumPrice: 600.0, USDTokenPrice: 0.44, Discount1Factor: 0.9, Discount2Factor: 0.8, TransactionGaz: 128000, GazPice: 42}, (err, instance) => {
		mParam.create({ ICOWalletTokenAddress: "0x082038b1db6e8f3dc36b070fa554f660ebea3c52", ICOWalletEthereumAddress: "0x9682966988b5978929a97f94f06daa2625495169", ICOWalletDiscount1Address: "0xcf84f7d8307a98bcfa5f9d4f7e2f2029e980d05a", 
			ICOWalletDiscount2Address: "0xc8440822b3d0b9a230a7fb3d21c86f1b5ea16fd7", USDEthereumPrice: 350.0, USDTokenPrice: 0.44, Discount1Factor: 0.9, Discount2Factor: 0.8, TransactionGaz: 128000, GazPice: 42}, (err, instance) => {
													
			if (err) {
				logger.error("Error occurs when adding default param in table Param error: " + JSON.stringify(err));
				return cb("Error occurs when adding default param in table Param error: " + JSON.stringify(err), null);
			}
			WalletReceived(instance, web3, cb);
		});
	});
}

/**
 * Connect to local node,
 * Cleanup transactions
 * 
 * @callback {Function} cb A callback which is called when token is created and deployed, or an error occurs. Invoked with (err, tokenInfos).
 * @param {Error} err Error information
 * @param {string} tokenInfos Transaction table clean info
 * 
 * @class SmartContract
 * @public
 */
SmartContract.prototype.cleanTransaction = function (cb) {
	logger.info(config.appName + ': Clean Transaction...');
    
  	var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8101"));  
  
	// delete all transactions in transaction table
	mTransaction.destroyAll(function(err, info) {
		if (err) {
			logger.error("Error occurs when cleaning Transaction table. error: " + JSON.stringify(err));
			return cb("Error occurs when cleaning Transaction table. error: " + JSON.stringify(err), null);
		}
		logger.info(info.count + " were destroyed from Transaction table");	
		return cb(null, info.count + " were destroyed from Transaction table");
	});
}


//---------------------------------------------------------------------------
// Module export
//---------------------------------------------------------------------------

/**
 * Module exports.
 * @public
 * @expose
 */
module.exports = function (_server) {
    return new SmartContract(_server);
}
