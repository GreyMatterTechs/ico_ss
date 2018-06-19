'use strict';

const path      = require('path');
const debug     = require('debug')('ico_ss:sc');
const config	= require( path.join(__dirname, '../config' + (process.env.NODE_ENV!=='development' ? ('.'+process.env.NODE_ENV) : '') + '.json') );
const Web3      = require('web3');
const Fs        = require('fs');
const Solc      = require('solc');
const Async		= require("async");

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
	console.log("Inital token owner is: ", tokenInitialOwnerAddress);

	let source = Fs.readFileSync('server/commands/SecureSwapToken.sol', 'utf8');
	let compiledContract = Solc.compile(source, 1);
	if (compiledContract.errors !== undefined) {
		console.log("Error or warning during contract compilation: " + compiledContract.errors);
		return cb("Error or warning during contract compilation: " + JSON.stringify(compiledContract.errors), null);
	}

	let abi = compiledContract.contracts[':SecureSwapToken'].interface;
	let bytecode = "0x" + compiledContract.contracts[':SecureSwapToken'].bytecode;
	let gasEstimate = web3.eth.estimateGas({ data: bytecode });

	let formatedAbi = JSON.parse(abi);
	console.log("contract compiled, abi: %o gasEstimated: %d\n", formatedAbi, gasEstimate);

	if (formatedAbi.length !== 12) {
		console.log("Incorrect Abi interface");
		return cb("Incorrect Abi interface", null);
	}

	// create ERC20 contract
	let secureswapContract = web3.eth.contract(JSON.parse(abi));

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
			await sleep(10000);
			transactionReceipt = web3.eth.getTransactionReceipt(secureswapContractInstance.transactionHash);
		}
		secureswapContractInstance.address = transactionReceipt.contractAddress;
	}

	if (secureswapContractInstance.transactionHash === undefined || secureswapContractInstance.address === undefined) {
		console.log("Contract not mined, contract transaction hash: %s, contract address: %s", secureswapContractInstance.transactionHash, secureswapContractInstance.address);
		return cb("Contract not mined, contract transaction hash: " + secureswapContractInstance.transactionHash + " contract address: " + secureswapContractInstance.address, null);
	}

	console.log("Contract Mined !, contract transaction hash: %s, contract address: %s", secureswapContractInstance.transactionHash, secureswapContractInstance.address);

	var tokenContractInterface = web3.eth.contract(secureswapContractInstance.abi).at(secureswapContractInstance.address);
	var decimal = tokenContractInterface.decimals();
	var balance = tokenContractInterface.balanceOf(tokenInitialOwnerAddress);
	var adjustedBalance = balance / Math.pow(10, decimal);
	var tokenName = tokenContractInterface.name();
	var tokenSymbol = tokenContractInterface.symbol();

	param.updateAttributes( { "TokenContractTransactionHash" : secureswapContractInstance.transactionHash, "NbTotalToken": adjustedBalance, "NbTokenToSell": 70000000, 
							  "USDTokenPrice": 0.1, "USDEthereumPrice": 600, "NbTokenSold": 0.0, "NbEthereum": 0.0, "LastProcessedBlock": transactionReceipt.blockNumber, "BlockTokenStart": transactionReceipt.blockNumber, "NbBlockTransactionConfirmation": 6 }, function (err, instance) {
		if (err) {
			return cb(err, null);
		}
		console.log("New Token ERC20 infos: TokenName: %s, TokenSymbol: %s, Decimal: %d, Token owner balance: %d", tokenName, tokenSymbol, decimal.toNumber(), adjustedBalance);
		return cb(null, "New Token ERC20 infos: TokenName: " + tokenName + " TokenSymbol: " + tokenSymbol + " Decimal: " + decimal.toNumber() + " Token owner balance: " + adjustedBalance);
	});        
}

/**
 * Public methods
 */

/**
 * Connect to local node,
 * Cleanup transactions
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
  console.log(config.appName + ': Creating...');
    
  var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8101"));  
//  var web3 = new Web3(new Web3.providers.HttpProvider("http://192.168.56.1:8545"));  
  
  // delete all transactions in transaction table
  mTransaction.destroyAll(function(err, info){
	if (err) {
		console.log("Error occurs when cleaning Transaction table. error: %o", err);
		return cb("Error occurs when cleaning Transaction table. error: " + JSON.stringify(err), null);
	}
	console.log(info.count + " were destroyed from Transaction table");	

	// get parameters from table Param
	mParam.find(function(err, param) {
		if (err || param.length === 0){
			console.log("Table Param empty, create default params");
			mParam.create({ ICOWalletTokenAddress: "0x3e747d49be38cc69573a6aed7631430547b1bdda", ICOWalletEthereumAddress: "0x3e747d49be38cc69573a6aed7631430547b1bdda", USDEthereumPrice: 600.0, USDTokenPrice: 0.1 }, (err, instance) => {
				if (err) {
					console.log("Error occurs when adding default param in table Param error: %o", err);
					return cb("Error occurs when adding default param in table Param error: " + JSON.stringify(err), null);
				}
				WalletReceived(instance, web3, cb);
			});
		}
		else
		{
			WalletReceived(param[0], web3, cb);
		}
	});
  });  
};

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
};
