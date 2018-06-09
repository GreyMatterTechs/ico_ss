'use strict';

const path      = require('path');
const debug     = require('debug')('ico_ss:sc');
const config	= require( path.join(__dirname, '../config' + (process.env.NODE_ENV!=='development' ? ('.'+process.env.NODE_ENV) : '') + '.json') );
const Web3      = require('web3');
const Fs        = require('fs');
const Solc      = require('solc');

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

/**
 * Compile our SecureSwapToken solidity source code
 * Create ERC20 contract
 * Deploy (mine) the contract
 *
 * @param {Array} param Wallet adress of Token owner
 * @callback {Function} cb A callback which is called when token is created and deployed, or an error occurs. Invoked with (err, tokenInfos).
 * @param {Error} err Error information
 * @param {Object} tokenInfos New Token ERC20 infos object
 *
 * @class SmartContract
 * @private
 */
function WalletReceived(param, cb) {
	if (param.length === 0) {	// $$$ selon l'appelant, param est soit un objet, soit un array, donc tu peux pas te baser sur length
		return cb("Wallet adress of Token owner not defined !", null);
	}
	var tokenInitialOwnerAdresse = param[0].ICOWalletAdress;	// $$$ donc tu voulais un array, donc l'appel avec instance est faux, d'ailleurs, ça crashe... 
	console.log("Inital token owner is: ", tokenInitialOwnerAdresse);

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

	// deploy (mine) the contract
	var secureswapContractInstance = secureswapContract.new(
		{
			from: tokenInitialOwnerAdresse,
			data: bytecode,
			gas: gasEstimate
		});

	// fix contract adresse not setted in test environement, not sure if happend in real node
	if (secureswapContractInstance.address === undefined) {
		var transactionReceipt = web3.eth.getTransactionReceipt(secureswapContractInstance.transactionHash);
		if (transactionReceipt !== undefined) {
			secureswapContractInstance.address = transactionReceipt.contractAddress;
		}
	}

	if (secureswapContractInstance.transactionHash === 'undefined' || secureswapContractInstance.address === 'undefined') {
		console.log("Contract not mined, contract transaction hash: %s, contract address: %s", secureswapContractInstance.transactionHash, secureswapContractInstance.address);
		return cb("Contract not mined, contract transaction hash: " + secureswapContractInstance.transactionHash + " contract address: " + secureswapContractInstance.address, null);
	}

	console.log("Contract Mined !, contract transaction hash: %s, contract adresse: %s", secureswapContractInstance.transactionHash, secureswapContractInstance.address);

	var tokenContractInterface = web3.eth.contract(secureswapContractInstance.abi).at(secureswapContractInstance.address);
	var decimal = tokenContractInterface.decimals();
	var balance = tokenContractInterface.balanceOf(tokenInitialOwnerAdresse);
	var adjustedBalance = balance / Math.pow(10, decimal);
	var tokenName = tokenContractInterface.name();
	var tokenSymbol = tokenContractInterface.symbol();
	/*	// $$$ pourquoi commenter ça ?
		//     du coup tu n'appelle jamais cb(), et donc le browser ne reçoit jamais la réponse à sa requete...

		param[0].updateAttributes( { "TokenContractTransactionHash" : secureswapContractInstance.transactionHash, "NbTotalToken": adjustedBalance, "NbTokenToSell": 70000000, 
										"USDTokenPrice": 0.1, "USDEthereumPrice": 600, "NbTokenSold": 0.0, "NbEthereum": 0.0, "LastProcessedBlock": transactionReceipt.blockNumber, "BlockTokenStart": transactionReceipt.blockNumber, "NbBlockTransactionConfirmation": 6 }, function (err, instance) {
		  if (err) {
			return cb(err, null);
		  }
		  console.log("New Token ERC20 infos: TokenName: %s, TokenSymbol: %s, Decimal: %d, Token owner balance: %d", tokenName, tokenSymbol, decimal.toNumber(), adjustedBalance);
		  return cb(null, "New Token ERC20 infos: TokenName: " + tokenName + " TokenSymbol: " + tokenSymbol + " Decimal: " + decimal.toNumber() + " Token owner balance: " + adjustedBalance);
		});        
	*/
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
 * @param {Object} tokenInfos New Token ERC20 infos object
 * 
 * @class SmartContract
 * @public
 */
SmartContract.prototype.create = function (cb) {
  console.log(config.appName + ': Creating...');
    
  var web3; // $$$ pour moi , en faisant ça, cette variable sera TOUJOURS undefined... à tester.
  
  // connection to local node
  if (typeof web3 !== 'undefined') {
      web3 = new Web3(web3.currentProvider);
  } else {
    // set the provider you want from Web3.providers
    web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));  
  }

  // delete all transactions in transaction table
  mTransaction.destroyAll(function(err, info){
	if (err) {
		console.log("Error occurs when cleaning Transaction table. error: %o", err);
		return cb("Error occurs when cleaning Transaction table. error: " + JSON.stringify(err), null);
	}
	console.log(info.count + "were destroyed from Transaction table");	

	// get parameters from table Param
	// $$$ Pourquoi mettre ces paramètres dans une base de données, plutôt que dans un simple fichier de config ?
	//     Puisque param[0].updateAttributes() est commenté, il n'y a pas de mise à jour, donc un simple config.json serait suffisant...
	mParam.find(function(err, param) {
		if (err || param.length === 0){
			console.log("Table Param empty, create default params");
			mParam.create({ ICOWalletAdress: "0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1", USDEthereumPrice: 600.0, USDTokenPrice: 0.1 }, (err, instance) => {
				if (err) {
					console.log("Error occurs when adding default param in table Param error: %o", err);
					return cb("Error occurs when adding default param in table Param error: " + JSON.stringify(err), null);
				}
				WalletReceived(instance, cb);	// $$$ ici tu passe l'instance, donc un objet
			});
		}
		else
		{
			WalletReceived(param, cb);	// $$$ ici tu passe un array d'instances
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
