'use strict';

var path		= require('path');
//var loopback	= require('../../node_modules/loopback/lib/loopback');
var config		= require( path.join(__dirname, '../../server/config' + (process.env.NODE_ENV!=='development' ? ('.'+process.env.NODE_ENV) : '') + '.json') );

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
