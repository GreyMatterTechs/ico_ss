"use strict"

// required
const Web3		= require("web3");
const Solc		= require("solc");
const Fs		= require("fs");
const abiDecoder= require("abi-decoder");
const Async		= require("async");
const path		= require('path');
const debug		= require('debug')('ico_ss:KillContract');
const config	= require( path.join(__dirname, '../config' + (process.env.NODE_ENV!=='development' ? ('.'+process.env.NODE_ENV) : '') + '.json') );
const request   = require('superagent');

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
    mTransaction = _server.models.transaction;
};

KillContract.prototype.Init = function (cb) {
    console.log(appname + ': Init KillContract...');

    // connection to local node
    // set the provider you want from Web3.providers
    var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8101"));  
  
    // we compile the contract source code for have the contract abi  
    let source = Fs.readFileSync('server/commands/SecureSwapToken.sol', 'utf8');
    let compiledContract = Solc.compile(source, 1);
    if (compiledContract.errors != undefined)
    {
        debug("Error or warning during contract compilation: %o", compiledContract.errors);
        console.log("Error or warning during contract compilation: %o", compiledContract.errors);
        return cb("Error or warning during contract compilation: " + JSON.stringify(compiledContract.errors));
    }
  
    // get contract abi  
    let abi = JSON.parse(compiledContract.contracts[':SecureSwapToken'].interface);

    mParam.find(function(err, params) {
        if (err){
            debug("Erreur occurs when reading Param table, error: %o", err);
            console.log("Erreur occurs when reading Param table, error: %o", err);
            return cb("Erreur occurs when reading Param table, error: " + err, null);
        }
        ParamsReceived(params, cb);
    });
    
    function ParamsReceived(params, cb) {
        if (params.length === 0)
        {
            debug("Params for smart contract not defined !");
            console.log("Params for smart contract not defined not defined !");
            return;
        }
    
        var tokenContractTransactionHash = params[0].TokenContractTransactionHash;
        if (tokenContractTransactionHash === "" || tokenContractTransactionHash === undefined) {
            debug("Token smart contract transaction hash not defined !");
            console.log("Token smart contract transaction hash not defined !");
            return;
        }

        // get contract object
        var tokenContract = web3.eth.contract(abi);
        // get transaction receipt who create the token
        var transactionReceipt = web3.eth.getTransactionReceipt(tokenContractTransactionHash);
        if (transactionReceipt === null) {
            debug("Problem with smart-contrat, transaction receipt can't be obtened, check token contract deploy on node and contrat transaction hash on Param table!");
            console.log("Problem with smart-contrat, transaction receipt can't be obtened, check token contract deploy on node and contrat transaction hash on Param table!");
            return;
        }

        // get contract instance
        var tokenContractInstance = tokenContract.at(transactionReceipt.contractAddress);
        if (tokenContractInstance === null || tokenContractInstance === undefined) {
            debug("Problem with smart-contrat, instance value can be obtened, check token contract deploy and contrat transaction hash on Param table!");
            console.log("Problem with smart-contrat, instance value can be obtened, check token contract deploy and contrat transaction hash on Param table!");
            return;
        }

        tokenContractInstance.kill(params[0].ICOWalletTokenAddress, {from: params[0].ICOWalletTokenAddress});
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
