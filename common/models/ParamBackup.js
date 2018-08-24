'use strict';

module.exports = function(ParamBackup) {

	if (process.env.NODE_ENV !== undefined) {
		// https://loopback.io/doc/en/lb3/Authentication-authorization-and-permissions.html
		ParamBackup.disableRemoteMethodByName('upsert');								// disables PATCH /ParamBackups
		ParamBackup.disableRemoteMethodByName('find');									// disables GET /ParamBackups
		ParamBackup.disableRemoteMethodByName('replaceOrCreate');						// disables PUT /ParamBackups
		ParamBackup.disableRemoteMethodByName('create');								// disables POST /ParamBackups
		ParamBackup.disableRemoteMethodByName('prototype.updateAttributes');			// disables PATCH /ParamBackups/{id}
		ParamBackup.disableRemoteMethodByName('findById');								// disables GET /ParamBackups/{id}
		ParamBackup.disableRemoteMethodByName('exists');								// disables HEAD /ParamBackups/{id}
		ParamBackup.disableRemoteMethodByName('replaceById');							// disables PUT /ParamBackups/{id}
		ParamBackup.disableRemoteMethodByName('deleteById');							// disables DELETE /ParamBackups/{id}
		ParamBackup.disableRemoteMethodByName('prototype.__findById__accessTokens');	// disable GET /ParamBackups/{id}/accessTokens/{fk}
		ParamBackup.disableRemoteMethodByName('prototype.__updateById__accessTokens');	// disable PUT /ParamBackups/{id}/accessTokens/{fk}
		ParamBackup.disableRemoteMethodByName('prototype.__destroyById__accessTokens');	// disable DELETE /ParamBackups/{id}/accessTokens/{fk}
		ParamBackup.disableRemoteMethodByName('prototype.__count__accessTokens');		// disable  GET /ParamBackups/{id}/accessTokens/count
		ParamBackup.disableRemoteMethodByName('createChangeStream');					// disables POST /ParamBackups/change-stream
		ParamBackup.disableRemoteMethodByName('count');									// disables GET /ParamBackups/count
		ParamBackup.disableRemoteMethodByName('findOne');								// disables GET /ParamBackups/findOne
		ParamBackup.disableRemoteMethodByName('update');								// disables POST /ParamBackups/update
		ParamBackup.disableRemoteMethodByName('upsertWithWhere');						// disables POST /ParamBackups/upsertWithWhere
	}

};
