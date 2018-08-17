/**
 * Module for Referrals database table related features.
 *
 * @module		Referrer
 * @file		This file defines the ICO module.
 * @author		Alain Saffay
 * @link        http://secure-swap.com
 * @copyright	Copyright (c) 2018, GreyMatterTechs.com. All Rights Reserved.
 */

'use strict';

// ------------------------------------------------------------------------------------------------------
// includes
// ------------------------------------------------------------------------------------------------------

const path		= require('path');
const appRoot	= require('app-root-path');
const CryptoJS	= require('crypto-js');
const sha3		= require('crypto-js/sha3');
const config	= reqlocal(path.join('server', 'config' + (process.env.NODE_ENV === undefined ? '' : ('.' + process.env.NODE_ENV)) + '.json'));
const logger	= reqlocal(path.join('server', 'boot', 'winston.js')).logger;

// ------------------------------------------------------------------------------------------------------
// Local Vars
// ------------------------------------------------------------------------------------------------------


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
 * Check if obj is an Object
 *
 * @method isObject
 * @private
 * @param {*} obj The object to check
 *
 * @return {Boolean} True if obj is a literal Object
 *
 * @example
 * console.log(isObject(        )); // false
 * console.log(isObject(    null)); // false
 * console.log(isObject(    true)); // false
 * console.log(isObject(       1)); // false
 * console.log(isObject(   'str')); // false
 * console.log(isObject(      [])); // false
 * console.log(isObject(new Date)); // false
 * console.log(isObject(      {})); // true
 */
function isObject(obj) {
	return (!!obj) && (obj.constructor === Object);
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
}


// ------------------------------------------------------------------------------------------------------
// Exports
// ------------------------------------------------------------------------------------------------------

/**
 * Module export
 *
 * @public
 * @param {Object} Referrer Model
 * @api public
 */
module.exports = function(Referrer) {

	// https://loopback.io/doc/en/lb3/Authentication-authorization-and-permissions.html
	Referrer.disableRemoteMethodByName('upsert');								// disables PATCH /ICOs
	Referrer.disableRemoteMethodByName('find');									// disables GET /ICOs
	Referrer.disableRemoteMethodByName('replaceOrCreate');						// disables PUT /ICOs
	Referrer.disableRemoteMethodByName('create');								// disables POST /ICOs
	Referrer.disableRemoteMethodByName('prototype.updateAttributes');			// disables PATCH /ICOs/{id}
	Referrer.disableRemoteMethodByName('findById');								// disables GET /ICOs/{id}
	Referrer.disableRemoteMethodByName('exists');								// disables HEAD /ICOs/{id}
	Referrer.disableRemoteMethodByName('replaceById');							// disables PUT /ICOs/{id}
	Referrer.disableRemoteMethodByName('deleteById');							// disables DELETE /ICOs/{id}
	Referrer.disableRemoteMethodByName('prototype.__findById__accessTokens');	// disable GET /ICOs/{id}/accessTokens/{fk}
	Referrer.disableRemoteMethodByName('prototype.__updateById__accessTokens');	// disable PUT /ICOs/{id}/accessTokens/{fk}
	Referrer.disableRemoteMethodByName('prototype.__destroyById__accessTokens');	// disable DELETE /ICOs/{id}/accessTokens/{fk}
	Referrer.disableRemoteMethodByName('prototype.__count__accessTokens');		// disable  GET /ICOs/{id}/accessTokens/count
	Referrer.disableRemoteMethodByName('count');									// disables GET /ICOs/count
	Referrer.disableRemoteMethodByName('findOne');								// disables GET /ICOs/findOne
	Referrer.disableRemoteMethodByName('update');								// disables POST /ICOs/update
	Referrer.disableRemoteMethodByName('upsertWithWhere');						// disables POST /I18ns/upsertWithWhere

	/**
	 * Registers a set Referrals
	 * Usually called by secureswap website
	 *
	 * @method register
	 * @public
	 * @param    {Object}   wallets   All referrals' wallets addresses ({referrer: {String}referrer, referrals: {String[]}referrals})
	 * @callback {Function} cb        Callback function
	 * @param    {Error}    err       Error information
	 */
	Referrer.register = function(wallets, cb) {
		var e = new Error(g.f('Invalid Param'));
		e.status = e.statusCode = 401;
		e.code = 'INVALID_PARAM';
		if (!isObject(wallets)) return cb(e, null);
		if (!isString(wallets.referrer)) return cb(e, null);
		if (!Array.isArray(wallets.referrals)) return cb(e, null);
		if (!isETHAddress(wallets.referrer)) return cb(e, null);
		for (var i = 0; i < wallets.referrals.length; i++) {
			if (!isETHAddress(wallets.referrals[i])) {
				return cb(e, null);
				return true;
			}
		}

		wallets.referrals.forEach(function(ref){
			if (ref !== null && ref !== "" && ref !== undefined) {
				Referrer.find( { where: { WalletInvestor: ref}}, function(err, instance){
					if (err) {
						return cb(err, null);	
					}
					else if (instance.length > 0) {
						return cb(null, "referral: " + ref + " already in table!");
					}
					Referrer.create({ WalletInvestor: ref, WalletReferrer: wallets.referrer, StartDateReferrer: new Date().getTime()}, function(err, referrer) {
						if (err) {
							return cb(err, null);
						}
						return cb(null, "Referral: " + referrer.WalletInvestor + " of referrer: " + referrer.WalletReferrer + " added");
					});
				});
			}
		});
	};
};
