// src/routes/oauth/google.ts
/**
 * @file Google OAuth routes
 * Handles Google OAuth login and callback, fetches user info, and allows
 * integration with DB for user creation/retrieval.
 */

// src/routes/oauth/google.ts

import { FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import fetch from 'node-fetch';
import { getOauthProviderByName } from '../../db/wrappers/auth/oauthProviders.js';
import { decryptSecret } from '../../utils/crypto.js';
import { createNewSession } from '../../utils/session.js';
import { getOauthAccountByProviderAndUserId, getUserByEmail } from '../../db/index.js';

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
	fastify.get('/google', async (req, reply) => {
		const provider = getOauthProviderByName('google');
		if (!provider) return reply.status(404).send('OAuth provider not found');

		const authUrl =
			`https://accounts.google.com/o/oauth2/v2/auth?` +
			new URLSearchParams({
				client_id: provider.client_id,
				redirect_uri: provider.discovery_url,
				response_type: 'code',
				scope: 'openid email profile'
			});

		return reply.redirect(authUrl);
	});

	fastify.get('/google/callback', async (request, reply) => {
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
			
			if (oauthAccount) { // direct login
				const result = createNewSession(oauthAccount.user_id, {
					ip: request.ip,
					userAgent: request.headers['user-agent']
				});
				if (!result) return reply.status(500).send({ error: 'Failed to create session' });

				// result.token is the plain token, result.session is the DB record
				reply.setCookie('session', result.token, {
					path: '/',
					httpOnly: true,
					secure: process.env.NODE_ENV === 'production',
					sameSite: 'lax',
					maxAge: 60 * 60 * 24 * 30 // 30 days
				});

				return reply.redirect(`/auth/success?provider=google`); // Logged in page ?
			}


			const existingUser = getUserByEmail(userInfo.email);

			const query = new URLSearchParams({
					email: userInfo.email,
					provider: 'google',
					providerId: userInfo.id,
					name: userInfo.name,
					picture: userInfo.picture || ''
				}).toString();

			if (existingUser) {
				// redirect to confirmation page on frontend
				return reply.redirect(`/auth/link-account?${query}`); // Need to be implemented frontend and backend
				// would ask password confirmation before linking accounts
			}

			return reply.redirect(`/register?${query}`); // Need to be implemented frontend and backend
			// page would be prefilled with info from Google to create a new account
		} catch (err) {
			console.error('Google OAuth callback error:', err);
			return reply.status(500).send({ error: (err as Error).message });
		}
	});
}
