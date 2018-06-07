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
  var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));  

  // function for transfert ethereum from owner to destinatire
  function transfertEthereum(ethOwner, ethDestinataire, eth){
    try { // transfer ethereum
//      var nonceValue = web3.eth.getTransactionCount(ethOwner);

      var tx = {
//        nonce: nonceValue,
        gasPrice: '2', 
        gasLimit: '900',
        from: ethOwner,
        to: ethDestinataire, 
        value: eth
      }

      web3.eth.sendTransaction(tx, function(err, transactionHash){
        if (!err){
          console.log("--- transaction %s mined!", transactionHash);
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
    var ICOWalletAdresse = products[0].ICOWalletAdress;
    console.log("Inital token owner is: ", ICOWalletAdresse);

    var senders = ["0xffcf8fdee72ac11b5c542428b35eef5769c409f0", "0x22d491bde2303f2f43325b2108d26f1eaba1e32b", "0xe11ba2b4d45eaed5996cd0823791e0c93114882d", "0xd03ea8624c8c5987235048901fb614fdca89b117", "0x95ced938f7991cd0dfcb48f0a06a40fa1af46ebc", 
                "0x3e5e9111ae8eb78fe1cc3bb8915d5d461f3ef9a9", "0x28a8746e75304c0780e011bed21c72cd78cd535e", "0xaca94ef8bd5ffee41947b4585a84bda5a3d3da6e", "0x1df62f291b2e969fb0849d99d9ce41e2f137006e"];

    var count = 0;               
    var cron = setInterval(function() {
      if (cronStarted) {
        senders.forEach(sender => {
          if (Math.random() > 0.5){
            transfertEthereum(sender, ICOWalletAdresse, web3.toBigNumber((Math.random() * web3.eth.getBalance(sender) / 100)));
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
