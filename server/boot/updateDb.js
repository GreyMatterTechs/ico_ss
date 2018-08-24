/**
 * Boot module for database initialisation.
 *
 * @module		updateDb
 * @file		This file updates the db.
 * @author		Philippe Aubessard
 * @link        http://secure-swap.com
 * @copyright	Copyright (c) 2018, GreyMatterTechs.com. All Rights Reserved.
 */

'use strict';

// ------------------------------------------------------------------------------------------------------
// includes
// ------------------------------------------------------------------------------------------------------

const path		= require('path');
const async		= require('async');
const appRoot	= require('app-root-path');
const config	= reqlocal(path.join('server', 'config' + (process.env.NODE_ENV === undefined ? '' : ('.' + process.env.NODE_ENV)) + '.js'));
const logger	= reqlocal(path.join('server', 'boot', 'winston.js')).logger;

// ------------------------------------------------------------------------------------------------------
// Local Vars
// ------------------------------------------------------------------------------------------------------

var mParam;
var mParamBackup;
var mReferrer;
var mTransaction;

// ------------------------------------------------------------------------------------------------------
// Private Methods
// ------------------------------------------------------------------------------------------------------

function update(ds, dsName, tables, cb) {
	ds.autoupdate(tables, function(err) {
		if (err) return cb(err);
		// Pour l'update, Alain fait ça dans le code, dans les inits
		// alors je ne le fait pas ici
		// FIXME: Mais attention, dans le code il faut gérer le cas où la base existe déjà : updateAttributes() vs create()
		// logger.info('Updating Loopback tables [' + tables + '] in "' + dsName + '" database...');
		// async.series([updateParams, updateParamsBackup, updateReferrer, updateTransactions], function(err) {
		// 	if (err) return cb(err);
		 	logger.info('Loopback tables [' + tables + '] updated in "' + dsName + '" database.');
		 	return cb();
		// });
	});
}

function create(ds, dsName, tables, cb) {
	ds.automigrate(tables, function(err) {
		if (err) return cb(err);
		logger.info('Loopback tables [' + tables + '] created in "' + dsName + '" database');
		return cb();
	});
}


// ------------------------------------------------------------------------------------------------------
// Exports
// ------------------------------------------------------------------------------------------------------

/**
 * Module export
 *
 * @public
 * @param {Object} app Express App
 * @api public
 */
module.exports = function(app) {
	if (process.env.NODE_ENV === 'production') return;	// on touche à rien

	mParam = app.models.Param;
	mParamBackup = app.models.ParamBackup;
	mReferrer = app.models.Referrer;
	mTransaction = app.models.Transaction;

	var dsMem = app.dataSources.dbMemory;
	var dsSql = app.dataSources.dbSql;
	var dsMemName = dsMem.settings.name || dsMem.adapter.name || dsMem.settings.file;
	var dsSqlName = dsSql.settings.name || dsSql.adapter.name;

	async.series([
		function(cb) { create(dsMem, dsMemName, ['User', 'AccessToken', 'ACL', 'RoleMapping', 'Role'], cb); },
		function(cb) { update(dsSql, dsSqlName, ['Param', 'ParamBackup', 'Referrer', 'Transaction'], cb); }
	], function(err) {
	//	dsMem.disconnect();
	//	dsSql.disconnect();
		if (err) throw err;
		logger.info('Loopback tables ready.');
	});

};
