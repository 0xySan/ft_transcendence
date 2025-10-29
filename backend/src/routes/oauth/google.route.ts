/**
 * @file Google OAuth routes
 * Handles Google OAuth login and callback, fetches user info, and allows
 * integration with DB for user creation/retrieval.
 */

import { FastifyInstance } from 'fastify';
import { googleCallbackSchema } from '../../plugins/swagger/schemas/googleCallback.schema.js';

import fetch from 'node-fetch';

import { getOauthAccountByProviderAndUserId, getUserByEmail, getOauthProviderByName } from '../../db/wrappers/index.js';
import { returnOauthSession } from '../../auth/oauth/utils.js';
import { decryptSecret } from '../../utils/crypto.js';

interface GoogleTokenResponse {
	access_token: string;
	id_token?: string;
}

interface GoogleUserInfo {
	id: string;
	email: string;
	verified_email?: boolean;
	name: string;
	picture?: string;
}

export function googleRoutes(fastify: FastifyInstance) {
	fastify.get('/google/callback', { schema: googleCallbackSchema, validatorCompiler:  ({ schema }) => {return () => true;} }, async (request, reply) => {
		const { code } = request.query as { code?: string };
		if (!code) return reply.status(400).send('Missing code');

		const provider = getOauthProviderByName('google');
		if (!provider) return reply.status(404).send('OAuth provider not found');

		try {
			const clientSecret = decryptSecret(provider.client_secret_encrypted);

			const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					code,
					client_id: provider.client_id,
					client_secret: clientSecret,
					redirect_uri: provider.discovery_url,
					grant_type: 'authorization_code'
				})
			});

			const tokenData = (await tokenRes.json()) as GoogleTokenResponse;
			const accessToken = tokenData.access_token;
			if (!accessToken) throw new Error('No access token returned');

			const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			const userInfo = (await userRes.json()) as GoogleUserInfo;

			const oauthAccount = getOauthAccountByProviderAndUserId('google', userInfo.id);
			
			if (oauthAccount)
				return returnOauthSession(oauthAccount, request, reply);

			const existingUser = getUserByEmail(userInfo.email);
			const query = new URLSearchParams({
					email: userInfo.email,
					provider: 'google',
					providerId: userInfo.id,
					name: userInfo.name,
					picture: userInfo.picture || ''
				}).toString();

			if (existingUser)
				return reply.redirect(`/auth/link-account?${query}`);
			return reply.redirect(`/register?${query}`);
		} catch (err) {
			console.error('Google OAuth callback error:', err);
			return reply.status(500).send({ error: (err as Error).message });
		}
	});
}
