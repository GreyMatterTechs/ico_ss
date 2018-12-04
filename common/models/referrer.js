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
var async		= require('async');
const g			= reqlocal(path.join('node_modules', 'loopback', 'lib', 'globalize'));
const config	= reqlocal(path.join('server', 'config' + (process.env.NODE_ENV === undefined ? '' : ('.' + process.env.NODE_ENV)) + '.js'));
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

	if (process.env.NODE_ENV !== undefined) {
		// https://loopback.io/doc/en/lb3/Authentication-authorization-and-permissions.html
		Referrer.disableRemoteMethodByName('upsert');								// disables PATCH /Referrers
		Referrer.disableRemoteMethodByName('find');									// disables GET /Referrers
		Referrer.disableRemoteMethodByName('replaceOrCreate');						// disables PUT /Referrers
		Referrer.disableRemoteMethodByName('create');								// disables POST /Referrers
		Referrer.disableRemoteMethodByName('prototype.updateAttributes');			// disables PATCH /Referrers/{id}
		Referrer.disableRemoteMethodByName('findById');								// disables GET /Referrers/{id}
		Referrer.disableRemoteMethodByName('exists');								// disables HEAD /Referrers/{id}
		Referrer.disableRemoteMethodByName('replaceById');							// disables PUT /Referrers/{id}
		Referrer.disableRemoteMethodByName('deleteById');							// disables DELETE /Referrers/{id}
		Referrer.disableRemoteMethodByName('prototype.__findById__accessTokens');	// disable GET /Referrers/{id}/accessTokens/{fk}
		Referrer.disableRemoteMethodByName('prototype.__updateById__accessTokens');	// disable PUT /Referrers/{id}/accessTokens/{fk}
		Referrer.disableRemoteMethodByName('prototype.__destroyById__accessTokens');// disable DELETE /Referrers/{id}/accessTokens/{fk}
		Referrer.disableRemoteMethodByName('prototype.__count__accessTokens');		// disable  GET /Referrers/{id}/accessTokens/count
		Referrer.disableRemoteMethodByName('createChangeStream');					// disables POST /Referrers/change-stream
		Referrer.disableRemoteMethodByName('count');								// disables GET /Referrers/count
		Referrer.disableRemoteMethodByName('findOne');								// disables GET /Referrers/findOne
		Referrer.disableRemoteMethodByName('update');								// disables POST /Referrers/update
		Referrer.disableRemoteMethodByName('upsertWithWhere');						// disables POST /Referrers/upsertWithWhere
	}

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
			}
		}

		const ERRCODES = {
			// codes d'erreurs totalement arbitraires :)
			// 1000 est réservé pour le code coté client.
			FIND:	'0x1001',
			CREATE:	'0x1002'
		};
		var e2 = new Error(g.f('Internal error'));
		e2.status = e2.statusCode = 200;
		e2.code = 'INTERNAL_ERROR';
		async.each(wallets.referrals, function(ref, callback) {
			Referrer.find({where: {WalletInvestor: ref}}, function(err, instance) {
				if (err) {
					return callback({err: err, code: ERRCODES.FIND});				// on remonte l'erreur, et on passe à l'item suivant
				} else if (instance.length > 0) {
					return callback();												// on ignore cet item (pas d'erreur), et on passe à l'item suivant
				} else {
					Referrer.create({WalletInvestor: ref, WalletReferrer: wallets.referrer, StartDateReferrer: new Date().getTime()}, function(err, referrer) {
						if (err) {
							return callback({err: err, code: ERRCODES.CREATE});		// on remonte l'erreur, et on passe à l'item suivant
						} else {
							logger.info('Referral: ' + referrer.WalletInvestor + ' of referrer: ' + referrer.WalletReferrer + ' added.');
							return callback();										// c'est bon, on passe à l'item suivant
						}
					});
				}
			});
		}, function(err) {
			// on arrive ici quand la boucle est finie, ou quand elle a été interrompue par une erreur.
			// maintenant on peut appeler cb()
			if (err) {
				// !!!!  ici il faudrait un système d'alerte pour qu'on soit averti du problème immédiatement
				logger.error('Referrer.register() failed. Err: ' + JSON.stringify(err) + ' Params: ' + JSON.stringify(wallets));
				e2.code = err.code;
				delete e2.stack;
				return cb(e2, null);												// retour au client avec le code d'erreur
			} else {
				return cb(null, '');												// rien à retouner au client, on lui dira juste : "c'est bon".
			}
		});
	};

	Referrer.getReferrals = function(wallet, cb) {
		logger.info("getReferrals called");
		const ERRCODES = {
			NOITEM:	'0x1001',
			UNKNOWN: '0x1002'
		};
		var e = new Error(g.f('Invalid Param'));
		e.status = e.statusCode = 401;
		e.code = 'INVALID_PARAM';
		logger.info("getReferrals before wallet tests");
		if (!isString(wallet)) return cb(e, null);
		logger.info("getReferrals  wallet is a string");
		if (!isETHAddress(wallet)) return cb(e, null);
		logger.info("getReferrals  wallet is a valid adress");
		Referrer.find({where: {WalletReferrer: wallet}}, function(err, instances) {
			if (err) {
				logger.error("Error occurs when find a referrer in table for wallet: " + wallet + " error: " + JSON.stringify(err));
				e.code = ERRCODES.UNKNOWN;
				return cb(err, null);												// retour au client avec le code d'erreur
			} else if (instances.length > 0) {
				logger.info("getReferrals  instances found");
				var referrer = instances[0].WalletReferrer;
				var referrals = [];
				instances.foreach(function(e) {
					referrals.push(e.WalletInvestor);
				});
				return cb(null, {referrer: referrer, referrals: referrals});
			} else if (instances.length === 0) {
				logger.info("getReferrals no instance");
				e.code = ERRCODES.NOITEM;
				return cb(e, null);												// retour au client avec le code d'erreur
			} else {
				logger.info("getReferrals error unknown");
				e.code = ERRCODES.UNKNOWN;
				return cb(e, null);												// retour au client avec le code d'erreur
			}
		});
	};

};
