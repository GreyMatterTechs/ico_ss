'use strict';

const path      = require('path');
const appRoot	= require('app-root-path');
const Web3      = require('web3');
const Fs        = require('fs');
const Solc      = require('solc');
const Async		= require("async");
const request   = require('superagent');
const config	= reqlocal(path.join('server', 'config' + (process.env.NODE_ENV === undefined ? '' : ('.' + process.env.NODE_ENV)) + '.js'));
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
async function WalletReceived(param, contractCreactionBlock, web3, cb) {
	var tokenInitialOwnerAddress = param.ICOWalletTokenAddress;
	logger.info("Inital token owner is: " + tokenInitialOwnerAddress);

	let source = Fs.readFileSync(path.join(`${appRoot}`, 'server', 'commands', 'SecureSwapToken.sol'), 'utf8');
	let compiledContract = Solc.compile(source, 1);
	if (compiledContract.errors !== undefined) {
        logger.error("Error or warning during contract compilation: " + JSON.stringify(compiledContract.errors));
		return cb("Error or warning during contract compilation: " + JSON.stringify(compiledContract.errors), null);
	}

	let abi = compiledContract.contracts[':SecureSwapToken'].interface;
	let bytecode = "0x" + compiledContract.contracts[':SecureSwapToken'].bytecode;
	let gasEstimate = "0x" + web3.eth.estimateGas({ data: bytecode });

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
		var dec = web3.toBigNumber(0);
		var bal = web3.toBigNumber(0);
		while(transactionReceipt === null /*|| dec.toNumber() === 0 || bal.toNumber() === 0*/) {
			await sleep(1000);
			transactionReceipt = web3.eth.getTransactionReceipt(secureswapContractInstance.transactionHash);
			if (transactionReceipt !== null) {
				if (transactionReceipt.contractAddress !== undefined) {
					var tci = web3.eth.contract(secureswapContractInstance.abi).at(transactionReceipt.contractAddress);
					dec = tci.decimals();
					bal = tci.balanceOf(tokenInitialOwnerAddress);
				}
			}
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
	var ethereumPrice = config.usdEthereumPrice;
	var dateIcoStart = new Date(config.dateIcoStart);
	var dateIcoEnd = new Date(config.dateIcoEnd);

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

			if (contractCreactionBlock === 0) {
				contractCreactionBlock = transactionReceipt.blockNumber;
			}

			param.updateAttributes( { "TokenContractTransactionHash" : secureswapContractInstance.transactionHash, "TokenContractAddress" : secureswapContractInstance.address, "NbTotalToken": adjustedBalance, "NbTokenToSell": 80000000, 
									"USDTokenPrice": 0.45, "USDEthereumPrice": ethereumPrice, "NbTokenSold": 0.0, "NbEthereum": 0.0, "LastProcessedBlock": transactionReceipt.blockNumber, "BlockTokenStart": contractCreactionBlock, 
									"NbBlockTransactionConfirmation": 6, "IcoDateStart": dateIcoStart.getTime(), "IcoDateEnd": dateIcoEnd.getTime() }, function (err, instance) {
				if (err) {
					logger.error("Can't update param.attributes for param.id: " + param.id + " err:" + err);
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
				state:				stateIco,
				wallet:				"",
				tokenName:  		tokenSymbol,
				tokenPriceUSD:		tokenPriceUSD.toNumber(),
				tokenPriceETH:		tokenPriceETH.toNumber(),
				softCap:			config.softCap,
				hardCap:  			config.hardCap,
				tokensTotal:  		adjustedBalance,
				ethTotal:   		0,
				tokensSold:  		0,
				dateStart:   		dateIcoStart.getTime(),
				dateEnd:  			dateIcoEnd.getTime(),
				contractAddress:	""
			}

			sendParams("setParams", params, (err, responseTxt) => {
				if (err) return err;
			});
		});
	});
}

/**
* Get crypto quote on CoinMarketCap, in USD and in EUR
*/
function getCotation(cryptoId, cb) {
	var url = config.cmcURI + '/ticker/' + cryptoId + '/?convert=EUR';
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
    var url = config.cmcURI + '/listings/';
    request
    .get(url)
    .end((err, res) => {
        if (err) return cb(err, null);
        if (res.body && !res.error && res.statusCode===200 && res.text && res.text.length>0) {
            var rep = JSON.parse(res.text);
            var id = -1;
            // rep.data.forEach(function(element) {
            //    if (element.name === cryptoName)
            //    {
            //        id = Number(element.id);
            //    }
            // });
            rep.data.some(function(element) {
                if (element.name === cryptoName) {
                    id = Number(element.id);
                    return true;
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
	const url = config.webURI + '/login';
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
function sendParams(api, params, cb) {
	// first : login and get a valid token
	login(config.webUser, config.webPass, (err, tokenId) => {
		// second : send data
		const url = config.webURI + '/api/ICOs/' + api;
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
    
  	var web3 = new Web3(new Web3.providers.HttpProvider(config.web3Provider));  
	var contractCreactionBlock = 0;

	mParam.find(function(err, params) {
        if (err){
            logger.error("Erreur occurs when reading Param table, error: %o", JSON.stringify(err));
            return;
        }
		
		if (params.length != 0)
		{
			contractCreactionBlock = params[0].BlockTokenStart;
		}

		// get parameters from table Param
		mParam.destroyAll(function(err, param) {
			if (err){
				logger.error("Error occurs when cleaning Param table. error: " + JSON.stringify(err));
				return cb("Error occurs when cleaning param table. error: " + JSON.stringify(err), null);
			}
			logger.info("Table Param empty, create default params");
			mParam.create({ ICOWalletTokenAddress: config.walletTokenAddress, ICOWalletEthereumAddress: config.walletEthereumAddress, ICOWalletDiscount1Address: config.walletDiscount1Address, 
				ICOWalletDiscount2Address: config.walletDiscount2Address, USDEthereumPrice: config.usdEthereumPrice, USDTokenPrice: config.usdTokenPrice, Discount1Factor: config.discount1Factor, Discount2Factor: config.discount2Factor, TransactionGaz: config.transactionGaz, GazPice: config.gazPrice}, (err, instance) => {
				if (err) {
					logger.error("Error occurs when adding default param in table Param error: " + JSON.stringify(err));
					return cb("Error occurs when adding default param in table Param error: " + JSON.stringify(err), null);
				}
				WalletReceived(instance, contractCreactionBlock, web3, cb);
			});
		});
	});
}

/**
 * Cleanup transactions
 * 
 * @callback {Function} cb A callback which is called when token is created and deployed, or an error occurs. Invoked with (err, tokenInfos).
 */
SmartContract.prototype.cleanTransaction = function (cb) {
	logger.info(config.appName + ': Clean Transaction...');
    
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

/**
 * Cleanup parameters
 * 
 * @callback {Function} cb A callback which is called when token is created and deployed, or an error occurs. Invoked with (err, tokenInfos).
 */
SmartContract.prototype.cleanParam = function (cb) {
	logger.info(config.appName + ': Clean Params...');
    
	// delete all params in transaction table
	mParam.destroyAll(function(err, info) {
		if (err) {
			logger.error("Error occurs when cleaning Param table. error: " + JSON.stringify(err));
			return cb("Error occurs when cleaning Param table. error: " + JSON.stringify(err), null);
		}
		logger.info(info.count + " were destroyed from Param table");	
		return cb(null, info.count + " were destroyed from Param table");
	});
}

/**
 * fic parameters
 * 
 * @callback {Function} cb A callback which is called when token is created and deployed, or an error occurs. Invoked with (err, tokenInfos).
 */
SmartContract.prototype.fixParam = function (cb) {
	logger.info(config.appName + ': fix Params...');
    
	var dtIcoStart = new Date(config.dateIcoStart);
	var dtIcoEnd = new Date(config.dateIcoEnd);

	mParam.find(function(err, params) {
        if (err){
            logger.error("Erreur occurs when reading Param table, error: %o", JSON.stringify(err));
            return;
		}
		if (params.length != 0)
		{
			params[0].updateAttributes( { "TokenContractTransactionHash" : "0x6a8d436109e99c29d4f5234e13413203e72181d2a3e5f28b3f6732a42c540fdb", "TokenContractAddress" : "0x1595f85e801257aaaf5eedcc1fc95e03ea9d90fd", "NbTotalToken": 80000000, "NbTokenToSell": 80000000, 
									"USDTokenPrice": 0.45, "USDEthereumPrice": 205, "NbTokenSold": 0.0, "NbEthereum": 0.0, "LastProcessedBlock": 6366855, "BlockTokenStart": 6362564, 
									"NbBlockTransactionConfirmation": 6, "IcoDateStart": dtIcoStart.getTime(), "IcoDateEnd": dtIcoEnd.getTime(), "TransactionGaz": 94000, "GazPice": 24 }, function (err, instance) {
				if (err) {
					logger.error("Can't update param.attributes for param.id: " + instance.id + " err:" + err);
					return cb(err, null);
				}
				logger.info("Param table fixed: " + instance.TokenContractTransactionHash + " " + instance.TokenContractAddress + " " + instance.NbTotalToken + " " + instance.NbTokenToSell + " " + instance.USDTokenPrice + " " + instance.USDEthereumPrice + " " +
			                  instance.NbTokenSold + " " + instance.NbEthereum);
			});
		}
	});
	return cb(null, "fix prams launched");
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
