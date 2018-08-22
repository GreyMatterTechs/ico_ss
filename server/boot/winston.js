/**
 * Module for Winston Logger related features.
 *
 * @module Winston
 * @file   This file defines the Winston module.
 *
 * @author Philippe Aubessard
 * @copyright Grey Matter Technologies, 2018. All Rights Reserved.
 */

'use strict';

// ------------------------------------------------------------------------------------------------------
// includes
// ------------------------------------------------------------------------------------------------------

const path				= require('path');
const appRoot			= require('app-root-path');
const winston			= require('winston');
const DailyRotateFile	= require('winston-daily-rotate-file');
const moment			= require('moment');
const config			= reqlocal(path.join('server', 'config' + (process.env.NODE_ENV === undefined ? '' : ('.' + process.env.NODE_ENV)) + '.json'));

// ------------------------------------------------------------------------------------------------------
// Private Methods
// ------------------------------------------------------------------------------------------------------

const timeFormatFn = function() {
	return moment().format('YYYY-MM-DD HH-mm-ss');
};

const myFormat = winston.format.printf(info => {
	return `${info.timestamp} [${info.label}] ${info.level}: ${info.message}`;
});

const logger = winston.createLogger({
	level: 'info',	// default logger error level (from: error, warn, info, verbose, debug, silly)
	format: winston.format.json(),
	transports: [
		// - Write all logs error (and below) to `error.log`.
		new DailyRotateFile({
			dirname: path.join(`${appRoot}`, 'logs'),
			filename: 'error.log',
			datePattern: 'YYYY-MM-DD',
			zippedArchive: true,
//			maxSize: '20m',
			maxFiles: '14d',

			level: 'error',	// maximum level of messages that this transport should log
			tailable: true,
			json: true,
			// eol: 'rn', // for Windows, or `eol: ‘n’,` for *NIX OSs
			handleExceptions: true,
			prepend: true,
			timestamp: timeFormatFn,
			formatter: function(options) {
				return options.timestamp() + '-' + process.env.NODE_ENV + '- message:' + (options.message ? options.message : '')
			}
		}),
		// - Write to all logs with level `info` and below to `combined.log`
		new DailyRotateFile({
			dirname: path.join(`${appRoot}`, 'logs'),
			filename: 'combined.log',
			datePattern: 'YYYY-MM-DD',
			zippedArchive: true,
//			maxSize: '20m',
			maxFiles: '14d',

			// use default - level: 'info',	// maximum level of messages that this transport should log
			tailable: true,
			json: true,
			// eol: 'rn', // for Windows, or `eol: ‘n’,` for *NIX OSs
			handleExceptions: true,
			prepend: true,
			timestamp: true,
			formatter: function(options) {
				return options.timestamp() + '-' + process.env.NODE_ENV + '- message:' + (options.message ? options.message : '')
			}
		})
	]
});


// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
if (process.env.NODE_ENV !== 'production') {
	logger.add(new winston.transports.Console({
		format: winston.format.combine(
			winston.format.label({label: config.appName}),
			winston.format.timestamp(),
			winston.format.colorize({all: true}),
			myFormat
		)
	}));
}

// Increase logging level in DEBUG mode
if (process.env.DEBUG) {
	winston.level = 'debug';
	logger.debug('The Winston debug mode is switched on.');
}

// ------------------------------------------------------------------------------------------------------
// Exports
// ------------------------------------------------------------------------------------------------------

/**
 * Module export
 *
 * @public
 * @api public
 */
module.exports.logger = logger;
