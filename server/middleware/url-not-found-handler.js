'use strict';

const path		= require('path');
const appRoot	= require('app-root-path');
//const loopback	= require('../../node_modules/loopback/lib/loopback');
const config	= reqlocal(path.join('server', 'config' + (process.env.NODE_ENV === undefined ? '' : ('.' + process.env.NODE_ENV)) + '.json'));
const logger	= reqlocal(path.join('server', 'boot', 'winston.js')).logger;


module.exports = function () {

	//4XX - URLs not found
    return function customRaiseUrlNotFoundError(req, res, next) {

	//	if (!req.accessToken) {
			return res.render('error-404.ejs', {
						appName: config.appName,
						err: ''
					});
	//	}

	/*	var app = loopback();
		var User = app.models.user;

		User.findById(req.accessToken.userId, function (err, user) {
			if (err) {
				return res.render('error-404.ejs', {
						appName: config.appName,
						err: ''
					});
			}
			res.render('error-404-2.ejs', {
				appName: config.appName,
				user: user,
				err: ''
			});
		});
	*/
  
  };

};
