"use strict"

// required
const Web3 = require('web3');
const Solc = require('solc');
const Fs = require('fs');
const abiDecoder = require('abi-decoder');

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
    var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));  
  
    // we compile the contract source code for have the contract abi  
    let source = Fs.readFileSync('server/commands/SecureSwapToken.sol', 'utf8');
    let compiledContract = Solc.compile(source, 1);
    if (compiledContract.errors != undefined)
    {
        console.log("Error or warning during contract compilation: %o", compiledContract.errors);
        return cb("Error or warning during contract compilation: " + JSON.stringify(compiledContract.errors));
    }
  
    // get contract abi  
    let abi = JSON.parse(compiledContract.contracts[':SecureSwapToken'].interface);

    abiDecoder.addABI(abi);

    mParam.find(function(err, params) {
        if (err){
            console.log("Erreur occurs when reading Param table, error: %o", err);
            return;
        }
        ParamsReceived(params, cb, checkMode);
    });
    
    function ParamsReceived(params, cb, checkMode) {
        if (params.length === 0)
        {
            console.log("Wallet to send adress not defined !");
            return;
        }
        // wallet adresse & private key and contract transaction hash used for create the token
        var ICOWalletAdresse = params[0].ICOWalletAdress;
        console.log("Inital token owner is: ", ICOWalletAdresse);
        if (ICOWalletAdresse === "" || ICOWalletAdresse === undefined) {
            console.log("Wallet to send adress not defined !");
            return;
        }
    
        var tokenContractTransactionHash = params[0].TokenContractTransactionHash;
        if (tokenContractTransactionHash === "" || tokenContractTransactionHash === undefined) {
            console.log("Token smart contract transaction hash not defined !");
            return;
        }
        web3.eth.defaultAccount = ICOWalletAdresse;
        var ethereumPrice = params[0].USDEthereumPrice;
        var tokenPriceUSD = params[0].USDTokenPrice;
        var tokenPriceEth = tokenPriceUSD / ethereumPrice;

        if (tokenPriceEth.isNaN || tokenPriceEth === 0) {
            console.log("Token price not correctly defined !, Etherum USD Price: " + ethereumPrice + "Token USD price: " + tokenPriceUSD, null);
            return;
        }

        // get contract object
        var tokenContract = web3.eth.contract(abi);
        // get transaction receipt who create the token
        var transactionReceipt = web3.eth.getTransactionReceipt(tokenContractTransactionHash);
        if (transactionReceipt === null) {
            console.log("Problem with smart-contrat, transaction receipt can't be obtened, check token contract deploy on node and contrat transaction hash on Param table!");
            return;
        }

        // get contract instance
        var tokenContractInstance = tokenContract.at(transactionReceipt.contractAddress);
        if (tokenContractInstance === null || tokenContractInstance === undefined) {
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
                        if (myaccount == e.to && onlyTokenSend === false) {
                            fromSenderTransactionsArray.push(e);
                        }
                        
                        // account is emiter of transaction
                        if (myaccount == e.from) {
                            if (e.to === tokenContractInstance.address)
                            {
                                toSCTransactionsArray.push(e);
                            }
                        }
                    }
                }
            }

/*          Not yet mined transaction are already parsed in only sendTokenMode
            // search not yet mined transaction emited by account
            if (onlyTokenSend) {
                var block = web3.eth.getBlock("pending", true);
                if (block != null && block.transactions != null) {
                    for( var t = 0 ; t < block.transactions.length; ++t) {
                        var e = block.transactions[t];
                        if (myaccount == e.from) {
                            if (e.to === tokenContractInstance.address)
                            {
                                toSCTransactionsArray.push(e);
                            }
                        }
                    }
                }
            }
*/
            return [toSCTransactionsArray, fromSenderTransactionsArray];
        }
    
        // display transactions
        function displayTransactionTo(transactions) {
            transactions.forEach( function(e) {
                console.log(" received: %f Eth from %s, tx hash: %s", web3.fromWei(e.value, 'ether').toFixed(8), e.from, e.hash);
            })
        }

        // display transactions
        function displayTransactionFrom(transactions) {
            transactions.forEach( function(e) {
                const decodedData = abiDecoder.decodeMethod(e.input);

                console.log(" call smart contrat function: %s for send %f Token to %s and %f Eth, tx hash: %s", decodedData.name, decodedData.params[1].value / Math.pow(10, decimal), decodedData.params[0].value, web3.fromWei(e.value, 'ether').toFixed(8), e.hash );
/*
                console.log("  tx hash          : " + e.hash + "\n"
                + "   nonce           : " + e.nonce + "\n"
                + "   blockHash       : " + e.blockHash + "\n"
                + "   blockNumber     : " + e.blockNumber + "\n"
                + "   transactionIndex: " + e.transactionIndex + "\n"
                + "   from            : " + e.from + "\n" 
                + "   to              : " + e.to + "\n"
                + "   value           : " + e.value + "\n"
                + "   gasPrice        : " + e.gasPrice + "\n"
                + "   gas             : " + e.gas + "\n"
                + "   input           : " + JSON.stringify(abiDecoder.decodeMethod(e.input)));
*/
            })
        }

        // display transaction int table
        function displayTransactionTable(transactions) {
            transactions.forEach( function(e){
                console.log("Emitter: %s, NonceIn: %d, DateTimeIn: %s, InTransactionHash: %s, NbEthereum: %f, OutTransanctionHash: %s, NonceOut: %d, NbToken: %f, DateTimeOut: %s", e.EmiterWallet, e.NonceIn, e.DateTimeIn, e.InTransactionHash, e.NbEthereum, e.OutTransactionHash, e.NonceOut, e.NbToken, e.DateTimeOut);
            })
        }

        function sendTokenForTransaction(transactions, tokenContractInstance, procTrans, missingToken){
            var notProcessedTrans = transactions.filter(item => procTrans.every(cItem => !(cItem.EmiterWallet === item.from && cItem.InTransactionHash === item.hash)));
            displayTransactionTo(notProcessedTrans);

            notProcessedTrans.forEach( function(e) {
                var nbEth = web3.fromWei(e.value, 'ether');
                console.log(" received: %f Eth from %s, tx hash: %s", nbEth.toFixed(8), e.from, e.hash);
                var nbTokenToTransfert = nbEth / tokenPriceEth;
                var nbTokenUnitToTransfert = nbTokenToTransfert * Math.pow(10, decimal);
                console.log(" -> Send: %f SSWT to %s", nbTokenToTransfert.toFixed(8), e.from);

                if (!missingToken){
                    ethereumReceived += nbEth.toNumber();
                    nbTokenSold += nbTokenToTransfert;
                }

                params[0].updateAttributes( { "NbEthereum" : ethereumReceived, "NbTokenSold": nbTokenSold }, function (err, instance) {
                    if (err) {
                        console.log("error: Unable to update NbEthereum/NbTokenSold of Param table: %O", err);
                    }
                });        

                if(!missingToken){
                    // add transaction in table
                    mTransaction.create({ EmiterWallet: e.from, DateTimeIn: (new Date()).toUTCString(), InTransactionHash: e.hash, NonceIn: e.nonce, NbEthereum: nbEth, NbToken: nbTokenUnitToTransfert }, (err, instance) => {
                        if (err) {
                            console.log("Error occurs when adding transaction in table(for input transaction hash: %s) error: %o", e.hash, err);
                        }
                        else
                        {
                            sendToken(instance);
                        }
                    })
                }
                else{
                    mTransaction.find({ where: { EmiterWallet: e.from, Nonce: e.nonce }}, function(err, instances) {
                        if (err) {
                            console.log("Error occurs when find transaction in table(for input transaction hash: %s) for mising token send, error: %o", e.hash, err);
                        }
                        else
                        {
                            if (instances.length != 1) {
                                console.log("Many instance found (%d) when find transaction in table(for input transaction hash: %s) for mising token send, error: %o", e.hash, err);
                            }
                            else {
                                sendToken(instances[0]);
                            }
                        }
                    })
                }
            })
        }

        function sendToken(instance) {
            tokenContractInstance.transfer(instance.EmiterWallet, instance.NbToken, function(err, thash) {
                if (!err) {
                    web3.eth.getTransaction(thash, function(err, trans){
                        if(err){
                            console.log("Error: web3.eth.getTransaction() return an error after send/deploy transaction (transaction hash: %s) error: %o", thash, err);
                        }
                        else {
                            console.log("Tokens sended to: %s, transaction hash: %s", trans.to, trans.hash);
                            // update transaction table
                            instance.updateAttributes( { "OutTransactionHash": trans.hash, "NonceOut": trans.nonce, "DateTimeOut": (new Date()).toUTCString(), "NbToken": instance.NbToken / Math.pow(10, decimal) }, function (err, instance) {
                                if (err) {
                                    console.log("Error: can't update transaction table after transaction hash: %s is mined, error: %o", trans.hash, err);
                                }
                            })
                        }
                    })
                }
                else {
                    console.log("send token to wallet %s for %f tokens from input transaction %s error: %o", instance.EmiterWallet, instance.NbToken, instance.InTransactionHash, err);
                }
            })

        }

        function checkTransaction(bcTransIn , bcTransOut, procTrans, tokenContractInstance){
/*            
            1 Toute transaction entrée Block Chaine      A Toute Transaction sortie Blockchaine
            2 = 1 - table => transaction entrée manquante table => les traiter en derniers
            3 = 1 - 2 = Toute transaction entrée block chaine deja traitée
            B = A - filtre toutes transaction de sortie non renseigné en table
            5 = 3 - filtre Transaction sortie hash manquante => table incompléte
            6 = 5 matching B => renseigne la table avec les transactions emises
            7 = 5 - transaction matching trouvé en 6 => transaction de sortie non emise
*/

            // 2 On selectione les transactions de reception d'ethereum manquantes dans la table
            var missingTransactionIn = bcTransIn.filter(bcTin => procTrans.every(pT => !(pT.EmiterWallet === bcTin.from && pT.InTransactionHash === bcTin.hash)));
            // 3 On selectione toutes les transactions de reception d'ethereum qui ont été detectées
            var InTableTransactionIn = bcTransIn.filter(bcTin => missingTransactionIn.every(mti => !(mti.from === bcTin.from && mti.hash === bcTin.hash)));
            // 5 on selectione toutes les transaction de reception d'ethereum detectées qui n'ont pas de transaction d'emmissions de token renseignées
            var missingTokenInfo = InTableTransactionIn.filter(bcTin => procTrans.some(pT => (pT.EmiterWallet === bcTin.from && pT.InTransactionHash == bcTin.hash && pT.NonceIn === bcTin.nonce && pT.OutTransactionHash === undefined)));
            
            // B on selectione toutes les transactions d'emission de token qui ne sont pas dans la table
            var missingTransOutInTable = bcTransOut.filter(bcTout => procTrans.every(pT => !(pT.EmiterWallet === bcTout.to && pT.OutTransactionHash === bcTout.hash)));
/*
            // on match les transaction de token emises qui ne sont pas dans la table mais sont sur la blockchain (transaction d'envois de token emise mais non rensignées en table)
            var newTableMatching;
            if (missingTransOutInTable.length > 0) {
                console.log("checkTransaction found %d missing processed transaction out (token sent) in table", missingTransOutInTable.length);
                displayTransactionFrom(missingTransOutInTable);
                missingTransOutInTable.forEach(function(t) {
                    mTransaction.find( { where: { EmiterWallet: t.to, OutTransactionHash: undefined }}, function(err, instances) {
                        if (err) {
                            console.log("Error: can't find transaction in table for EmiterWallet: %s and OutTransactionHash: null during checkTransaction, error: %o", t.to, err);
                        }
                        else {
                            displayTransactionTable(instances);
                            var instanceSelected = null;
                            if (instances.length > 1) {
                                console.log("Many instance found (%d) when find transaction in table (for outpout transaction hash: %s) for mising token send table update, select one", instances.length, t.hash);
                                instanceSelected = instances[0]; // need to be improved
                            }
                            else if ( instances.length === 1){
                                instanceSelected = instances[0];
                            }
                            if (instanceSelected !== null) {
                                instanceSelected.updateAttributes( { "OutTransactionHash": t.hash, "NonceOut": t.nonce, "NbToken": instance.NbToken * Math.pow(10, decimal), "DateTimeOut": (new Date()).toUTCString() }, function (err, instance) {
                                    if (err) {
                                        console.log("Error: can't update transaction table for out transaction hash: %s during checkTransaction, error: %o", t.hash, err);
                                    }
                                    else {
                                        newTableMatching.push(instance);
                                    }
                                })
                            }
                            else{
                                console.log("Can't find any transaction in table who match EmiterWallet: %s and OutTransactionHash: null during checkTransaction", t.to);
                            }
                        }
                    })
                })
                console.log("need to launch CheckandFix again when this update are finished");
                return;
            }

            // on retire les transactions matchées aux transactions non renseignée
            var missingTokenSend = missingTransOutInTable.filter(mto => newTableMatching.every(ntm => !(mto.EmiterWallet === ntm.EmiterWallet && mto.InTransactionHash == ntm.InTransactionHash)));
            if (missingTokenSend.length > 0){
                console.log("checkTransaction found %d missing Token transaction sending for received ethereum", missingTokenSend.length);
                sendTokenForTransaction(missingTokenSend, tokenContractInstance, [], true);
            }
*/
            // On check si il manque le traitement de reception d'ethereum (rien dans la table concernant une reception d'ethereum)
            var missingTransactionIn = bcTransIn.filter(bcTin => procTrans.every(pT => !(pT.EmiterWallet === bcTin.from && pT.InTransactionHash === bcTin.hash)));
            if (missingTransactionIn.length > 0) {
                console.log("checkTransaction found %d missing processed transaction in (ethreum received)", missingTransactionIn.length);
                sendTokenForTransaction(missingTransactionIn, tokenContractInstance, procTrans, false);
                console.log("checkTransaction added %d missing processed transaction in (ethreum received)", missingTransactionIn.length);
                console.log("--------------------------------------------------------------------------------------");
            }
        }

        // inits for blockchain scan
        var startBlock = 0;
        var lastBlock = 0;
        var NbBlockTransactionConfirmation = params[0].NbBlockTransactionConfirmation;
        var totalToken = params[0].NbTotalToken;
        var totalTokenToSend = params[0].NbTokenToSell;
        var ethereumReceived = 0;

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
            ethereumReceived = params[0].NbEthereum;
        }

        var balance = tokenContractInstance.balanceOf(ICOWalletAdresse);
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

        function IntervalProcess(procTrans, checkMode)
        {
            if (cronStarted) {
                balance = tokenContractInstance.balanceOf(ICOWalletAdresse);
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
                        var transactionsER = getTransactionsOfAccount(ICOWalletAdresse, startBlock, lastBlock, false);
                        var transactionsR = getTransactionsOfAccount(ICOWalletAdresse, lastBlock + 1, web3.eth.blockNumber, true);
                        var transactions = [];
                        transactions.push(transactionsER[0].concat(transactionsR[0]));
                        transactions.push(transactionsER[1].concat(transactionsR[1]));

                        // display transaction received
                        console.log("Transaction reçu: %d, transaction emises: %d", transactions[1].length, transactions[0].length);
                        displayTransactionTo(transactions[1]);
                        console.log("============================================================================");
                        displayTransactionFrom(transactions[0])
                        
                        checkTransaction(transactions[1], transactions[0], procTrans, tokenContractInstance);
                        console.log("Check transaction process finished!")
                        balance = tokenContractInstance.balanceOf(ICOWalletAdresse);
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
                            var transactions = getTransactionsOfAccount(ICOWalletAdresse, startBlock, lastBlock, false);
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
                                    console.log("error: Unable to update LastProcessedBlock: %O", err);
                                }
                            });        
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
