/**
 * @file OAuth routes
 * Defines routes for OAuth login redirection.
 */

import { FastifyInstance } from 'fastify';
import { oauthSchema, oauthListSchema } from '../../plugins/swagger/schemas/oauth.schema.js';
import { getOauthProviderByName } from '../../db/wrappers/auth/oauth/oauthProviders.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { getOauthAccountsByUserId } from '../../db/index.js';

const oauthConfigs: Record<string, { url: string; params: Record<string, string> }> = {
	discord: {
		url: 'https://discord.com/oauth2/authorize',
		params: { response_type: 'code', scope: 'identify email' },
	},
	'forty-two': {
		url: 'https://api.intra.42.fr/oauth/authorize',
		params: { response_type: 'code', scope: 'public', state: 'public' },
	},
	github: {
		url: 'https://github.com/login/oauth/authorize',
		params: { scope: 'read:user user:email' },
	},
	google: {
		url: 'https://accounts.google.com/o/oauth2/v2/auth',
		params: { response_type: 'code', scope: 'openid email profile' },
	},
};

export function oauthRoute(fastify: FastifyInstance) {
	fastify.get('/',
		{
			schema: oauthListSchema,
			validatorCompiler: ({ schema }) => {return () => true;},
			preHandler: requireAuth
		},
		async (request, reply) => {
			const session = (request as any).session;
			if (!session || !session.user_id)
				return reply.status(400).send('You cannot access this resource');

			const oauthAccounts = getOauthAccountsByUserId(session.user_id);

			const OAuth = oauthAccounts.map(acc => ({
				provider: acc.provider_name,
				linkedAt: acc.linked_at,
				profile: JSON.parse(acc.profile_json)
			}));

			return reply.send({ oauth: OAuth });
		});
	fastify.get(
		'/:provider',
		{
			schema: oauthSchema,
			validatorCompiler: ({ schema }) => {return () => true;}
		}, 
	async (request, reply) => {
		const { provider } = request.params as { provider: string };
		const oauthProvider = getOauthProviderByName(provider);

		if (!oauthProvider) return reply.status(404).send('OAuth provider not found');

		const config = oauthConfigs[provider];
		if (!config) return reply.status(500).send('OAuth configuration missing');

		// Optional requestId from frontend for popup handling
		const queryParams = request.query as Record<string, string>;
		const requestId = queryParams.requestId;

		// Merge client_id and redirect_uri
		const params: Record<string, string> = {
			client_id: oauthProvider.client_id,
			redirect_uri: oauthProvider.discovery_url,
			...config.params,
		};

		if (requestId)
			params.state = requestId;

		let authUrl: string;
		if (provider === 'forty-two') {
			// 42 API needs custom query string concatenation
			const query = Object.entries(params)
				.map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
				.join('&');
			authUrl = `${config.url}?${query}`;
		} else
			authUrl = `${config.url}?${new URLSearchParams(params)}`;

		return reply.redirect(authUrl);
	});
}
