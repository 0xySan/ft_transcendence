/**
 * @file Discord OAuth routes
 * Handles Discord OAuth login and callback, fetches user info, and allows
 * integration with DB for user creation/retrieval.
 */

import { FastifyInstance } from 'fastify';
import { discordCallbackSchema } from '../../plugins/swagger/schemas/discordCallback.schema.js';

import fetch from 'node-fetch';

import { getOauthProviderByName } from '../../db/wrappers/auth/oauth/oauthProviders.js';
import { getOauthAccountByProviderAndUserId, getUserByEmail } from '../../db/index.js';
import { returnOauthSession } from '../../auth/oauth/utils.js';
import { decryptSecret } from '../../utils/crypto.js';

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

interface DiscordUserInfo {
  id: string;
  username: string;
  avatar: string | null;
  email: string;
}

function getDiscordAvatarIndex(id?: string): number {
	try {
		return Number(BigInt(id ?? "0") % 5n);
	} catch {
		return 0;
	}
}

export function discordRoutes(fastify: FastifyInstance) {
	fastify.get('/discord/callback', { schema: discordCallbackSchema, validatorCompiler: ({ schema }) => {return () => true;} }, async (request, reply) => {
		const { code } = request.query as { code?: string };
		if (!code) return reply.status(400).send('Missing code');

		const provider = getOauthProviderByName('discord');
		if (!provider) return reply.status(404).send('OAuth provider not found');

		try {
			const clientSecret = decryptSecret(provider.client_secret_encrypted);

			const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'Accept': 'application/json'
				},
				body: new URLSearchParams({
					client_id: provider.client_id,
					client_secret: clientSecret,
					grant_type: 'authorization_code',
					code,
					redirect_uri: provider.discovery_url
				})
			});

			if (!tokenRes.ok) {
				const text = await tokenRes.text();
				throw new Error(`Token endpoint error: ${tokenRes.status} ${text}`);
			}

			const tokenData = (await tokenRes.json()) as DiscordTokenResponse;
			const accessToken = tokenData?.access_token;
			if (!accessToken) throw new Error('No access token returned');

			const userRes = await fetch('https://discord.com/api/users/@me', {
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (!userRes.ok) {
				const text = await userRes.text();
				throw new Error(`User info endpoint error: ${userRes.status} ${text}`);
			}

			const userInfo = (await userRes.json()) as DiscordUserInfo;

			if (!userInfo.email) {
				throw new Error('Discord account has no email associated');
			}

			const oauthAccount = getOauthAccountByProviderAndUserId('discord', userInfo.id);

			if (oauthAccount)
				return await returnOauthSession(oauthAccount, request, reply);

			const existingUser = getUserByEmail(userInfo.email);

			// Build a avatar URL compatible with Discord fields
			const defaultAvatarIndex = (() => {
				try {
					return Number(BigInt(userInfo.id) % 5n);
				} catch {
					return 0;
				}
			})();

			const avatarUrl = userInfo.avatar
				? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}.${userInfo.avatar.startsWith('a_') ? 'gif' : 'png'}`
				: `https://cdn.discordapp.com/embed/avatars/${getDiscordAvatarIndex(userInfo.id)}.png`;

			const query = new URLSearchParams({
					email: userInfo.email,
					provider: 'discord',
					providerId: userInfo.id,
					name: userInfo.username,
					picture: avatarUrl
				}).toString();

			if (existingUser)
				return reply.redirect(`/auth/link-account?${query}`);
			return reply.redirect(`/register?${query}`);
		} catch (err) {
			console.error('Discord OAuth callback error:', err);
			return reply.status(500).send({ error: (err as Error).message });
		}
	});
}
