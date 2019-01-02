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
const math      = require("mathjs");
const moment    = require('moment');


var appname;
var mParam;
var mParamBackup;
var mTransaction;
var mReferrer;

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
    mTransaction = _server.models.Transaction;
    mReferrer = _server.models.Referrer;
};

DetectEthereumIncome.prototype.Init = function (cb, checkMode) {
    logger.info(appname + ': Init DetectEthereumIncome...');

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
            logger.error( new Date().toString() + ": param.length = 0, no record on the table Param !");
            return;
        }
        // wallet adresse & private key and contract transaction hash used for create the token
        var tokenContractAddress = params[0].TokenContractAddress;
        var ICOWalletEthereumAddress = params[0].ICOWalletEthereumAddress;
        var ICOWalletTokenAddress = params[0].ICOWalletTokenAddress;
        var ICOWalletDiscount1Address = params[0].ICOWalletDiscount1Address;
        var ICOWalletDiscount2Address = params[0].ICOWalletDiscount2Address;
        var Discount1Factor = params[0].Discount1Factor;
        var Discount2Factor = params[0].Discount2Factor;
        var icoDateStart = moment.utc(params[0].IcoDateStart);
        var icoDateEnd = moment.utc(params[0].IcoDateEnd);
        var icoState = 1;

        logger.info("Inital token owner is: " + ICOWalletTokenAddress + " ethereum receiver: " + ICOWalletEthereumAddress + " ICOWalletDiscount1Address: " + ICOWalletDiscount1Address + " ICOWalletDiscount2Address: " + ICOWalletDiscount2Address + " Discount1Factor: " + Discount1Factor + " Discount2Factor: " + Discount2Factor, + " IcoDateStart:" + new Date(icoDateStart).toUTCString() + " IcoDateStop:" + new Date(icoDateEnd).toUTCString());
        
        if (ICOWalletTokenAddress === "" || ICOWalletTokenAddress === undefined || ICOWalletTokenAddress === null || ICOWalletEthereumAddress === "" || ICOWalletEthereumAddress === undefined || ICOWalletEthereumAddress === null || 
            ICOWalletDiscount1Address === "" || ICOWalletDiscount1Address === undefined || ICOWalletDiscount1Address === null || ICOWalletDiscount2Address === "" || ICOWalletDiscount2Address === undefined || ICOWalletDiscount2Address === null) {
            logger.error("Wallets for initial token owner not defined !");
            return;
        }
        if (Discount1Factor === undefined || Discount1Factor === 0.0 || Discount2Factor === undefined || Discount2Factor === 0.0) {
            logger.error("Discount factor for referral undefined !");
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

        // check validity of contractAddresse
        if (tokenContractAddress !== transactionReceipt.contractAddress)
        {
            logger.error("Problem with smart-contrat, contract address on params table is not the same we get by transactionReceipt!");
            return;
        }

        // get contract instance
        var tokenContractInstance = tokenContract.at(transactionReceipt.contractAddress);
        if (tokenContractInstance === null || tokenContractInstance === undefined) {
            logger.error("Problem with smart-contrat, instance value can be obtened, check token contract deploy and contrat transaction hash on Param table!");
            return;
        }

        var decimal = tokenContractInstance.decimals();

        // get all transactions of an account (*from*/to) between start and end block
        function getTransactionsOfAccount(iCOWalletTokenAddress, iCOWalletDiscount1Address, iCOWalletDiscount2Address, startBlockNumber, endBlockNumber, onlyTokenSend) {
            if (endBlockNumber == null) {
                endBlockNumber = eth.blockNumber;
                logger.info("Using endBlockNumber: " + endBlockNumber);
            }
            if (startBlockNumber == null) {
                startBlockNumber = endBlockNumber - 1000;
                logger.info("Using startBlockNumber: " + startBlockNumber);
            }
            logger.info("Searching for transactions to/from account \"" + ICOWalletTokenAddress + "\" within blocks "  + startBlockNumber + " and " + endBlockNumber);
        
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
                        if (e.to !== null && (iCOWalletTokenAddress.toLowerCase() === e.to.toLowerCase() || iCOWalletDiscount1Address.toLowerCase() === e.to.toLowerCase() || iCOWalletDiscount2Address.toLowerCase() === e.to.toLowerCase()) && onlyTokenSend === false) {
                            fromSenderTransactionsArray.push(e);
                        }
                        
                        // account is emiter of transaction
                        if (iCOWalletTokenAddress.toLowerCase() == e.from.toLowerCase()) {
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
    
        function SendIcoState(IcoDateStart, IcoDateEnd, first)
        {
            var newIcoState = 1;
            var aMinuteAgo = moment().add(60, 'seconds');
            var dateActual = moment();
            if (aMinuteAgo.isAfter(IcoDateStart))
            {
                newIcoState += 1;
            }
            if (dateActual.isAfter(IcoDateStart))
            {
                newIcoState += 1;
            }
            if (dateActual.isAfter(IcoDateEnd))
            {
                newIcoState += 1;
            }

            if (newIcoState != icoState || first)
            {
                icoState = newIcoState;
                var cta = icoState > 1 ? transactionReceipt.contractAddress : "";
                sendParams('setState', { "state": icoState, contractAddress: cta}, (err, responseTxt) => {});
            }
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

        function sendTokenForTransaction(transactions, procTrans, missingToken){
            var notProcessedTrans = transactions.filter(item => procTrans.every(cItem => !(cItem.EmiterWallet === item.from && cItem.InTransactionHash === item.hash)));

            getCoinMarketCapId("Ethereum", (err, id) => {
                if (id === null || id === -1)
                {
                    id = 1027;
                    logger.error("Can't get Ethereum Id from coinmarketcap, use 1027 by default");
                }
        
                getCotation(id, (err, cotation) => {
                    if (cotation) {
                        ethereumPrice = web3.toBigNumber(cotation.data.quotes.USD.price);
                        tokenPriceEth = tokenPriceUSD.dividedBy(ethereumPrice);
                    }
                    else {
                        logger.error("Can't get ethereum price from coinmarketcap, use last known price of: " + ethereumPrice.toNumber());
                    }


                    Async.forEach(notProcessedTrans, function(e) {
                        var nbEth = web3.fromWei(e.value, 'ether');
                        logger.info(" received: " + nbEth.toFixed(8) + " Eth from " + e.from + " tx hash: " + e.hash);
                        var discountFactor = 1.0;
                        if (e.to === ICOWalletDiscount1Address) {
                            discountFactor = Discount1Factor;
                        }
                        else if (e.to === ICOWalletDiscount2Address)
                        {
                            discountFactor = Discount2Factor;
                        }
                        var ajustedTokenPrice = web3.toBigNumber(tokenPriceEth * discountFactor);
                        var nbTokenToTransfert = nbEth.dividedBy(ajustedTokenPrice);
                        var nbTokenUnitToTransfert = nbTokenToTransfert.times(Math.pow(10, decimal));

                        if (nbEth < 0.1 || icoState === 4) {
                            nbTokenToTransfert = web3.toBigNumber(0);
                            nbTokenUnitToTransfert = web3.toBigNumber(0);
                        }

                        logger.info(" -> Send: " + nbTokenToTransfert.toNumber().toFixed(8) + " SSW to " + e.from + " with discount factor: " + discountFactor);

                        if (!missingToken) {
                            if (nbEth > 0.1 && icoState !== 4) {
                                ethereumReceived += nbEth.toNumber();
                                nbTokenSold += nbTokenToTransfert.toNumber();
                            }
                            else {
                                var retEth = nbEth - web3.fromWei(transactionGaz * gazPrice, 'ether');
                                var retWei = web3.toWei(retEth, 'ether');
                                returnEthereum(e.to, e.from, retWei);
                            }
                        }

                        params[0].updateAttributes( { "NbEthereum" : ethereumReceived, "NbTokenSold": nbTokenSold, "USDEthereumPrice": ethereumPrice.toNumber()}, function (err, instance) {
                            if (err) {
                                logger.error("error: Unable to update NbEthereum/NbTokenSold of Param table: " + JSON.stringify(err));
                            }
                        });        

                        if (nbTokenUnitToTransfert > 0) {
                            var paramsUpdated = {
                                state:          icoState,
                                ethReceived:    nbEth,
                                tokensSend:     nbTokenToTransfert,
                                ethTotal:       ethereumReceived,
                                tokensSold:     nbTokenSold,
                                tokenPriceUSD:	tokenPriceUSD.toNumber(),
                                tokenPriceETH:	tokenPriceEth.toNumber(),
                                discount:       discountFactor
                            }
                            sendParams('setReceivedEth', paramsUpdated, (err, responseTxt) => {
                                if (err) {
                                    logger.error("Error occurs during setReceivedEth:" + JSON.stringify(err));}
                                    return err;
                            });
                        }

                        if(!missingToken){
                            // add transaction in table
                            mTransaction.create({ EmiterWallet: e.from, DateTimeIn: (new Date()).toUTCString(), InTransactionHash: e.hash, NonceIn: e.nonce, NbEthereum: nbEth, NbToken: nbTokenUnitToTransfert, DiscountFactor: discountFactor }, transCreateCB.bind(null, nbTokenUnitToTransfert));
                        }
                        else {
                            mTransaction.find({ where: { EmiterWallet: e.from, InTransactionHash: e.hash }}, transUpdateCB.bind(null, nbTokenUnitToTransfert));
                        }

                        if (nbTokenUnitToTransfert > 0) {
                            checkReferrer(e, nbTokenUnitToTransfert);
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

        function checkReferrer(transaction, nbTokenUnitToTransfert) {
            mReferrer.find( { where: { WalletInvestor: transaction.from}}, processReferrer.bind(null, nbTokenUnitToTransfert, transaction));
        }

        function processReferrer(nbToken, transaction, err, instance) {
            if (err) {
                logger.error("Error occurs when find a referrer in table(investor: " + e.from + ") error: " + JSON.stringify(err));
            }
            else if (instance.length > 0)
            {
                var referrerPart = 20;
                logger.info("We found a referrer for incoming ethereum to wallet: " + transaction.from);
                mReferrer.find( { where: { WalletReferrer: instance[0].WalletReferrer}}, function(nbT, err, instance) {
                    if (err) {
                        logger.error("Error occurs when find all referrals in table(Referrer: " + instance[0].WalletReferrer + ") error: " + JSON.stringify(err));
                        return;
                    }

                    if (instance.length >= 10) {
                        referrerPart = 10;
                    }

                    var dateNow = new Date().getTime();
                    var dateReferrer = instance[0].StartDateReferrer;
                    var nbtokenUnitToReferrer = nbT.dividedBy(referrerPart);
                    if (dateNow > dateReferrer) {
                        var nbTokenToReferrer = nbtokenUnitToReferrer.dividedBy(Math.pow(10, decimal)).toNumber()
                        logger.info("Incoming ethereum wallet: " + transaction.from + " is referral of " + instance[0].WalletReferrer + " have " + instance.length + " referrals, and received " + (100 / referrerPart) + "% of referrer transaction: " + nbTokenToReferrer + " tokens");
                        nbTokenSold += nbTokenToReferrer;
                        mTransaction.create({ EmiterWallet: instance[0].WalletReferrer, DateTimeIn: (new Date()).toUTCString(), InTransactionHash: transaction.hash, NonceIn: transaction.nonce, NbEthereum: 0, NbToken: nbtokenUnitToReferrer, DiscountFactor: 0, Referral: instance[0].WalletInvestor }, transCreateCB.bind(null, nbtokenUnitToReferrer));
                    }
                    else {
                        logger.info("Referal refused for date, Incoming ethereum wallet: " + transaction.from + "is referral of " + instance[0].WalletReferrer + " have " + instance.length + " referrals, and received " + (100 / referrerPart) + "% of referrer transaction: " + nbtokenToReferrer.dividedBy(Math.pow(10, decimal)).toNumber() + " tokens");
                    }
                }.bind(null, nbToken));
            }
        }

        function transCreateCB(nbToken, err, instance) {
            if (err) {
                logger.error("Error occurs when adding transaction in table(for input transaction hash: " + instance.InTransactionHash + ") error: " + JSON.stringify(err));
            }
            else
            {
                if (nbToken > 0) {
                    sendToken(instance, nbToken);
                }
            }
        }

        function transUpdateCB(nbToken, err, instances) {
            if (err) {
                logger.error("Error occurs when find transaction in table(for input transaction hash: " + instance.InTransactionHash + ") for mising token send, error: " + JSON.stringify(err));
            }
            else
            {
                if (instances.length != 1) {
                    logger.error("Many instance found (" + instances.length + ") when find transaction in table(for input transaction hash: " + instance.InTransactionHash + ") for mising token send");
                }
                else {
                    if (nbToken > 0) {
                        sendToken(instances[0], nbToken);
                    }
                }
            }
        }

        function sendToken(instance, nbToken) {
//            tokenContractInstance.transfer(instance.EmiterWallet, nbToken, {gas: transactionGaz, gasPrice: gazPrice}, function(err, thash) {
            tokenContractInstance.transfer(instance.EmiterWallet, nbToken, function(err, thash) {
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

            // on check les transaction receipt de chaque transaction d'envois de token
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
                sendTokenForTransaction(missingTokenSend, [], true);
            }

            // On check si il manque le traitement de reception d'ethereum (rien dans la table concernant une reception d'ethereum)
            if (missingTransactionIn.length > 0) {
                logger.info("checkTransaction found " + missingTransactionIn.length + " missing processed transaction in (ethreum received)");
                sendTokenForTransaction(missingTransactionIn, procTrans, false);
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
        var lastDateGetCot = "";
        var lastGetCot = "";

        function getCotation(cryptoId, cb) {
            var url = config.cmcURI + '/ticker/' + cryptoId + '/?convert=EUR';
            if (lastDateGetCot === "" || ((new Date() - lastDateGetCot) > 60000)) {
                lastDateGetCot = new Date();
                request
                .get(url)
				.query({convert: 'EUR'})
				.timeout(5000)
                .end((err, res) => {
                    if (err) return cb(err, null);
                    if (res.body && !res.error && res.statusCode===200 && res.text && res.text.length>0) {
                        lastGetCot = JSON.parse(res.text);
                        pingAlive(lastGetCot);
                        return cb(null, lastGetCot);
                    } else {
                        return cb('request() error. url:' + url, null);
                    }
                });
            }
            else {
                if (lastGetCot === "") {
                    return cb('request() error. url:' + url, null);
                }
                else {
                    return cb(null, lastGetCot);
                }
            }
        }

        /**
        * Get crypto CoinMarketCap id
        */
        var lastDateGetId = "";
        var lastIDGet = "";
       
        function getCoinMarketCapId(cryptoName, cb) {
            var url = config.cmcURI + '/listings/';
            if (lastDateGetId === "" || ((new Date() - lastDateGetId) > 60000)) {
               lastDateGetId = new Date();
                request
				.get(url)
				.timeout(5000)
                .end((err, res) => {
                    if (err) return cb(err, null);
                    if (res.body && !res.error && res.statusCode===200 && res.text && res.text.length>0) {
                        var rep = JSON.parse(res.text);
                        var id = -1;
                        // rep.data.forEach(function(element) {
                        //    if (element.name === cryptoName)
                        //    {
                        //        id = Number(element.id);
                        //    }
                        // });
                        rep.data.some(function(element) {
                            if (element.name === cryptoName) {
                                id = Number(element.id);
                                lastIDGet = id;
                                return true;
                            }
                        });
                        return cb(null, id);
                    } else {
                        return cb('request() error. url:' + url, null);
                    }
                });
            }
            else
            {
                if (lastIDGet === "") {
                    return cb('request() error. url:' + url, null);
                }
                else {
                    return cb(null, lastIDGet);
                }
            }
        }
    
        function pingAlive(cotation) {
            sendParams('pingAlive', { "EthPrice": cotation == null ? "" : cotation.data.quotes.USD.price }, (err, responseTxt) => {});
        }

        /**
         * Get a valid token
         */
        function login(login, pass, cb) {
            const url = config.webURI + '/login';
            request
            .post(url)
			.send({username: login, password: pass})
			.timeout(5000)
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
        var tokenId = '';
        var busy    = false;

        function sendParams(api, params, cb) {
//            if (busy) return cb('busy', false);
            busy = true;

            function doRequest(ap, par,callback) {
                request
                    .post(config.webURI + '/api/ICOs/' + ap)
                    .send({tokenId: tokenId, params: par})
                    .timeout(5000)
                    .end((err, res) => {
                        if (err) {
                            if (err.status === 401 /* && err.code === 'INVALID_TOKEN' */) {            // token invalide
                                login(config.webUser, config.webPass, (err, id) => {
                                    if (err) return callback(err);
                                    tokenId = id;
                                    return callback(null, ap, par, true);
                                });
                            } else {
                                return callback(err);
                            }
                        } else {
                            return callback(null, ap, par, false);                                // requête réussie, on sort avec "true"
                        }
                    });    
            }

            doRequest(api, params, function(a, p, err, login) {
                if (err) {
                    busy = false;
                    return cb(err, false);
                } else {
                    if (login) {
                        doRequest(a, p, function(err) {
                            busy = false;
                            if (err) return cb(err, false);
                            return cb(null, true);
                        });
                    } else {
                        busy = false;
                        return cb(null, true);
                    }
                }
            }.bind(null, api, params));
        }

        // inits for blockchain scan
        var startBlock = 0;
        var lastBlock = 0;
        var NbBlockTransactionConfirmation = params[0].NbBlockTransactionConfirmation;
        var totalToken = params[0].NbTotalToken;
        var totalTokenToSend = params[0].NbTokenToSell;
        var ethereumReceived = params[0].NbEthereum;

        if (checkMode === 1) {
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

        SendIcoState(icoDateStart, icoDateEnd, true);

        /**
         * Send ICO params to website
         */
        var Webparams = {
            state:			icoState,
            wallet:			icoState === 3 ? ICOWalletTokenAddress : "",
            contractAddress: icoState > 1 ? transactionReceipt.contractAddress : "",
            tokenName:  	"SSW",
            tokenPriceUSD:	tokenPriceUSD.toNumber(),
            tokenPriceETH:	tokenPriceEth.toNumber(),
            softCap:		config.softCap,
            hardCap:  		config.hardCap,
            tokensTotal:  	totalToken,
            ethTotal:   	params[0].NbEthereum,
            tokensSold:  	params[0].NbTokenSold,
//params[0].IcoDateStart
//params[0].IcoDateEnd
            dateStart:   	icoDateStart.toISOString(),
            dateEnd:  		icoDateEnd.toISOString()
        }

        sendParams("setParams", Webparams, (err, responseTxt) => {
            if (err) return err;
        });

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

        function checkNeedTransfertEthereum(ethOwner, ethReceipt) {
            var ethAmount = Math.floor(web3.fromWei(web3.eth.getBalance(ethOwner), "ether")-0.1);
            if (ethAmount >= 1) {
                transfertEthereum(ethOwner, ethReceipt, web3.toBigNumber(web3.toWei(ethAmount, "ether")));
            }
        }

        function returnEthereum(ethOwner, ethDestinataire, eth){
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
                        logger.info("--- return ethereum transaction " + transactionHash + " submited!");
                    }
                    else{
                        logger.error("*** return ethereum erreur " + JSON.stringify(err));
                    return;
                    }
                });
                if (typeof eth === "string") {
                    logger.info("Return ethereum by sending transaction from " + ethOwner + " to " + ethDestinataire + " for " + eth + " ether");
                }
                else {
                    logger.info("Return ethereum by sending transaction from " + ethOwner + " to " + ethDestinataire + " for " + web3.fromWei(eth, "ether").toNumber() + " ether");
                }
            }
            catch(err){
              logger.error("Exception during function returnEthereum: " + JSON.stringify(err));
            }
            finally{
              logger.info('-----------------------------------------------------------------------------------');
            }
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

        function reSendToken(instance) {
            var nbToken = web3.toBigNumber(instance.NbToken);
            tokenContractInstance.transfer(instance.EmiterWallet, nbToken.times(Math.pow(10, decimal)), {gas: transactionGaz, gasPrice: gazPrice}, function(inst, err, thash) {
                if (!err) {
                    web3.eth.getTransaction(thash, function(i, err, trans) {
                        if(err){
                            logger.error("Error: web3.eth.getTransaction() return an error after send/deploy transaction (transaction hash: " + thash + ") error: " + JSON.stringify(err));
                        }
                        else {
                            logger.info("Tokens sended to: " + trans.to + " transaction hash: " + trans.hash);

                            mTransaction.create({ EmiterWallet: i.EmiterWallet, DateTimeIn: i.DateTimeIn, InTransactionHash: i.InTransactionHash, NonceIn: i.NonceIn, NbEthereum: i.NbEthereum, NbToken: i.NbToken, DiscountFactor: i.DiscountFactor, Referral: i.Referral }, function(err, instance) {
                                // update transaction table
                                instance.updateAttributes( { "OutTransactionHash": trans.hash, "NonceOut": trans.nonce, "DateTimeOut": (new Date()).toUTCString(), "NbToken": instance.NbToken }, function (err, instance) {
                                    if (err) {
                                        logger.error("Error: can't update transaction table after transaction hash: " + trans.hash + " is mined, error: " + JSON.stringify(err));
                                    }
                                })
                            });
                        }
                    }.bind(null, inst))
                }
                else {
                    logger.info("reSend token to wallet " + instance.EmiterWallet + " for " + instance.NbToken + " tokens from input transaction " + instance.InTransactionHash + " error: " + JSON.stringify(err));
                }
            }.bind(null, instance))
        }

        function IntervalProcess(procTrans, checkMode)
        {
            if (cronStarted) {
                balance = tokenContractInstance.balanceOf(ICOWalletTokenAddress);
                adjustedBalance = balance / Math.pow(10, decimal);
                
                if (checkMode === 1) {
                    logger.info("Before correction: ICO Etherum received: " + ethereumReceived.toFixed(6) + ", token left to sell: " + adjustedBalance - (totalToken - totalTokenToSend));
                }
                else {
                    logger.info("ICO Etherum received: " + ethereumReceived.toFixed(6) + ", token left to sell: " + (adjustedBalance - (totalToken - totalTokenToSend)));
                }

                if (adjustedBalance <= (totalToken - totalTokenToSend)) {
                    if (icoState !== 4)
                    {
                        icoState = 4;
                        sendParams('setState', { "state": icoState }, (err, responseTxt) => {});

                        var paramsUpdated = {
                            state:          icoState,
                            ethReceived:    0,
                            tokensSend:     0,
                            ethTotal:       ethereumReceived,
                            tokensSold:     totalToken - adjustedBalance,
                            tokenPriceUSD:	tokenPriceUSD.toNumber(),
                            tokenPriceETH:	tokenPriceEth.toNumber(),
                            discount:       discountFactor
                        }
                        sendParams('setReceivedEth', paramsUpdated, (err, responseTxt) => {
                            if (err) return err;
                        });
                    }

                    logger.info("ICO hard cap reached !, token left: " + adjustedBalance + ", Ethereum gain: " + ethereumReceived.toFixed(6) );
                }
                if (checkMode == 0 && icoState !== 4) {
                    SendIcoState(icoDateStart, icoDateEnd, false);
                }

                if (math.ceil(nbTokenSold) < (totalToken - adjustedBalance)) {
                    logger.error("ATTENTION!!! Le nombre de tokens vendus: " + nbTokenSold + " ne correspond pas au nombre de tokens vendus deduit de la balance du wallet: " + (totalToken - adjustedBalance), " il en manque: " + ((totalToken - adjustedBalance) - nbTokenSold));
                }

                // Process blockchain block
                if (checkMode === 0) {
                    var newLastBlock = web3.eth.blockNumber;
                    logger.info("new blocks: " + (newLastBlock - lastBlock) + ", nb confirmation block: " + NbBlockTransactionConfirmation);

                    if ( (newLastBlock - NbBlockTransactionConfirmation) > lastBlock)
                    {
                        lastBlock = Math.min(newLastBlock - NbBlockTransactionConfirmation, lastBlock + 100);

                        // get transaction of account toAdresse from block startBlock to lastBlock
                        var transactions = getTransactionsOfAccount(ICOWalletTokenAddress, ICOWalletDiscount1Address, ICOWalletDiscount2Address, startBlock, lastBlock, false);
                        startBlock = lastBlock + 1;

                        // display transaction received
                        logger.info("Reception Eth Transaction: " + transactions[1].length + ", Sent token transaction: " + transactions[0].length);
                        displayTransactionTo(transactions[1]);
                        logger.info("============================================================================");
                        displayTransactionFrom(transactions[0])

                        // Send token to investors
                        sendTokenForTransaction(transactions[1], procTrans, false);

                        params[0].updateAttributes( { "LastProcessedBlock" : lastBlock }, function (err, instance) {
                            if (err) {
                                logger.error("error: Unable to update LastProcessedBlock: " + JSON.stringify(err));
                            }
                        });        

                        // Secure eth to locked wallet
                        if (icoState !== 4) {
                            if (ICOWalletTokenAddress !== ICOWalletEthereumAddress) {
                                checkNeedTransfertEthereum(ICOWalletTokenAddress, ICOWalletEthereumAddress);
                            }
                            checkNeedTransfertEthereum(ICOWalletDiscount1Address, ICOWalletEthereumAddress);
                            checkNeedTransfertEthereum(ICOWalletDiscount2Address, ICOWalletEthereumAddress);
                        }
                    }
                }
                // Check all BlockChaine blocks vs transaction table for found missing or interrupted transactions
                else if (checkMode === 1) {
                    logger.info("Check transactions from block " + startBlock + " to block " + lastBlock);

                    // get transaction of account toAdresse from block startBlock to lastBlock
                    var transactionsER = getTransactionsOfAccount(ICOWalletTokenAddress, ICOWalletDiscount1Address, ICOWalletDiscount2Address, startBlock, lastBlock, false);
                    var transactionsR = getTransactionsOfAccount(ICOWalletTokenAddress, ICOWalletDiscount1Address, ICOWalletDiscount2Address, lastBlock + 1, web3.eth.blockNumber, true);
                    var transactions = [];
                    transactions.push(transactionsER[0].concat(transactionsR[0]));
                    transactions.push(transactionsER[1].concat(transactionsR[1]));

                    checkTransaction(transactions[1], transactions[0], procTrans, tokenContractInstance);
                    logger.info("Check transaction process finished!")
                    balance = tokenContractInstance.balanceOf(ICOWalletTokenAddress);
                    adjustedBalance = balance / Math.pow(10, decimal);
                    logger.info("After correction: ICO Etherum received: " + ethereumReceived.toFixed(6) + ", token left to sell: " + (adjustedBalance - (totalToken - totalTokenToSend)));
                    cronStarted = false;
                    clearInterval(cron);
                    initCalled = false;
                }
                // Resend all previoulsy sended transaction
                else if (checkMode === 2)
                {
                    // delete all transactions in transaction table
                    mTransaction.destroyAll(function(err, info) {
                        if (err) {
                            logger.error("Error occurs when cleaning Transaction table. error: " + JSON.stringify(err));
                            return cb("Error occurs when cleaning Transaction table. error: " + JSON.stringify(err), null);
                        }
                        logger.info(info.count + " were destroyed from Transaction table");	

                        procTrans.forEach(function(t){
                            reSendToken(t)
                        });
                        cronStarted = false;
                        clearInterval(cron);
                    });
                    logger.info("Resend tokens done!");
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
            try {
                mParamBackup.create({ ICOWalletTokenAddress: param[0].ICOWalletTokenAddress, ICOWalletDiscount1Address: param[0].ICOWalletDiscount1Address, ICOWalletDiscount2Address: param[0].ICOWalletDiscount2Address, ICOWalletEthereumAddress: param[0].ICOWalletEthereumAddress, 
                    TransactionGaz: param[0].TransactionGaz, GazPice: param[0].GazPice, TokenContractTransactionHash: param[0].TokenContractTransactionHash, TokenContractAddress: param[0].TokenContractAddress, NbTokenToSell: param[0].NbTokenToSell, NbTotalToken: param[0].NbTotalToken, 
                    USDTokenPrice: param[0].USDTokenPrice, USDEthereumPrice: param[0].USDEthereumPrice, Discount1Factor: param[0].Discount1Factor, Discount2Factor: param[0].Discount1Factor, NbTokenSold: param[0].NbTokenSold, NbEthereum: param[0].NbEthereum, LastProcessedBlock: param[0].LastProcessedBlock, 
                    BlockTokenStart: param[0].BlockTokenStart, NbBlockTransactionConfirmation: param[0].NbBlockTransactionConfirmation, IcoDateStart: param[0].IcoDateStart, IcoDateEnd: param[0].IcoDateEnd}, (err, instance) => {
                    if (err) {
                        logger.error("Error occurs when backup table Param error: " + JSON.stringify(err));
                        return cb("Error occurs when backup table Param error: " + JSON.stringify(err), null);
                    }
                });
            } catch(err) {}
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
  
DetectEthereumIncome.prototype.ResendEmitedToken = function (cb) {
    if (!cronStarted)
    {
        detectEthereumIncomeInstance.Init(cb, 2);
        return cb(null, "ReSend emited transaction started!"); 
    }
    else{
        return cb("cronStarted already started!, ResendEmitedToken aborded!", null); 
    }
}

DetectEthereumIncome.prototype.StartSendToken = function(cb) {
    if (!cronStarted)
    {
        detectEthereumIncomeInstance.Init(cb, 0);
        return cb(null, "Send token cron started!"); 
    }
    else{
        return cb("Send token cron started already started!", null); 
    }
};
  
DetectEthereumIncome.prototype.StopSendToken = function (cb) {
    if (cronStarted) {
        cronStarted = false;
        initCalled = false;
        clearInterval(cron);
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
    detectEthereumIncomeInstance.Init(cb, 1);
  
    return cb(null, "CheckAndFix transaction started!"); 
}

DetectEthereumIncome.prototype.BackupParams = function (cb) {
    detectEthereumIncomeInstance.ParamBackup(cb);
    return cb(null, "Backup params table!"); 
}
