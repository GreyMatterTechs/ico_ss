"use strict"

// required
const path		= require('path');
const appRoot	= require('app-root-path');
const Web3		= require("web3");
const Solc		= require("solc");
const Fs		= require("fs");
const abiDecoder= require("abi-decoder");
const Async		= require("async");
const request   = require('superagent');
const config	= reqlocal(path.join('server', 'config' + (process.env.NODE_ENV === undefined ? '' : ('.' + process.env.NODE_ENV)) + '.js'));
const logger	= reqlocal(path.join('server', 'boot', 'winston.js')).logger;

var appname;
var mParam;
var mParamBackup;
var mTransaction;

var cronStarted = false;
var KillContractInstance = null;
var initCalled = false;
var cron;

/**
* Class KillContract
* 
* @param {Object} _server The Loopback server
* @param {String} _appname The App name
*/
var KillContract = function (_server, _appname) {
    appname = _appname;
    mParam = _server.models.Param;
    mParamBackup = _server.models.ParamBackup;
    mTransaction = _server.models.Transaction;
};

KillContract.prototype.Init = function (cb) {
    logger.info(appname + ': Init KillContract...');

    // connection to local node
    // set the provider you want from Web3.providers
    var web3 = new Web3(new Web3.providers.HttpProvider(config.web3Provider));  
  
    // we compile the contract source code for have the contract abi  
    let source = Fs.readFileSync(path.join(`${appRoot}`, 'server', 'commands', 'SecureSwapToken.sol'), 'utf8');
    let compiledContract = Solc.compile(source, 1);
    if (compiledContract.errors != undefined)
    {
        logger.error("Error or warning during contract compilation: " + JSON.stringify(compiledContract.errors));
        return cb("Error or warning during contract compilation: " + JSON.stringify(compiledContract.errors));
    }
  
    // get contract abi  
    let abi = JSON.parse(compiledContract.contracts[':SecureSwapToken'].interface);

    mParam.find(function(err, params) {
        if (err){
            logger.error("Erreur occurs when reading Param table, error: " + JSON.stringify(err));
            return cb("Erreur occurs when reading Param table, error: " + JSON.stringify(err), null);
        }
        ParamsReceived(params, cb);
    });
    
    function ParamsReceived(params, cb) {
        if (params.length === 0)
        {
            logger.error("Params for smart contract not defined not defined !");
            return;
        }
    
        var tokenContractTransactionHash = params[0].TokenContractTransactionHash;
        if (tokenContractTransactionHash === "" || tokenContractTransactionHash === undefined) {
            logger.error("Token smart contract transaction hash not defined !");
            return;
        }

        // get contract object
        var tokenContract = web3.eth.contract(abi);
        // get transaction receipt who create the token
        var transactionReceipt = web3.eth.getTransactionReceipt(tokenContractTransactionHash);
        if (transactionReceipt === null) {
            logger.error("Problem with smart-contrat, transaction receipt can't be obtened, check token contract deploy on node and contrat transaction hash on Param table!");
            return;
        }

        // get contract instance
        var tokenContractInstance = tokenContract.at(transactionReceipt.contractAddress);
        if (tokenContractInstance === null || tokenContractInstance === undefined) {
            logger.error("Problem with smart-contrat, instance value can be obtened, check token contract deploy and contrat transaction hash on Param table!");
            return;
        }

        tokenContractInstance.kill(params[0].ICOWalletTokenAddress, {from: params[0].ICOWalletTokenAddress});
        logger.info("Smart contract Hash: " + tokenContractTransactionHash + " address: " + transactionReceipt.contractAddress + " killed!");
    }
}

/* ------ Module export ----------- */
module.exports = function (_server, _appname) {
    if (KillContractInstance === null)
    {
        KillContractInstance = new KillContract(_server, _appname);
    }
    return KillContractInstance;
}
  
KillContract.prototype.kill = function(cb) {
    KillContractInstance.Init(cb);
    return cb(null, "Kill contract received!"); 
}
