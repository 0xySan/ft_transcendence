/**
 * @file github OAuth routes
 * Handles github OAuth login and callback, fetches user info, and allows
 * integration with DB for user creation/retrieval.
 */

import { FastifyInstance } from 'fastify';
import { githubCallbackSchema } from '../../plugins/swagger/schemas/githubCallback.schema.js';

import fetch from 'node-fetch';

import { getOauthProviderByName } from '../../db/wrappers/auth/oauth/oauthProviders.js';
import { getOauthAccountByProviderAndUserId, getUserByEmail } from '../../db/index.js';
import { returnOauthSession } from '../../auth/oauth/utils.js';
import { decryptSecret } from '../../utils/crypto.js';

interface GithubTokenResponse {
	access_token: string;
	id_token?: string;
}

interface GithubUserInfo {
	id: string;
	email: string;
	verified_email?: boolean;
	name: string;
	picture?: string;
}

export function githubRoutes(fastify: FastifyInstance) {
    fastify.get('/github/callback', { schema: githubCallbackSchema, validatorCompiler: ({ schema }) => {return () => true;} }, async (request, reply) => {
        const { code } = request.query as { code?: string };
        if (!code) return reply.status(400).send('Missing code');

        const provider = getOauthProviderByName('github');
        if (!provider) return reply.status(404).send('OAuth provider not found');

        try {
            const clientSecret = decryptSecret(provider.client_secret_encrypted);

            const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json'},
                body: new URLSearchParams({
                    code,
                    client_id: provider.client_id,
                    client_secret: clientSecret,
                    redirect_uri: provider.discovery_url
                })
            });

            const tokenData = (await tokenRes.json()) as GithubTokenResponse;
            const accessToken = tokenData.access_token;
            if (!accessToken) throw new Error('No access token returned');

            const userRes = await fetch('https://api.github.com/user', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            const userInfo = (await userRes.json()) as GithubUserInfo;

            const oauthAccount = getOauthAccountByProviderAndUserId('github', userInfo.id);
			
            if (oauthAccount)
				return returnOauthSession(oauthAccount, request, reply);

            const existingUser = getUserByEmail(userInfo.email);
            const query = new URLSearchParams({
                    email: userInfo.email,
                    provider: 'github',
                    providerId: userInfo.id,
                    name: userInfo.name,
                    picture: userInfo.picture || ''
                }).toString();

            if (existingUser)
                return reply.redirect(`/auth/link-account?${query}`);
            return reply.redirect(`/register?${query}`);
        } catch (err) {
            console.error('Github OAuth callback error:', err);
            return reply.status(500).send({ error: (err as Error).message });
        }
    });
}
