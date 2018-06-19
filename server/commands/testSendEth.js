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
        gasPrice: '21000', 
        gasLimit: '900000',
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

    var senders = ["0xd2764c270d769d16683428d6bcde800d00957367", "0x4e80dd9239327e74ea156ef1caa9e9abcfa179f9", "0x4c0af32cd1d1721a6c6f191bc9ba127926467930", "0xfdccc6008e99ea09392600ebf72ad7b30c4b73c4", "0x21953969bb5a33697502756ca3129566d03b6490", 
                   "0x10b0afcadd2de0cc4e6418d8d234075de0710384", "0x5674fea8921f8d7e85ed47f298aaa7fc5a2bc06b", "0x860044dc8ae881b9a801bd8458b57a43ad979146", "0x4256f73bd54862e4aabfa726f2dff37f17c2886f", "0x5be6b2b816d8ff5d5ac8dd56bd0236762c3c0dc4"];

    var count = 0;               
    var cron = setInterval(function() {
      if (cronStarted) {
        senders.forEach(sender => {
          if (Math.random() > 0.5){
            var amount = web3.eth.getBalance(sender) / 1000;
            transfertEthereum(sender, ICOWalletAddress, web3.toBigNumber((Math.random() * web3.eth.getBalance(sender) / 1000)));
          }
        });
        count += 1;
        if (count >= 1000)
        {
          clearInterval(cron);
        }
      }
    }, 2000);
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
