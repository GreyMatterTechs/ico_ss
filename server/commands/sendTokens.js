"use strict"

// required
const path		= require('path');
const appRoot	= require('app-root-path');
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

	// y'a plus qu'à...

	return cb(null, "Done");
};
