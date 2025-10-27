// src/routes/oauth/github.ts
/**
 * @file github OAuth routes
 * Handles github OAuth login and callback, fetches user info, and allows
 * integration with DB for user creation/retrieval.
 */

// src/routes/oauth/github.ts

import { FastifyInstance } from 'fastify';
import fetch from 'node-fetch';
import { getOauthProviderByName } from '../../db/wrappers/auth/oauth/oauthProviders.js';
import { decryptSecret } from '../../utils/crypto.js';
import crypto from 'crypto';
import { createNewSession } from '../../utils/session.js';
import { getOauthAccountByProviderAndUserId, getUserByEmail } from '../../db/index.js';

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

    fastify.get('/github', async (req, reply) => {
    const provider = getOauthProviderByName('github');
    if (!provider) return reply.status(404).send('OAuth provider not found');
    const authUrl =
        `https://github.com/login/oauth/authorize?` +
        new URLSearchParams({
            client_id: provider.client_id,
            redirect_uri: provider.discovery_url,
            scope: 'read:user user:email'
        });
        return reply.redirect(authUrl);
    });
    fastify.get('/github/callback', async (request, reply) => {
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
                return reply.redirect(`/auth/success?provider=github`); // Logged in page ?
            }

            const existingUser = getUserByEmail(userInfo.email);

            const query = new URLSearchParams({
                    email: userInfo.email,
                    provider: 'github',
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
            // page would be prefilled with info from Github to create a new account
        } catch (err) {
            console.error('Github OAuth callback error:', err);
            return reply.status(500).send({ error: (err as Error).message });
        }
    });
}
