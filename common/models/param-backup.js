'use strict';

module.exports = function(Parambackup) {

	if (process.env.NODE_ENV !== undefined) {
		// https://loopback.io/doc/en/lb3/Authentication-authorization-and-permissions.html
		Parambackup.disableRemoteMethodByName('upsert');								// disables PATCH /Parambackups
		Parambackup.disableRemoteMethodByName('find');									// disables GET /Parambackups
		Parambackup.disableRemoteMethodByName('replaceOrCreate');						// disables PUT /Parambackups
		Parambackup.disableRemoteMethodByName('create');								// disables POST /Parambackups
		Parambackup.disableRemoteMethodByName('prototype.updateAttributes');			// disables PATCH /Parambackups/{id}
		Parambackup.disableRemoteMethodByName('findById');								// disables GET /Parambackups/{id}
		Parambackup.disableRemoteMethodByName('exists');								// disables HEAD /Parambackups/{id}
		Parambackup.disableRemoteMethodByName('replaceById');							// disables PUT /Parambackups/{id}
		Parambackup.disableRemoteMethodByName('deleteById');							// disables DELETE /Parambackups/{id}
		Parambackup.disableRemoteMethodByName('prototype.__findById__accessTokens');	// disable GET /Parambackups/{id}/accessTokens/{fk}
		Parambackup.disableRemoteMethodByName('prototype.__updateById__accessTokens');	// disable PUT /Parambackups/{id}/accessTokens/{fk}
		Parambackup.disableRemoteMethodByName('prototype.__destroyById__accessTokens');	// disable DELETE /Parambackups/{id}/accessTokens/{fk}
		Parambackup.disableRemoteMethodByName('prototype.__count__accessTokens');		// disable  GET /Parambackups/{id}/accessTokens/count
		Parambackup.disableRemoteMethodByName('createChangeStream');					// disables POST /Parambackups/change-stream
		Parambackup.disableRemoteMethodByName('count');									// disables GET /Parambackups/count
		Parambackup.disableRemoteMethodByName('findOne');								// disables GET /Parambackups/findOne
		Parambackup.disableRemoteMethodByName('update');								// disables POST /Parambackups/update
		Parambackup.disableRemoteMethodByName('upsertWithWhere');						// disables POST /Parambackups/upsertWithWhere
	}

};
