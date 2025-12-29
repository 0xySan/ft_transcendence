/**
 * @file unlink.route.ts
 * @brief Route to unlink an oauth provider from the current user logged in
 */

import { FastifyInstance } from "fastify";
import { oauthUnlinkSchema } from "../../plugins/swagger/schemas/unlinkOauth.schema.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { db, getOauthAccountByProviderAndProviderUserId } from "../../db/index.js";

export function oauthUnlinkRoute(fastify: FastifyInstance) {
	fastify.get('/:provider/unlink',
		{
			schema: oauthUnlinkSchema,
			validatorCompiler: ({ schema }) => {return () => true;},
			preHandler: requireAuth
		},
		async (request, reply) => {
			const session = (request as any).session;
			if (!session || !session.user_id)
				return reply.status(401).send('Unauthorized: Invalid or missing session');

			const { provider } = request.params as { provider: string };
			const providerUserId = request.params.providerUserId as string;
			if (!provider || provider.trim() === '' || !providerUserId || providerUserId.trim() === '')
				return reply.status(400).send('Provider and providerUserId params are required');

			const account = getOauthAccountByProviderAndProviderUserId(provider, providerUserId);
			if (!account)
				return reply.status(404).send('Account not found');

			try {
				const stmt = db.prepare('DELETE FROM oauth_accounts WHERE provider_user_id = ? AND provider = ? AND user_id = ?');
				const result = stmt.run(account.provider_user_id, provider, session.user_id);
				if (result.changes === 0)
					return reply.status(500).send('Failed to unlink account');

				return reply.send({ message: 'Account unlinked successfully' });
			} catch (error) {
				console.error('Error unlinking OAuth provider:', error);
				return reply.status(500).send('Internal Server Error');
			}
	});
}