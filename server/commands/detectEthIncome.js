"use strict"

// required
const Web3		= require("web3");
const Solc		= require("solc");
const Fs		= require("fs");
const abiDecoder= require("abi-decoder");
const Async		= require("async");
const path		= require('path');
const debug		= require('debug')('ico_ss:DetectEthereumIncome');
const config	= require( path.join(__dirname, '../config' + (process.env.NODE_ENV!=='development' ? ('.'+process.env.NODE_ENV) : '') + '.json') );

var appname;
var mParam;
var mTransaction;

var cronStarted = false;
var detectEthereumIncomeInstance = null;
var initCalled = false;
var cron;

/**
* Class DetectEthereumIncome
* 
* @param {Object} _server The Loopback server
* @param {String} _appname The App name
*/
var DetectEthereumIncome = function (_server, _appname) {
    appname = _appname;
    mParam = _server.models.Param;
    mTransaction = _server.models.transaction;
};

DetectEthereumIncome.prototype.Init = function (cb, checkMode) {
    console.log(appname + ': Init DetectEthereumIncome...');

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

    abiDecoder.addABI(abi);

    mParam.find(function(err, params) {
        if (err){
            debug("Erreur occurs when reading Param table, error: %o", err);
            console.log("Erreur occurs when reading Param table, error: %o", err);
            return;
        }
        ParamsReceived(params, cb, checkMode);
    });
    
    function ParamsReceived(params, cb, checkMode) {
        if (params.length === 0)
        {
            debug("Wallet for initial token owner not defined !");
            console.log("Wallet for initial token owner not defined !");
            return;
        }
        // wallet adresse & private key and contract transaction hash used for create the token
        var ICOWalletEthereumAddress = undefined;
        var ICOWalletTokenAddress = undefined;
        if (params.length !== 0) {
            ICOWalletEthereumAddress = params[0].ICOWalletEthereumAddress;
            ICOWalletTokenAddress = params[0].ICOWalletTokenAddress;
            console.log("Inital token owner is: %s, ethereum receiver: %s", ICOWalletTokenAddress, ICOWalletEthereumAddress);
        }
        if (ICOWalletTokenAddress === "" || ICOWalletTokenAddress === undefined || ICOWalletTokenAddress === null || ICOWalletEthereumAddress === "" || ICOWalletEthereumAddress === undefined || ICOWalletEthereumAddress === null) {
            debug("Wallet for initial token owner not defined !");
            console.log("Wallet for initial token owner not defined !");
            return;
        }
    
        var tokenContractTransactionHash = params[0].TokenContractTransactionHash;
        if (tokenContractTransactionHash === "" || tokenContractTransactionHash === undefined) {
            debug("Token smart contract transaction hash not defined !");
            console.log("Token smart contract transaction hash not defined !");
            return;
        }
        web3.eth.defaultAccount = ICOWalletTokenAddress;
        var ethereumPrice = web3.toBigNumber(params[0].USDEthereumPrice);
        var tokenPriceUSD = web3.toBigNumber(params[0].USDTokenPrice);
        var tokenPriceEth = tokenPriceUSD.dividedBy(ethereumPrice);
        var transactionGaz = params[0].TransactionGaz;
        var gazPrice = web3.toWei(params[0].GazPice,'gwei');

        if (tokenPriceEth.toNumber() === 0) {
            debug("Token price not correctly defined !, Etherum USD Price: " + ethereumPrice.toNumber() + "Token USD price: " + tokenPriceUSD.toNumber(), null);
            console.log("Token price not correctly defined !, Etherum USD Price: " + ethereumPrice.toNumber() + "Token USD price: " + tokenPriceUSD.toNumber(), null);
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

        var decimal = tokenContractInstance.decimals();

        // get all transactions of an account (*from*/to) between start and end block
        function getTransactionsOfAccount(myaccount, startBlockNumber, endBlockNumber, onlyTokenSend) {
            if (endBlockNumber == null) {
                endBlockNumber = eth.blockNumber;
                console.log("Using endBlockNumber: " + endBlockNumber);
            }
            if (startBlockNumber == null) {
                startBlockNumber = endBlockNumber - 1000;
                console.log("Using startBlockNumber: " + startBlockNumber);
            }
            console.log("Searching for transactions to/from account \"" + myaccount + "\" within blocks "  + startBlockNumber + " and " + endBlockNumber);
        
            var toSCTransactionsArray = [];
            var fromSenderTransactionsArray = [];
        
            // parse block range
            for (var b = startBlockNumber; b <= endBlockNumber; b++) {
                if (b % 10 == 0) {
                    console.log("Parsing block range: " + b + " to block: " + Math.min(endBlockNumber, b + 9));
                }
                var block = web3.eth.getBlock(b, true);
                if (block != null && block.transactions != null) {
                    for( var t = 0 ; t < block.transactions.length; ++t) {
                        var e = block.transactions[t];
                        // account is the receip of transaction
                        if (e.to !== null && myaccount.toLowerCase() === e.to.toLowerCase() && onlyTokenSend === false) {
                            fromSenderTransactionsArray.push(e);
                        }
                        
                        // account is emiter of transaction
                        if (myaccount.toLowerCase() == e.from.toLowerCase()) {
                            if (e.to !== null && e.to.toLowerCase() === tokenContractInstance.address.toLowerCase())
                            {
                                toSCTransactionsArray.push(e);
                            }
                        }
                    }
                }
            }

            return [toSCTransactionsArray, fromSenderTransactionsArray];
        }
    
        // display transactions
        function displayTransactionTo(transactions) {
            transactions.forEach( function(e) {
                console.log(" received: %f Eth from %s, tx hash: %s", web3.fromWei(e.value, 'ether').toFixed(8), e.from, e.hash);
            });
        }

        // display transactions
        function displayTransactionFrom(transactions) {
            transactions.forEach( function(e) {
                const decodedData = abiDecoder.decodeMethod(e.input);
                console.log(" call smart contrat function: %s for send %f Token to %s and %f Eth, tx hash: %s", decodedData.name, decodedData.params[1].value / Math.pow(10, decimal), decodedData.params[0].value, web3.fromWei(e.value, 'ether').toFixed(8), e.hash );
            });
        }

        // display transaction int table
        function displayTransactionTable(transactions) {
            transactions.forEach( function(e){
                console.log("Emitter: %s, NonceIn: %d, DateTimeIn: %s, InTransactionHash: %s, NbEthereum: %f, OutTransanctionHash: %s, NonceOut: %d, NbToken: %f, DateTimeOut: %s", e.EmiterWallet, e.NonceIn, e.DateTimeIn, e.InTransactionHash, e.NbEthereum, e.OutTransactionHash, e.NonceOut, e.NbToken, e.DateTimeOut);
            });
        }

        function sendTokenForTransaction(transactions, tokenContractInstance, procTrans, missingToken){
            var notProcessedTrans = transactions.filter(item => procTrans.every(cItem => !(cItem.EmiterWallet === item.from && cItem.InTransactionHash === item.hash)));

            Async.forEach(notProcessedTrans, function(e) {
                var nbEth = web3.fromWei(e.value, 'ether');
                console.log(" received: %f Eth from %s, tx hash: %s", nbEth.toFixed(8), e.from, e.hash);
                var nbTokenToTransfert = nbEth.dividedBy(tokenPriceEth);
                var nbTokenUnitToTransfert = nbTokenToTransfert.times(Math.pow(10, decimal));
                console.log(" -> Send: %f SSWT to %s", nbTokenToTransfert.toNumber().toFixed(8), e.from);

                if (!missingToken) {
                    ethereumReceived += nbEth.toNumber();
                    nbTokenSold += nbTokenToTransfert.toNumber();
                }

                params[0].updateAttributes( { "NbEthereum" : ethereumReceived, "NbTokenSold": nbTokenSold }, function (err, instance) {
                    if (err) {
                        debug("error: Unable to update NbEthereum/NbTokenSold of Param table: %O", err);
                        console.log("error: Unable to update NbEthereum/NbTokenSold of Param table: %O", err);
                    }
                });        

                if(!missingToken){
                    // add transaction in table
                    mTransaction.create({ EmiterWallet: e.from, DateTimeIn: (new Date()).toUTCString(), InTransactionHash: e.hash, NonceIn: e.nonce, NbEthereum: nbEth, NbToken: nbTokenUnitToTransfert }, transCreateCB.bind(null, nbTokenUnitToTransfert));
                }
                else {
                    mTransaction.find({ where: { EmiterWallet: e.from, InTransactionHash: e.hash }}, transUpdateCB.bind(null, nbTokenUnitToTransfert));
                }
            }, function(err) {
                if(err)
                {
                    debug("Error %o occurs during async.forEach for sendTokenForTransaction", err);
                    console.log("Error %o occurs during async.forEach for sendTokenForTransaction", err);
                }
            });
        }

        function transCreateCB(nbToken, err, instance) {
            if (err) {
                debug("Error occurs when adding transaction in table(for input transaction hash: %s) error: %o", e.hash, err);
                console.log("Error occurs when adding transaction in table(for input transaction hash: %s) error: %o", e.hash, err);
            }
            else
            {
                sendToken(instance, nbToken);
            }
        }

        function transUpdateCB(nbToken, err, instances) {
            if (err) {
                debug("Error occurs when find transaction in table(for input transaction hash: %s) for mising token send, error: %o", e.hash, err);
                console.log("Error occurs when find transaction in table(for input transaction hash: %s) for mising token send, error: %o", e.hash, err);
            }
            else
            {
                if (instances.length != 1) {
                    debug("Many instance found (%d) when find transaction in table(for input transaction hash: %s) for mising token send", e.hash);
                    console.log("Many instance found (%d) when find transaction in table(for input transaction hash: %s) for mising token send", e.hash);
                }
                else {
                    sendToken(instances[0], nbToken);
                }
            }
        }

        function sendToken(instance, nbToken) {
            tokenContractInstance.transfer(instance.EmiterWallet, nbToken, {gas: transactionGaz, gasPrice: gazPrice}, function(err, thash) {
                if (!err) {
                    web3.eth.getTransaction(thash, function(err, trans){
                        if(err){
                            debug("Error: web3.eth.getTransaction() return an error after send/deploy transaction (transaction hash: %s) error: %o", thash, err);
                            console.log("Error: web3.eth.getTransaction() return an error after send/deploy transaction (transaction hash: %s) error: %o", thash, err);
                        }
                        else {
                            console.log("Tokens sended to: %s, transaction hash: %s", trans.to, trans.hash);

                            // update transaction table
                            instance.updateAttributes( { "OutTransactionHash": trans.hash, "NonceOut": trans.nonce, "DateTimeOut": (new Date()).toUTCString(), "NbToken": nbToken.dividedBy(Math.pow(10, decimal)).toNumber() }, function (err, instance) {
                                if (err) {
                                    debug("Error: can't update transaction table after transaction hash: %s is mined, error: %o", trans.hash, err);
                                    console.log("Error: can't update transaction table after transaction hash: %s is mined, error: %o", trans.hash, err);
                                }
                            })
                        }
                    })
                }
                else {
                    console.log("send token to wallet %s for %f tokens from input transaction %s error: %o", instance.EmiterWallet, nbToken.dividedBy(Math.pow(10, decimal)).toNumber(), instance.InTransactionHash, err);
                }
            })

        }

        function checkTransaction(bcTransIn , bcTransOut, procTrans, tokenContractInstance){
            // On selectione les transactions de reception d'ethereum manquantes dans la table
            var missingTransactionIn = bcTransIn.filter(bcTin => procTrans.every(pT => !(pT.EmiterWallet === bcTin.from && pT.InTransactionHash === bcTin.hash)));
            // On selectione toutes les transactions de reception d'ethereum qui ont été detectées
            var InTableTransactionIn = bcTransIn.filter(bcTin => missingTransactionIn.every(mti => !(mti.from === bcTin.from && mti.hash === bcTin.hash)));
            // on selectione toutes les transaction de reception d'ethereum detectées qui n'ont pas de transaction d'emmissions de token renseignées
//            var missingTokenInfo = InTableTransactionIn.filter(bcTin => procTrans.some(pT => (pT.EmiterWallet === bcTin.from && pT.InTransactionHash == bcTin.hash && pT.NonceIn === bcTin.nonce && pT.OutTransactionHash === undefined)));
            // on selectione toutes les transactions d'emission de token qui ne sont pas renseignées dans la table (OutTransactionHash non renseignée)
            var missingTransOutInTable = bcTransOut.filter(function(value){
                const decodedData = abiDecoder.decodeMethod(value.input);
                return procTrans.every(pT => !(pT.EmiterWallet === decodedData.params[0].value && pT.OutTransactionHash == value.hash));
            });

            // on check les transaction receipt de chaqu etransaction d'envois de token
            bcTransOut.forEach(function(t){
                const decodedData = abiDecoder.decodeMethod(t.input);
                var transactionReceipt = web3.eth.getTransactionReceipt(t.hash);
                console.log("Decoded data %o   transaction Receipt: %o", decodedData, transactionReceipt);
            });

            // on match les transaction de token emises qui ne sont pas dans la table mais sont sur la blockchain (transaction d'envois de token emise mais non renseignées en table)
            if (missingTransOutInTable.length > 0) {
                console.log("checkTransaction found %d missing processed transaction out (token sent) in table", missingTransOutInTable.length);
                Async.forEach(missingTransOutInTable, function(t) {
                    const decodedData = abiDecoder.decodeMethod(t.input);
                    for (var i = 0; i < procTrans.length; ++i) {
                        if (decodedData.params[0].value === procTrans[i].EmiterWallet && decodedData.params[1].value == procTrans[i].NbToken && procTrans[i].OutTransactionHash === undefined) {
                            procTrans[i].updateAttributes( { "OutTransactionHash": t.hash, "NonceOut": t.nonce, "NbToken": decodedData.params[1].value / Math.pow(10, decimal), "DateTimeOut": (new Date()).toUTCString() }, function (err, instance) {
                                if (err) {
                                    debug("Error: can't update transaction table for out transaction hash: %s during checkTransaction, error: %o", t.hash, err);
                                    console.log("Error: can't update transaction table for out transaction hash: %s during checkTransaction, error: %o", t.hash, err);
                                }
                            })
                            break;
                        }
                    }
                }, function(err) {
                    if(err)
                    {
                        debug("Error %o occurs during async.forEach on missingTransOutInTable", err);
                        console.log("Error %o occurs during async.forEach on missingTransOutInTable", err);
                    }
                });
            }

            // on selectione toutes les transaction de reception d'ethereum detectées qui n'ont pas de transaction d'emmissions de token renseignées
            var missingTokenSend = InTableTransactionIn.filter(bcTin => procTrans.some(pT => (pT.EmiterWallet === bcTin.from && pT.InTransactionHash == bcTin.hash && pT.NonceIn === bcTin.nonce && pT.OutTransactionHash === undefined)));
            if (missingTokenSend.length > 0){
                console.log("checkTransaction found %d missing Token transaction sending for received ethereum", missingTokenSend.length);
                sendTokenForTransaction(missingTokenSend, tokenContractInstance, [], true);
            }

            // On check si il manque le traitement de reception d'ethereum (rien dans la table concernant une reception d'ethereum)
            if (missingTransactionIn.length > 0) {
                console.log("checkTransaction found %d missing processed transaction in (ethreum received)", missingTransactionIn.length);
                sendTokenForTransaction(missingTransactionIn, tokenContractInstance, procTrans, false);
                console.log("checkTransaction added %d missing processed transaction in (ethreum received)", missingTransactionIn.length);
                console.log("--------------------------------------------------------------------------------------");
            }
            if (missingTransactionIn.length === 0 && missingTransOutInTable.length === 0 && missingTokenSend.length === 0) {
                console.log("checkTransaction finished with no error found!");
            }
        }

        // inits for blockchain scan
        var startBlock = 0;
        var lastBlock = 0;
        var NbBlockTransactionConfirmation = params[0].NbBlockTransactionConfirmation;
        var totalToken = params[0].NbTotalToken;
        var totalTokenToSend = params[0].NbTokenToSell;
        var ethereumReceived = params[0].NbEthereum;

        if (checkMode) {
            startBlock = params[0].BlockTokenStart;
            lastBlock = params[0].LastProcessedBlock;
        }
        else {
            startBlock = params[0].LastProcessedBlock;
            if (startBlock == undefined) {
                startBlock = 0;
            }
            lastBlock = startBlock;
        }

        var balance = tokenContractInstance.balanceOf(ICOWalletTokenAddress);
        var adjustedBalance = balance / Math.pow(10, decimal);
        var nbTokenSold = totalToken - adjustedBalance;;

        mTransaction.find(function(err, procTrans) {
            if (err){
                return cb(err, null);
            }
            GoSetInterval(procTrans, checkMode);
        });

        function GoSetInterval(procTrans, checkMode) {
                initCalled = true;
                cronStarted = true;
                cron = setInterval(function() {
                IntervalProcess(procTrans, checkMode);
            }, 1000)
        }

       function transfertEthereum(ethOwner, ethDestinataire, eth){
            try { // transfer ethereum
                var tx = {
                    gas: 24000,
                    gasPrice: web3.toWei(40,'gwei'),
                    from: ethOwner,
                    to: ethDestinataire, 
                    value: eth
                }
        
                web3.eth.sendTransaction(tx, function(err, transactionHash){
                    if (!err){
                        console.log("--- secure ethereum transaction %s submited!", transactionHash);
                    }
                    else{
                        console.log("*** secure ethereum erreur %o", err);
                    return;
                    }
                });
                console.log("Secure Ethereum by sending transaction from %s to %s for %f ether", ethOwner, ethDestinataire, web3.fromWei(eth, "ether").toNumber());
            }
            catch(err){
              console.log(err);}
            finally{
              console.log('-----------------------------------------------------------------------------------');
            }
        }

        function IntervalProcess(procTrans, checkMode)
        {
            if (cronStarted) {
                balance = tokenContractInstance.balanceOf(ICOWalletTokenAddress);
                adjustedBalance = balance / Math.pow(10, decimal);
                
                if (checkMode) {
                    console.log("Before correction: ICO Etherum received: %f, token left to sell: %f", ethereumReceived.toFixed(6), adjustedBalance - (totalToken - totalTokenToSend));
                }
                else {
                    console.log("ICO Etherum received: %f, token left to sell: %f", ethereumReceived.toFixed(6), adjustedBalance - (totalToken - totalTokenToSend));
                }

                if (adjustedBalance <= (totalToken - totalTokenToSend) && checkMode == false) {
                    console.log("ICO hard cap reached !, token left: %f, Ethereum gain: %f", adjustedBalance, ethereumReceived.toFixed(6) );
                    cronStarted = false;
                    clearInterval(cron);
                    initCalled = false;
                }
                else {
                    if (checkMode) {
                        console.log("Check transactions from block %d to block %d", startBlock, lastBlock);

                        // get transaction of account toAdresse from block startBlock to lastBlock
                        var transactionsER = getTransactionsOfAccount(ICOWalletTokenAddress, startBlock, lastBlock, false);
                        var transactionsR = getTransactionsOfAccount(ICOWalletTokenAddress, lastBlock + 1, web3.eth.blockNumber, true);
                        var transactions = [];
                        transactions.push(transactionsER[0].concat(transactionsR[0]));
                        transactions.push(transactionsER[1].concat(transactionsR[1]));

                        checkTransaction(transactions[1], transactions[0], procTrans, tokenContractInstance);
                        console.log("Check transaction process finished!")
                        balance = tokenContractInstance.balanceOf(ICOWalletTokenAddress);
                        adjustedBalance = balance / Math.pow(10, decimal);
                        console.log("After correction: ICO Etherum received: %f, token left to sell: %f", ethereumReceived.toFixed(6), adjustedBalance - (totalToken - totalTokenToSend));
                        cronStarted = false;
                        clearInterval(cron);
                        initCalled = false;
                    }
                    else {
                        var newLastBlock = web3.eth.blockNumber;
                        console.log("new blocks: %d, nb confirmation block: %d", newLastBlock - lastBlock, NbBlockTransactionConfirmation);

                        if ( (newLastBlock - NbBlockTransactionConfirmation) > lastBlock)
                        {
                            lastBlock = Math.min(newLastBlock - NbBlockTransactionConfirmation, lastBlock + 100);

                            // get transaction of account toAdresse from block startBlock to lastBlock
                            var transactions = getTransactionsOfAccount(ICOWalletTokenAddress, startBlock, lastBlock, false);
                            startBlock = lastBlock + 1;

                            // display transaction received
                            console.log("Reception Eth Transaction: %d, Sent token transaction: %d", transactions[1].length, transactions[0].length);
                            displayTransactionTo(transactions[1]);
                            console.log("============================================================================");
                            displayTransactionFrom(transactions[0])

                            // Send token to investors
                            sendTokenForTransaction(transactions[1], tokenContractInstance, procTrans, false);

                            params[0].updateAttributes( { "LastProcessedBlock" : lastBlock }, function (err, instance) {
                                if (err) {
                                    debug("error: Unable to update LastProcessedBlock: %O", err);
                                    console.log("error: Unable to update LastProcessedBlock: %O", err);
                                }
                            });        

                            if (ICOWalletTokenAddress !== ICOWalletEthereumAddress) {
                                var ethAmount = Math.floor(web3.fromWei(web3.eth.getBalance(ICOWalletTokenAddress), "ether"));
                                if (ethAmount > 0) {
                                    transfertEthereum(ICOWalletTokenAddress, ICOWalletEthereumAddress, web3.toBigNumber(web3.toWei(ethAmount, "ether")));
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/* ------ Module export ----------- */
module.exports = function (_server, _appname) {
    if (detectEthereumIncomeInstance === null)
    {
        detectEthereumIncomeInstance = new DetectEthereumIncome(_server, _appname);
    }
    return detectEthereumIncomeInstance;
}
  
DetectEthereumIncome.prototype.StartSendToken = function(cb) {
    if(!initCalled)
    {
         detectEthereumIncomeInstance.Init(cb, false);
    }
  
    if (!cronStarted)
    {
      return cb(null, "Send token cron started!"); 
    }
    else{
      return cb("Send token cron started already started!", null); 
    }
  };
  
  DetectEthereumIncome.prototype.StopSendToken = function (cb) {
    if (cronStarted) {
      cronStarted = false;
      return cb(null, "Send token cron stoped!"); 
    }
    else
    {
      return cb("Send token cron not started!", null); 
    }
  }
  
  DetectEthereumIncome.prototype.CheckAndFix = function (cb) {
    if(initCalled)
    {
        cronStarted = false;
        clearInterval(cron);
    }
    detectEthereumIncomeInstance.Init(cb, true);
  
    cronStarted = true;
    return cb(null, "CheckAndFix transaction started!"); 
}
