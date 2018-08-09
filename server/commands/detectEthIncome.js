"use strict"

// required
const Web3		= require("web3");
const Solc		= require("solc");
const Fs		= require("fs");
const abiDecoder= require("abi-decoder");
const Async		= require("async");
const path		= require('path');
const logger    = reqlocal('/server/boot/winston.js').logger;
const config	= require( path.join(__dirname, '../config' + (process.env.NODE_ENV!=='development' ? ('.'+process.env.NODE_ENV) : '') + '.json') );
const request   = require('superagent');

var appname;
var mParam;
var mParamBackup;
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
    mParamBackup = _server.models.ParamBackup;
    mTransaction = _server.models.transaction;
};

DetectEthereumIncome.prototype.Init = function (cb, checkMode) {
    logger.info(appname + ': Init DetectEthereumIncome...');

    // connection to local node
    // set the provider you want from Web3.providers
    var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8101"));  
  
    // we compile the contract source code for have the contract abi  
    let source = Fs.readFileSync('server/commands/SecureSwapToken.sol', 'utf8');
    let compiledContract = Solc.compile(source, 1);
    if (compiledContract.errors != undefined)
    {
        logger.error("Error or warning during contract compilation: " + JSON.stringify(compiledContract.errors));
        return cb("Error or warning during contract compilation: " + JSON.stringify(compiledContract.errors));
    }
  
    // get contract abi  
    let abi = JSON.parse(compiledContract.contracts[':SecureSwapToken'].interface);

    abiDecoder.addABI(abi);

    mParam.find(function(err, params) {
        if (err){
            logger.error("Erreur occurs when reading Param table, error: %o", JSON.stringify(err));
            return;
        }
        ParamsReceived(params, cb, checkMode);
    });
    
    function ParamsReceived(params, cb, checkMode) {
        if (params.length === 0)
        {
            logger.error("Wallet for initial token owner not defined !");
            return;
        }
        // wallet adresse & private key and contract transaction hash used for create the token
        var ICOWalletEthereumAddress = undefined;
        var ICOWalletTokenAddress = undefined;
        if (params.length !== 0) {
            ICOWalletEthereumAddress = params[0].ICOWalletEthereumAddress;
            ICOWalletTokenAddress = params[0].ICOWalletTokenAddress;
            logger.info("Inital token owner is: " + ICOWalletTokenAddress + " ethereum receiver: " + ICOWalletEthereumAddress);
        }
        if (ICOWalletTokenAddress === "" || ICOWalletTokenAddress === undefined || ICOWalletTokenAddress === null || ICOWalletEthereumAddress === "" || ICOWalletEthereumAddress === undefined || ICOWalletEthereumAddress === null) {
            logger.error("Wallets for initial token owner not defined !");
            return;
        }
    
        var tokenContractTransactionHash = params[0].TokenContractTransactionHash;
        if (tokenContractTransactionHash === "" || tokenContractTransactionHash === undefined) {
            logger.error("Token smart contract transaction hash not defined !");
            return;
        }
        web3.eth.defaultAccount = ICOWalletTokenAddress;
        var ethereumPrice = web3.toBigNumber(params[0].USDEthereumPrice);
        var tokenPriceUSD = web3.toBigNumber(params[0].USDTokenPrice);
        var tokenPriceEth = tokenPriceUSD.dividedBy(ethereumPrice);
        var transactionGaz = params[0].TransactionGaz;
        var gazPrice = web3.toWei(params[0].GazPice,'gwei');
        var icoState = 1;
        if (params[0].dateStart < new Date().toUTCString())
        {
            icoState += 1;
        }
        if (params[0].dateEnd < new Date().toUTCString())
        {
            icoState += 1;
        }

        if (tokenPriceEth.toNumber() === 0) {
            logger.error("Token price not correctly defined !, Etherum USD Price: " + ethereumPrice.toNumber() + "Token USD price: " + tokenPriceUSD.toNumber(), null);
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

        var decimal = tokenContractInstance.decimals();

        icoState = 2;
        sendParams('sswp', 's', 'setState', { "state": icoState }, (err, responseTxt) => {
        });

        // get all transactions of an account (*from*/to) between start and end block
        function getTransactionsOfAccount(myaccount, startBlockNumber, endBlockNumber, onlyTokenSend) {
            if (endBlockNumber == null) {
                endBlockNumber = eth.blockNumber;
                logger.info("Using endBlockNumber: " + endBlockNumber);
            }
            if (startBlockNumber == null) {
                startBlockNumber = endBlockNumber - 1000;
                logger.info("Using startBlockNumber: " + startBlockNumber);
            }
            logger.info("Searching for transactions to/from account \"" + myaccount + "\" within blocks "  + startBlockNumber + " and " + endBlockNumber);
        
            var toSCTransactionsArray = [];
            var fromSenderTransactionsArray = [];
        
            // parse block range
            for (var b = startBlockNumber; b <= endBlockNumber; b++) {
                if (b % 10 == 0) {
                    logger.info("Parsing block range: " + b + " to block: " + Math.min(endBlockNumber, b + 9));
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
                logger.info(" Received: " + web3.fromWei(e.value, 'ether').toFixed(8) + " Eth from " + e.from + " tx hash: " + e.hash);
            });
        }

        // display transactions
        function displayTransactionFrom(transactions) {
            transactions.forEach( function(e) {
                const decodedData = abiDecoder.decodeMethod(e.input);
                logger.info(" Call smart contrat function: " + decodedData.name + " for send " + decodedData.params[1].value / Math.pow(10, decimal) + " Token to " + decodedData.params[0].value + " and " + web3.fromWei(e.value, 'ether').toFixed(8) + " Eth, tx hash: " + e.hash );
            });
        }

        // display transaction int table
        function displayTransactionTable(transactions) {
            transactions.forEach( function(e){
                logger.info("Emitter: " + e.EmiterWallet + " NonceIn: " + e.NonceIn + " DateTimeIn: " + e.DateTimeIn + " InTransactionHash: " + e.InTransactionHash + " NbEthereum: " + e.NbEthereum + " OutTransanctionHash: " + e.OutTransactionHash + " NonceOut: " + e.NonceOut + " NbToken: " + e.NbToken + " DateTimeOut: " + e.DateTimeOut);
            });
        }

        function sendTokenForTransaction(transactions, tokenContractInstance, procTrans, missingToken){
            var notProcessedTrans = transactions.filter(item => procTrans.every(cItem => !(cItem.EmiterWallet === item.from && cItem.InTransactionHash === item.hash)));

            getCoinMarketCapId("Ethereum", (err, id) => {
                if (id === null || id === -1)
                {
                    id = 1027;
                }
        
                getCotation(id, (err, cotation) => {
                    if (cotation) {
                        ethereumPrice = web3.toBigNumber(cotation.data.quotes.USD.price);
                        tokenPriceEth = tokenPriceUSD.dividedBy(ethereumPrice);
                    }

                    Async.forEach(notProcessedTrans, function(e) {
                        var nbEth = web3.fromWei(e.value, 'ether');
                        logger.info(" received: " + nbEth.toFixed(8) + " Eth from " + e.from + " tx hash: " + e.hash);
                        var nbTokenToTransfert = nbEth.dividedBy(tokenPriceEth);
                        var nbTokenUnitToTransfert = nbTokenToTransfert.times(Math.pow(10, decimal));
                        logger.info(" -> Send: " + nbTokenToTransfert.toNumber().toFixed(8) + " SSWT to " + e.from);

                        if (!missingToken) {
                            ethereumReceived += nbEth.toNumber();
                            nbTokenSold += nbTokenToTransfert.toNumber();
                        }

                        params[0].updateAttributes( { "NbEthereum" : ethereumReceived, "NbTokenSold": nbTokenSold, "USDEthereumPrice": ethereumPrice.toNumber() }, function (err, instance) {
                            if (err) {
                                logger.error("error: Unable to update NbEthereum/NbTokenSold of Param table: " + JSON.stringify(err));
                            }
                        });        

                        var paramsUpdated = {
                            state:          icoState,
                            ethReceived:    nbEth,
                            ethTotal:       ethereumReceived,
                            tokensSold:     nbTokenSold
                        }
                        sendParams('sswp', 's', 'setReceivedEth', paramsUpdated, (err, responseTxt) => {
                            if (err) return err;
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
                            logger.error("Error occurs during async.forEach for sendTokenForTransaction:" + JSON.stringify(err));
                        }
                    });
                });
            });
        }

        function transCreateCB(nbToken, err, instance) {
            if (err) {
                logger.error("Error occurs when adding transaction in table(for input transaction hash: " + e.hash + ") error: " + JSON.stringify(err));
            }
            else
            {
                sendToken(instance, nbToken);
            }
        }

        function transUpdateCB(nbToken, err, instances) {
            if (err) {
                logger.error("Error occurs when find transaction in table(for input transaction hash: " + e.hash + ") for mising token send, error: " + JSON.stringify(err));
            }
            else
            {
                if (instances.length != 1) {
                    logger.error("Many instance found (" + instances.length + ") when find transaction in table(for input transaction hash: " + e.hash + ") for mising token send");
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
                            logger.error("Error: web3.eth.getTransaction() return an error after send/deploy transaction (transaction hash: " + thash + ") error: " + JSON.stringify(err));
                        }
                        else {
                            logger.info("Tokens sended to: " + trans.to + " transaction hash: " + trans.hash);

                            // update transaction table
                            instance.updateAttributes( { "OutTransactionHash": trans.hash, "NonceOut": trans.nonce, "DateTimeOut": (new Date()).toUTCString(), "NbToken": nbToken.dividedBy(Math.pow(10, decimal)).toNumber() }, function (err, instance) {
                                if (err) {
                                    logger.error("Error: can't update transaction table after transaction hash: " + trans.hash + " is mined, error: " + JSON.stringify(err));
                                }
                            })
                        }

                        var walletToken = tokenContractInstance.balanceOf(instance.EmiterWallet);
                        var adjustedBalance = walletToken.dividedBy(Math.pow(10, decimal)).toNumber();
                        logger.info("Wallet " + instance.EmiterWallet + " contains " + adjustedBalance + " Tokens");
        
                    })
                }
                else {
                    logger.info("send token to wallet " + instance.EmiterWallet + " for " + nbToken.dividedBy(Math.pow(10, decimal)).toNumber() + " tokens from input transaction " + instance.InTransactionHash + " error: " + JSON.stringify(err));
                }
            })
        }

        function checkTransaction(bcTransIn , bcTransOut, procTrans, tokenContractInstance){
            // On selectione les transactions de reception d'ethereum manquantes dans la table
            var missingTransactionIn = bcTransIn.filter(bcTin => procTrans.every(pT => !(pT.EmiterWallet === bcTin.from && pT.InTransactionHash === bcTin.hash)));
            // On selectione toutes les transactions de reception d'ethereum qui ont été detectées
            var InTableTransactionIn = bcTransIn.filter(bcTin => missingTransactionIn.every(mti => !(mti.from === bcTin.from && mti.hash === bcTin.hash)));
            // on selectione toutes les transactions d'emission de token qui ne sont pas renseignées dans la table (OutTransactionHash non renseignée)
            var missingTransOutInTable = bcTransOut.filter(function(value){
                const decodedData = abiDecoder.decodeMethod(value.input);
                return procTrans.every(pT => !(pT.EmiterWallet === decodedData.params[0].value && pT.OutTransactionHash == value.hash));
            });

            // on check les transaction receipt de chaqu etransaction d'envois de token
            bcTransOut.forEach(function(t){
                const decodedData = abiDecoder.decodeMethod(t.input);
                var transactionReceipt = web3.eth.getTransactionReceipt(t.hash);
                logger.info("Decoded data " + decodedData + " transaction Receipt: " + transactionReceipt);
            });

            // on match les transaction de token emises qui ne sont pas dans la table mais sont sur la blockchain (transaction d'envois de token emise mais non renseignées en table)
            if (missingTransOutInTable.length > 0) {
                logger.info("checkTransaction found " + missingTransOutInTable.length + " missing processed transaction out (token sent) in table");
                Async.forEach(missingTransOutInTable, function(t) {
                    const decodedData = abiDecoder.decodeMethod(t.input);
                    for (var i = 0; i < procTrans.length; ++i) {
                        if (decodedData.params[0].value === procTrans[i].EmiterWallet && decodedData.params[1].value == procTrans[i].NbToken && procTrans[i].OutTransactionHash === undefined) {
                            procTrans[i].updateAttributes( { "OutTransactionHash": t.hash, "NonceOut": t.nonce, "NbToken": decodedData.params[1].value / Math.pow(10, decimal), "DateTimeOut": (new Date()).toUTCString() }, function (err, instance) {
                                if (err) {
                                    logger.error("Error: can't update transaction table for out transaction hash: " + t.hash + " during checkTransaction, error: " + JSON.stringify(err));
                                }
                            })
                            break;
                        }
                    }
                }, function(err) {
                    if(err)
                    {
                        logger.error("Error " + JSON.stringify(err) + " occurs during async.forEach on missingTransOutInTable");
                    }
                });
            }

            // on selectione toutes les transaction de reception d'ethereum detectées qui n'ont pas de transaction d'emmissions de token renseignées
            var missingTokenSend = InTableTransactionIn.filter(bcTin => procTrans.some(pT => (pT.EmiterWallet === bcTin.from && pT.InTransactionHash == bcTin.hash && pT.NonceIn === bcTin.nonce && pT.OutTransactionHash === undefined)));
            if (missingTokenSend.length > 0){
                logger.info("checkTransaction found " + missingTokenSend.length + " missing Token transaction sending for received ethereum");
                sendTokenForTransaction(missingTokenSend, tokenContractInstance, [], true);
            }

            // On check si il manque le traitement de reception d'ethereum (rien dans la table concernant une reception d'ethereum)
            if (missingTransactionIn.length > 0) {
                logger.info("checkTransaction found " + missingTransactionIn.length + " missing processed transaction in (ethreum received)");
                sendTokenForTransaction(missingTransactionIn, tokenContractInstance, procTrans, false);
                logger.info("checkTransaction added " + missingTransactionIn.length + " missing processed transaction in (ethreum received)");
                logger.info("--------------------------------------------------------------------------------------");
            }
            if (missingTransactionIn.length === 0 && missingTransOutInTable.length === 0 && missingTokenSend.length === 0) {
                logger.info("checkTransaction finished with no error found!");
            }
        }

        /**
        * Récupère la cotation d'une crypto sur CoinMarketCap, en USD et en EUR
        */
       
        function getCotation(cryptoId, cb) {
            var url = 'https://api.coinmarketcap.com/v2/ticker/' + cryptoId + '/?convert=EUR';
            request
            .get(url)
            .query({convert: 'EUR'})
            .end((err, res) => {
                if (err) return cb(err, null);
                if (res.body && !res.error && res.statusCode===200 && res.text && res.text.length>0) {
                    return cb(null, JSON.parse(res.text));
                } else {
                    return cb('request() error. url:' + url, null);
                }
            });
        }

        /**
        * Get crypto CoinMarketCap id
        */
        function getCoinMarketCapId(cryptoName, cb) {
            var url = 'https://api.coinmarketcap.com/v2/listings/';
            request
            .get(url)
            .end((err, res) => {
                if (err) return cb(err, null);
                if (res.body && !res.error && res.statusCode===200 && res.text && res.text.length>0) {
                    var rep = JSON.parse(res.text);
                    var id = -1;
                    rep.data.forEach(function(element) {
                        if (element.name === cryptoName)
                        {
                            id = Number(element.id);
                        }
                    });
                    return cb(null, id);
                } else {
                    return cb('request() error. url:' + url, null);
                }
            });
        }

        /**
         * Get a valid token
         */
        function login(login, pass, cb) {
            const url = 'http://localhost:3000/login';
            request
            .post(url)
            .send({username: login, password: pass})
            .end((err, res) => {
                if (err) return cb(err);
                if (res.body && !res.error && res.statusCode===200) {
                    return cb(null, res.body.accessToken);
                } else {
                    return cb('request() error. url:' + url, null);
                }
            });
        }
   
        /**
         * Send data on public website API
         */
        function sendParams(log, pass, api, params, cb) {
            // first : login and get a valid token
            login(log, pass, (err, tokenId) => {
                // second : send data
                const url = 'http://localhost:3000/api/ICOs/' + api;
                request
                .post(url)
                .send({tokenId: tokenId, params: params})
                .end((err, res) => {
                    if (err) return cb(err);
/*
                    if (res.body && !res.error && res.statusCode===200 && res.text && res.text.length>0) {
                        return cb(null, JSON.parse(res.text));
                    }
                    else {
                        return cb('request() error. url:' + url, null);
                    }
*/			
                });
            });
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
        var adjustedBalance = balance.dividedBy(Math.pow(10, decimal)).toNumber();
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
                    gas: transactionGaz,
                    gasPrice: gazPrice,
                    from: ethOwner,
                    to: ethDestinataire, 
                    value: eth
                }
        
                web3.eth.sendTransaction(tx, function(err, transactionHash){
                    if (!err){
                        logger.info("--- secure ethereum transaction " + transactionHash + " submited!");
                    }
                    else{
                        logger.error("*** secure ethereum erreur " + JSON.stringify(err));
                    return;
                    }
                });
                logger.info("Secure Ethereum by sending transaction from " + ethOwner + " to " + ethDestinataire + " for " + web3.fromWei(eth, "ether").toNumber() + " ether");
            }
            catch(err){
              logger.error("Exception during function transfertEthereum: " + JSON.stringify(err));
            }
            finally{
              logger.info('-----------------------------------------------------------------------------------');
            }
        }

        function IntervalProcess(procTrans, checkMode)
        {
            if (cronStarted) {
                balance = tokenContractInstance.balanceOf(ICOWalletTokenAddress);
                adjustedBalance = balance / Math.pow(10, decimal);
                
                if (checkMode) {
                    logger.info("Before correction: ICO Etherum received: " + ethereumReceived.toFixed(6) + ", token left to sell: " + adjustedBalance - (totalToken - totalTokenToSend));
                }
                else {
                    logger.info("ICO Etherum received: " + ethereumReceived.toFixed(6) + ", token left to sell: " + (adjustedBalance - (totalToken - totalTokenToSend)));
                }

                if (adjustedBalance <= (totalToken - totalTokenToSend) && checkMode == false) {
                    icoState = 3;
                    sendParams('sswp', 's', 'setState', { "state": icoState }, (err, responseTxt) => {});

                    logger.info("ICO hard cap reached !, token left: " + adjustedBalance + ", Ethereum gain: " + ethereumReceived.toFixed(6) );
                }
                if (checkMode) {
                    logger.info("Check transactions from block " + startBlock + " to block " + lastBlock);

                    // get transaction of account toAdresse from block startBlock to lastBlock
                    var transactionsER = getTransactionsOfAccount(ICOWalletTokenAddress, startBlock, lastBlock, false);
                    var transactionsR = getTransactionsOfAccount(ICOWalletTokenAddress, lastBlock + 1, web3.eth.blockNumber, true);
                    var transactions = [];
                    transactions.push(transactionsER[0].concat(transactionsR[0]));
                    transactions.push(transactionsER[1].concat(transactionsR[1]));

                    checkTransaction(transactions[1], transactions[0], procTrans, tokenContractInstance);
                    logger.info("Check transaction process finished!")
                    balance = tokenContractInstance.balanceOf(ICOWalletTokenAddress);
                    adjustedBalance = balance / Math.pow(10, decimal);
                    logger.info("After correction: ICO Etherum received: %f, token left to sell: %f", ethereumReceived.toFixed(6), adjustedBalance - (totalToken - totalTokenToSend));
                    cronStarted = false;
                    clearInterval(cron);
                    initCalled = false;
                }
                else {
                    var newLastBlock = web3.eth.blockNumber;
                    logger.info("new blocks: " + (newLastBlock - lastBlock) + ", nb confirmation block: " + NbBlockTransactionConfirmation);

                    if ( (newLastBlock - NbBlockTransactionConfirmation) > lastBlock)
                    {
                        lastBlock = Math.min(newLastBlock - NbBlockTransactionConfirmation, lastBlock + 100);

                        // get transaction of account toAdresse from block startBlock to lastBlock
                        var transactions = getTransactionsOfAccount(ICOWalletTokenAddress, startBlock, lastBlock, false);
                        startBlock = lastBlock + 1;

                        // display transaction received
                        logger.info("Reception Eth Transaction: " + transactions[1].length + ", Sent token transaction: " + transactions[0].length);
                        displayTransactionTo(transactions[1]);
                        logger.info("============================================================================");
                        displayTransactionFrom(transactions[0])

                        // Send token to investors
                        sendTokenForTransaction(transactions[1], tokenContractInstance, procTrans, false);

                        params[0].updateAttributes( { "LastProcessedBlock" : lastBlock }, function (err, instance) {
                            if (err) {
                                logger.error("error: Unable to update LastProcessedBlock: " + JSON.stringify(err));
                            }
                        });        

                        if (ICOWalletTokenAddress !== ICOWalletEthereumAddress) {
                            var ethAmount = Math.floor(web3.fromWei(web3.eth.getBalance(ICOWalletTokenAddress), "ether")-0.1);
                            if (ethAmount >= 1) {
                                transfertEthereum(ICOWalletTokenAddress, ICOWalletEthereumAddress, web3.toBigNumber(web3.toWei(ethAmount, "ether")));
                            }
                        }
                    }
                }
            }
        }
    }
}

DetectEthereumIncome.prototype.ParamBackup = function (cb) {
    logger.info(appname + ': Init Backup Params table...');

	// get parameters from table Param
	mParam.find(function(err, param) {
		if (err || param.length === 0) {
			    logger.error("Table Param empty, backup can't be done!");
		}
		else
		{
            mParamBackup.create({ ICOWalletTokenAddress: param[0].ICOWalletTokenAddress, ICOWalletEthereumAddress: param[0].ICOWalletEthereumAddress, TransactionGaz: param[0].TransactionGaz, 
                GazPice: param[0].GazPice, TokenContractTransactionHash: param[0].TokenContractTransactionHash, NbTokenToSell: param[0].NbTokenToSell, NbTotalToken: param[0].NbTotalToken, 
                USDTokenPrice: param[0].USDTokenPrice, USDEthereumPrice: param[0].USDEthereumPrice, NbTokenSold: param[0].NbTokenSold, NbEthereum: param[0].NbEthereum, LastProcessedBlock: param[0].LastProcessedBlock, 
                BlockTokenStart: param[0].BlockTokenStart, NbBlockTransactionConfirmation: param[0].NbBlockTransactionConfirmation}, (err, instance) => {
                if (err) {
                    logger.error("Error occurs when backup table Param error: " + JSON.stringify(err));
                    return cb("Error occurs when backup table Param error: " + JSON.stringify(err), null);
                }
            });
		}
	});
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

DetectEthereumIncome.prototype.BackupParams = function (cb) {
    detectEthereumIncomeInstance.ParamBackup(cb);
    return cb(null, "Backup params table!"); 
}
