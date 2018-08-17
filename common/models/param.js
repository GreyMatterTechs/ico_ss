'use strict';

module.exports = function(Param) {

	if (process.env.NODE_ENV !== undefined) {
		// https://loopback.io/doc/en/lb3/Authentication-authorization-and-permissions.html
		Param.disableRemoteMethodByName('upsert');									// disables PATCH /Params
		Param.disableRemoteMethodByName('find');									// disables GET /Params
		Param.disableRemoteMethodByName('replaceOrCreate');							// disables PUT /Params
		Param.disableRemoteMethodByName('create');									// disables POST /Params
		Param.disableRemoteMethodByName('prototype.updateAttributes');				// disables PATCH /Params/{id}
		Param.disableRemoteMethodByName('findById');								// disables GET /Params/{id}
		Param.disableRemoteMethodByName('exists');									// disables HEAD /Params/{id}
		Param.disableRemoteMethodByName('replaceById');								// disables PUT /Params/{id}
		Param.disableRemoteMethodByName('deleteById');								// disables DELETE /Params/{id}
		Param.disableRemoteMethodByName('prototype.__findById__accessTokens');		// disable GET /Params/{id}/accessTokens/{fk}
		Param.disableRemoteMethodByName('prototype.__updateById__accessTokens');	// disable PUT /Params/{id}/accessTokens/{fk}
		Param.disableRemoteMethodByName('prototype.__destroyById__accessTokens');	// disable DELETE /Params/{id}/accessTokens/{fk}
		Param.disableRemoteMethodByName('prototype.__count__accessTokens');			// disable  GET /Params/{id}/accessTokens/count
		Param.disableRemoteMethodByName('createChangeStream');						// disables POST /Params/change-stream
		Param.disableRemoteMethodByName('count');									// disables GET /Params/count
		Param.disableRemoteMethodByName('findOne');									// disables GET /Params/findOne
		Param.disableRemoteMethodByName('update');									// disables POST /Params/update
		Param.disableRemoteMethodByName('upsertWithWhere');							// disables POST /Params/upsertWithWhere
	}

};
