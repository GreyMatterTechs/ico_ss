'use strict';

const Web3 = require('web3');
const Tx = require('ethereumjs-tx');
const Async = require("async");

var appname;
var mParam;

var cronStarted = false;
var testSendEthereumInstance = null;
var initCalled = false;

/**
* Class TestSendEthereum
* 
* @param {Object} _server The Loopback server
* @param {String} _appname The App name
*/
var TestSendEthereum = function (_server, _appname) {
    appname = _appname;
    mParam = _server.models.Param;
};

TestSendEthereum.prototype.Init = function (cb) {
  console.log(appname + ': Init TestSendEthereum...');
  initCalled = true;

  // connection to local node
  // set the provider you want from Web3.providers
  var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8101"));  

  // function for transfert ethereum from owner to destinatire
  function transfertEthereum(ethOwner, ethDestinataire, eth){
    try { // transfer ethereum

      var tx = {
        gas: 21000,
        gasPrice: web3.toWei(40,'gwei'),
        from: ethOwner,
        to: ethDestinataire, 
        value: eth
      }

      web3.eth.sendTransaction(tx, function(err, transactionHash){
        if (!err){
          console.log("--- transaction %s submited!", transactionHash);
        }
        else{
          console.log("*** erreur %o", err);
          return;
        }
      });

      console.log("Send transaction from %s to %s for %f ether", ethOwner, ethDestinataire, web3.fromWei(eth, "ether").toNumber());
    }
    catch(err){
      console.log(err);}
    finally{
      console.log('-----------------------------------------------------------------------------------');
    }
  }

  mParam.find(function(err, products) {
    if (err){
      console.log("Error when reading table Param: %o", err);
      return;
    }
    SendEthereum(products);
  });

  function SendEthereum(products) {
    if (products.length === 0)
    {
      console.log("Wallet to send adress not defined !");
      return;
    }
    var ICOWalletAddress = products[0].ICOWalletTokenAddress;
    console.log("Inital token owner is: ", ICOWalletAddress);

    var count = 0;               
    var cron = setInterval(function() {
      if (cronStarted) {
        for (var i = 3; i < web3.eth.accounts.length; ++i) {
          if (Math.random() > 0.5){
            transfertEthereum(web3.eth.accounts[i], ICOWalletAddress, web3.toBigNumber((Math.random() * web3.eth.getBalance(web3.eth.accounts[i]) / 100)));
          }
        }
        count += 1;
        if (count >= 1000)
        {
          clearInterval(cron);
        }
      }
    }, 20000);
  }
};

/* ------ Module export ----------- */
module.exports = function (_server, _appname) {
  if (testSendEthereumInstance === null)
  {
    testSendEthereumInstance = new TestSendEthereum(_server, _appname);
  }
  return testSendEthereumInstance;
}

TestSendEthereum.prototype.StartSend = function(cb) {
  if(!initCalled)
  {
    testSendEthereumInstance.Init(cb);
  }

  if (!cronStarted)
  {
    cronStarted = true;
    return cb(null, "Send ethereum cron started!"); 
  }
  else{
    return cb("Send ethereum cron started already started!", null); 
  }
};

TestSendEthereum.prototype.StopSend = function (cb) {
  if (cronStarted) {
    cronStarted = false;
    return cb(null, "Send ethereum cron stoped!"); 
  }
  else
  {
    return cb("Send ethereum cron not started!", null); 
  }
}
