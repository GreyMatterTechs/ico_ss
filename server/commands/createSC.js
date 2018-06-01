'use strict';

var path        = require('path');
var debug       = require('debug')('icodb:sc');
var config      = require(path.join(__dirname, '../config' + (process.env.NODE_ENV !== 'development' ? ('.' + process.env.NODE_ENV) : '') + '.json'));
var async       = require('async');
var request     = require('superagent');
var fse         = require('fs-extra');
var moment      = require('moment-timezone');
const Web3      = require('web3');
const Fs        = require('fs');
const Solc      = require('solc');

var appname;
var mParam;
var mTransaction;

/**
* Class SmartContract
* 
* @param {Object} _server The Loopback server
* @param {String} _appname The App name
*/
var SmartContract = function (_server, _appname) {
    appname = _appname;
    mParam = _server.models.Param;
    mTransaction = _server.models.Transaction;
};

SmartContract.prototype.create = function (cb) {
  console.log(appname + ': Creating...');
    
  var web3;
  
  // connection to local node
  if (typeof web3 !== 'undefined') {
      web3 = new Web3(web3.currentProvider);
  } else {
    // set the provider you want from Web3.providers
    web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));  
  }

  var tokenInitialOwnerAdresse;

  // delete all transactions in transaction table
  mTransaction.destroyAll(function(err, instance){});

  // get parameters from table Param
  mParam.find(function(err, param) {
    if (err || param.length === 0){
      //return cb(err, null);
      console.log("Table Param empty, create default params");
      mParam.create({ ICOWalletAdress: "0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1", USDEthereumPrice: 600.0, USDTokenPrice: 0.1 }, (err, instance) => {
        if (err) {
            console.log("Error occurs when adding default param in table Param error: %o", err);
            return cb("Error occurs when adding default param in table Param error: " + JSON.stringify(err), null);
        }
        WalletReceived(instance, cb);
      });
    }
    else
    {
      WalletReceived(param, cb);
    }
  });
  
  function WalletReceived(param, cb) {
    if (param.length === 0)
    {
      return cb("Wallet adress of Token owner not defined !", null);
    }
    var tokenInitialOwnerAdresse = param[0].ICOWalletAdress;
    console.log("Inital token owner is: ", tokenInitialOwnerAdresse);
    
    let source = Fs.readFileSync('server/commands/SecureSwapToken.sol', 'utf8');
    let compiledContract = Solc.compile(source, 1);
    if (compiledContract.errors !== undefined)
    {
      console.log("Error or warning during contract compilation: " + compiledContract.errors);
      return cb("Error or warning during contract compilation: " + JSON.stringify(compiledContract.errors), null);
    }
    
    let abi = compiledContract.contracts[':SecureSwapToken'].interface;
    let bytecode = "0x" + compiledContract.contracts[':SecureSwapToken'].bytecode;
    let gasEstimate = web3.eth.estimateGas({data: bytecode});
    
    let formatedAbi = JSON.parse(abi);
    console.log("contract compiled, abi: %o gasEstimated: %d\n", formatedAbi, gasEstimate);
    
    if (formatedAbi.length !== 12)
    {
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
    if (secureswapContractInstance.address === undefined){
      var transactionReceipt = web3.eth.getTransactionReceipt(secureswapContractInstance.transactionHash);
      if (transactionReceipt !== undefined){
        secureswapContractInstance.address = transactionReceipt.contractAddress;
      }
    }
    
    if (secureswapContractInstance.transactionHash === 'undefined' || secureswapContractInstance.address === 'undefined'){
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

    param[0].updateAttributes( { "TokenContractTransactionHash" : secureswapContractInstance.transactionHash, "NbTotalToken": adjustedBalance, "NbTokenToSell": 70000000, 
                                    "USDTokenPrice": 0.1, "USDEthereumPrice": 600, "NbTokenSold": 0.0, "NbEthereum": 0.0, "LastProcessedBlock": transactionReceipt.blockNumber, "BlockTokenStart": transactionReceipt.blockNumber, "NbBlockTransactionConfirmation": 6 }, function (err, instance) {
      if (err) {
        return cb(err, null);
      }
      console.log("New Token ERC20 infos: TokenName: %s, TokenSymbol: %s, Decimal: %d, Token owner balance: %d", tokenName, tokenSymbol, decimal.toNumber(), adjustedBalance);
      return cb(null, "New Token ERC20 infos: TokenName: " + tokenName + " TokenSymbol: " + tokenSymbol + " Decimal: " + decimal.toNumber() + " Token owner balance: " + adjustedBalance);
    });        
  }
};

/* ------ Module export ----------- */
module.exports = function (_server, _appname) {
    return new SmartContract(_server, _appname);
};
