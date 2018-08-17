'use strict';

module.exports = function(Transaction) {

	if (process.env.NODE_ENV !== undefined) {
		// https://loopback.io/doc/en/lb3/Authentication-authorization-and-permissions.html
		Transaction.disableRemoteMethodByName('upsert');								// disables PATCH /Transactions
		Transaction.disableRemoteMethodByName('find');									// disables GET /Transactions
		Transaction.disableRemoteMethodByName('replaceOrCreate');						// disables PUT /Transactions
		Transaction.disableRemoteMethodByName('create');								// disables POST /Transactions
		Transaction.disableRemoteMethodByName('prototype.updateAttributes');			// disables PATCH /Transactions/{id}
		Transaction.disableRemoteMethodByName('findById');								// disables GET /Transactions/{id}
		Transaction.disableRemoteMethodByName('exists');								// disables HEAD /Transactions/{id}
		Transaction.disableRemoteMethodByName('replaceById');							// disables PUT /Transactions/{id}
		Transaction.disableRemoteMethodByName('deleteById');							// disables DELETE /Transactions/{id}
		Transaction.disableRemoteMethodByName('prototype.__findById__accessTokens');	// disable GET /Transactions/{id}/accessTokens/{fk}
		Transaction.disableRemoteMethodByName('prototype.__updateById__accessTokens');	// disable PUT /Transactions/{id}/accessTokens/{fk}
		Transaction.disableRemoteMethodByName('prototype.__destroyById__accessTokens');	// disable DELETE /Transactions/{id}/accessTokens/{fk}
		Transaction.disableRemoteMethodByName('prototype.__count__accessTokens');		// disable  GET /Transactions/{id}/accessTokens/count
		Transaction.disableRemoteMethodByName('createChangeStream');					// disables POST /Transactions/change-stream
		Transaction.disableRemoteMethodByName('count');									// disables GET /Transactions/count
		Transaction.disableRemoteMethodByName('findOne');								// disables GET /Transactions/findOne
		Transaction.disableRemoteMethodByName('update');								// disables POST /Transactions/update
		Transaction.disableRemoteMethodByName('upsertWithWhere');						// disables POST /Transactions/upsertWithWhere
	}

};
