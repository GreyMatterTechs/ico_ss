"use strict"

// required
const path		= require('path');
const appRoot	= require('app-root-path');
const Web3		= require("web3");
const Solc		= require("solc");
const Fs		= require("fs");
const abiDecoder= require("abi-decoder");
const g			= reqlocal(path.join('node_modules', 'loopback', 'lib', 'globalize'));
const config	= reqlocal(path.join('server', 'config' + (process.env.NODE_ENV === undefined ? '' : ('.' + process.env.NODE_ENV)) + '.js'));
const logger	= reqlocal(path.join('server', 'boot', 'winston.js')).logger;
const CryptoJS	= require('crypto-js');
const sha3		= require('crypto-js/sha3');

var appname;
var mParam;
var sendTokensInstance = null;



// ------------------------------------------------------------------------------------------------------
// Private Methods
// ------------------------------------------------------------------------------------------------------

/**
 * Checks if the given string is an ETH address
 *
 * @method isETHAddress
 * @private
 * @param  {String} address The given HEX adress
 *
 * @return {Boolean} True if address is an ETH address
*/
function isETHAddress(address) {
	if (!/^(0x)?[0-9a-f]{40}$/i.test(address)) { // check if it has the basic requirements of an address
		return false;
	} else if (/^(0x)?[0-9a-f]{40}$/.test(address) || /^(0x)?[0-9A-F]{40}$/.test(address)) { // If it's all small caps or all all caps, return true
		return true;
	} else { // Otherwise check each case
		return isChecksumAddress(address);
	}
}

/**
 * Checks if the given string is a checksummed address
 *
 * @method isChecksumAddress
 * @private
 * @param {String} address The given HEX adress
 *
 * @return {Boolean} True if address is a checksummed address
*/
function isChecksumAddress(address) {
	// Check each case
	address = address.replace('0x', '');
	var addressHash = sha3(address.toLowerCase(), {outputLength: 256}).toString();
	for (var i = 0; i < 40; i++) {
		// the nth letter should be uppercase if the nth digit of casemap is 1
		if ((parseInt(addressHash[i], 16) > 7 && address[i].toUpperCase() !== address[i]) || (parseInt(addressHash[i], 16) <= 7 && address[i].toLowerCase() !== address[i])) {
			return false;
		}
	}
	return true;
}

/**
 * Check if val is a Float
 *
 * @method isFloat
 * @private
 * @param {String} val The value to check
 *
 * @return {Boolean} True if the val is a Float
 */
function isFloat(val) {
	return !isNaN(val) && val.toString().indexOf('.') !== -1;
}

/**
 * Check if val is an Interger
 *
 * @method isInteger
 * @private
 * @param {String} val The value to check
 *
 * @return {Boolean} True if the val is an Integer
 */
function isInteger(val) {
	return !isNaN(val) && val.toString().indexOf('.') === -1;
}

/**
 * Check if val is a Number
 *
 * @method isNumber
 * @private
 * @param {String} val The value to check
 *
 * @return {Boolean} True if the val is a Number
 */
function isNumber(val) {
	return isFloat(val) || isInteger(val);
}


/**
 * Check if val is a String
 *
 * @method isString
 * @private
 * @param {String} val The value to check
 *
 * @return {Boolean} True if the val is a String
 */
function isString(val) {
	return Object.prototype.toString.call(val) === '[object String]';
	// return typeof val === 'string' || ((!!val && typeof val === 'object') && Object.prototype.toString.call(val) === '[object String]');
}



/**
* Class sendTokens
* 
* @param {Object} _server The Loopback server
* @param {String} _appname The App name
*/
var sendTokens = function (_server, _appname) {
    appname = _appname;
	mParam = _server.models.Param;
	mTransaction = _server.models.Transaction;
};

/* ------ Module export ----------- */
module.exports = function (_server, _appname) {
    if (sendTokensInstance === null)
    {
        sendTokensInstance = new sendTokens(_server, _appname);
    }
    return sendTokensInstance;
};


/**
 * Send tokens to a dest wallet
 *
 * @method send
 * @public
 * @param    {String}   w        Destination wallet address
 * @param    {Number}   t        Number of tokens to send
 * @callback {Function} cb       Callback function
 * @param    {Error}    err      Error information
 * @param    {String}   result   success
 */
sendTokens.prototype.send = function(w, t, cb) {
	// là tu as le wallet dans w et le nbre de tokens dans t
	var e = new Error(g.f('Invalid Param'));
	e.status = e.statusCode = 401;
	e.code = 'INVALID_PARAM';
	if (!isString(w) || !isETHAddress(w))	{ logger.info('sendTokens.send() bad wallet: ' + w); return cb(e, null); }
	if (!isNumber(t) || t < 0)				{ logger.info('sendTokens.send() bad token: ' + t); return cb(e, null); }

    // connection to local node
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
            logger.error("Wallet for initial token owner not defined !");
            return;
        }
        // wallet adresse & private key and contract transaction hash used for create the token
        var tokenContractAddress = params[0].TokenContractAddress;
		var ICOWalletTokenAddress = params[0].ICOWalletTokenAddress;
		var transactionGaz = params[0].TransactionGaz;
        var gazPrice = web3.toWei(params[0].GazPice,'gwei');

        if (ICOWalletTokenAddress === "" || ICOWalletTokenAddress === undefined || ICOWalletTokenAddress === null) {
            logger.error("Wallets for initial token owner not defined !");
            return;
        }

		var tokenContractTransactionHash = params[0].TokenContractTransactionHash;
        if (tokenContractTransactionHash === "" || tokenContractTransactionHash === undefined) {
            logger.error("Token smart contract transaction hash not defined !");
            return;
        }
        web3.eth.defaultAccount = ICOWalletTokenAddress;

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
		var nbTokenUnitToTransfert = web3.toBigNumber(t).times(Math.pow(10, decimal));
		var nbTokenSold = params[0].tokenSold + t;

		params[0].updateAttributes( { "NbTokenSold": nbTokenSold }, function (err, instance) {
			if (err) {
				logger.error("error: Unable to update NbTokenSold of Param table: " + JSON.stringify(err));
			}
		});        

		// add transaction in table
		mTransaction.create({ EmiterWallet: w, DateTimeIn: (new Date()).toUTCString(), InTransactionHash: "", NonceIn: 0, NbEthereum: 0, NbToken: nbTokenUnitToTransfert, DiscountFactor: 0 }, transCreateCB.bind(null, nbTokenUnitToTransfert));
	}

	function transCreateCB(nbToken, err, instance) {
		if (err) {
			logger.error("Error occurs when adding transaction in table, error: " + JSON.stringify(err));
		}
		else
		{
			sendToken(instance, nbToken);
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
				})
			}
			else {
				logger.info("send token to wallet " + instance.EmiterWallet + " for " + nbToken.dividedBy(Math.pow(10, decimal)).toNumber() + " tokens from input transaction " + instance.InTransactionHash + " error: " + JSON.stringify(err));
			}
		})
	}

	return cb(null, "Done");
};
