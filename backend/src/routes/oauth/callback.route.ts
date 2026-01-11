/**
 * @file OAuth callback route
 * Handles OAuth callback and session creation.
 */

import * as OAuth from '../../auth/oauth/types.js';

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { oauthCallbackSchema } from '../../plugins/swagger/schemas/callback.schema.js'
import geoip from 'geoip-lite';
import {	createEmailVerification, createOauthAccount, createProfile, createUser,
			getCountryByCode, getOauthAccountByProviderAndProviderUserId,
			getOauthProviderByName, getProfileByUsername,
			getRoleByName, getUserByEmail, OauthProvider } from '../../db/index.js';
import { decryptSecret, generateRandomToken, hashString } from '../../utils/crypto.js';
import { checkTokenValidity } from '../../utils/session.js';

import { createFullOrPartialSession } from '../../auth/oauth/utils.js';
import { saveAvatarFromUrl } from '../../utils/userData.js';
import { sendMail } from '../../utils/mail/mail.js';


// ======================================
//			Fetching User's Infos
// ======================================

/**
 * Fetches the user token from the OAuth provider.
 * @param provider - OAuth provider data
 * @param tokenUrl - Token endpoint URL
 * @param code - Authorization code received from the provider
 * @returns Promise resolving to the OAuth token data
 * @throws Error if the token request fails or no access token is returned
 */
async function fetchUserToken(provider: OauthProvider, tokenUrl:string, code: string, reply: FastifyReply): Promise<OAuth.Token | void> {
	const secret = decryptSecret(provider.client_secret_encrypted);

	const tokenRes = await fetch(tokenUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Accept': 'application/json'
		},
		body: new URLSearchParams({
			code,
			client_id: provider.client_id,
			client_secret: secret,
			redirect_uri: provider.discovery_url,
			grant_type: 'authorization_code'
		})
	});

	if (tokenRes.status === 400)
		return reply.status(400).send('Authorization code invalid or already used.');

	if (!tokenRes.ok)
		return reply.status(500).send(`Token request failed with status ${tokenRes.status}`);

	const tokenData = (await tokenRes.json()) as OAuth.Token;
	if (!tokenData.access_token)
		return reply.status(500).send('No access token returned from provider');
	
	return tokenData;
};

/**
 * Fetches user info from the OAuth provider using the access token.
 * @param providerName - Name of the OAuth provider
 * @param accessToken - Access token obtained from the provider
 * @returns Promise resolving to normalized user info
 * @throws Error if the user info request fails or the API URL is not configured
 */
async function fetchUserInfo(
	providerName: OAuth.ProviderName,
	accessToken: string
): Promise<OAuth.NormalizedUserInfo> {

	const apiUrl = OAuth.ProvidersApiUri[providerName];
	if (!apiUrl)
		throw new Error('User info API URL not configured for provider');

	const userRes = await fetch(apiUrl, {
		headers: { Authorization: `Bearer ${accessToken}` }
	});

	if (!userRes.ok)
		throw new Error(`User info request failed with status ${userRes.status}`);

	// raw provider-specific user info
	const rawInfo = await userRes.json() as OAuth.UserInfo;

	// normalized output
	return OAuth.normalizeUserInfo(rawInfo, providerName);
}

// ======================================
//			Handle Reply
// ======================================

function handleLoggedInUser(
	userInfo:		OAuth.NormalizedUserInfo,
	provider:		OAuth.ProviderName,
	request:		FastifyRequest,
	reply:			FastifyReply
) {
	const sessionToken = request.cookies.session || request.headers['authorization']?.split(' ')[1];
	const session = checkTokenValidity(sessionToken!).session;
	if (!session || !session.user_id)
		return reply.status(401).send('Unauthorized: Invalid or expired session');

	const oauthAccount = getOauthAccountByProviderAndProviderUserId(provider, userInfo.id);
	if (oauthAccount) // OAuth account already linked
		return reply.status(400).send('OAuth account already linked');

	const oauthAcc = createOauthAccount({
		user_id:			session.user_id,
		provider_name:		provider,
		provider_user_id:	userInfo.id,
		profile_json:		JSON.stringify(userInfo),
		linked_at:			Math.floor(Date.now() / 1000),
		revoked_at:			undefined
	});
	if (!oauthAcc)
		return reply.status(500).send('Failed to link OAuth account');

	return reply.send('OAuth account linked successfully');
}

function sanitizeUsername(inputUsername: string, email: string): string {
	let username = inputUsername.toLowerCase(); // Only lowercase

	// Only keep alphanumeric and underscores
	username = username.replace(/[^a-z0-9_]/g, '');

	// Check length validity
	if (username.length < 3 || username.length > 20) {
		// Not valid -> try to keep part before '@' in email
		username = email.split('@')[0].toLowerCase();
		username = username.replace(/[^a-z0-9_]/g, '');
	}

	// Adjust length
	if (username.length < 3)
		username += generateRandomToken(3).slice(0, 3 - username.length); // pad if too short

	if (username.length > 20)
		username = username.slice(0, 20); // trim if too long

	return username;
}

async function handleOauthUserCreation(
	userInfo:	OAuth.NormalizedUserInfo,
	tokenData:	OAuth.Token,
	provider:	OAuth.ProviderName,
	request:	FastifyRequest,
	reply:		FastifyReply
) {
	const existingUser = getUserByEmail(userInfo.email);
	if (existingUser)
		return reply.status(409).send('Please log in and link your OAuth account from your profile settings.');

	const randPass = await hashString(generateRandomToken(50));

	const user = createUser(
		userInfo.email,
		randPass,
		getRoleByName('user')!.role_id
	);
	
	if (!user)
		return reply.status(500).send('Failed to create account');

	const existingProfile = getProfileByUsername(userInfo.username);
		let username = existingProfile ? userInfo.username : userInfo.username;
		username = sanitizeUsername(username, userInfo.email);

	let avatarFileName: string | undefined;
	if (userInfo.avatar) {
		try {
			avatarFileName = await saveAvatarFromUrl(user.user_id.toString(), userInfo.avatar);
		} catch (err) {
			console.error("Failed to save avatar:", err);
		}
	}

	const clientIp = request.ip || request.headers['x-forwarded-for']?.toString() || 'unknown';
	let countryId: number | undefined;
	const geo = geoip.lookup(clientIp);
	if (geo && geo.country) {
		const country = getCountryByCode(geo.country);
		if (country) countryId = country.country_id;
	}

	const userProfile = createProfile(
		user.user_id,
		username,
		userInfo.username,
		avatarFileName,
		countryId
	);
	if (!userProfile)
		return reply.status(500).send('Failed to create profile');

	const oauthAcc = createOauthAccount({
		user_id:			user.user_id,
		provider_name:		provider,
		provider_user_id:	userInfo.id,
		profile_json:		JSON.stringify(userInfo),
		id_token_hash:		tokenData.id_token ?
								await hashString(tokenData.id_token)
								: undefined,
		linked_at:			Math.floor(Date.now() / 1000),
		revoked_at:			undefined
	});

	if (!oauthAcc)
		return reply.status(500).send('Failed to create account');
	
	const verificationToken = generateRandomToken(32);
	const encryptedToken = await hashString(verificationToken);
	createEmailVerification({
		user_id: user.user_id,
			token: encryptedToken,
			expires_at: Date.now() + 60 * 60 * 1000,
		});
		sendMail(
			user.email,
			"Welcome to ft_transcendence!",
			"accountVerification.html",
			{
				HEADER: "Welcome to ft_transcendence!",
				VERIFICATION_LINK: `https://${process.env.DOMAIN_NAME}/verify?user=${user.user_id}&token=${encodeURIComponent(verificationToken)}`,
			},
			`verify@${process.env.MAIL_DOMAIN || 'example.com'}`
		).catch(err => console.error("Failed to send email:", err));

	const queryParams = request.query as Record<string, string>;
	const requestId = queryParams.state;

	return createFullOrPartialSession(user.user_id, request, reply, true, true, requestId);
}

// ================================================
//				Main Route
// ================================================

export function oauthCallbackRoutes(fastify: FastifyInstance) {
	fastify.get(
	'/:provider/callback',
	{
		schema: oauthCallbackSchema,
		validatorCompiler: () => () => true
	},	
	async (request, reply) => {
		const { provider } = request.params as { provider: OAuth.ProviderName };
		const { code } = request.query as { code?: string };
		if (!code) return reply.status(400).send('Missing code');

		const providerData = getOauthProviderByName(provider);
		if (!providerData) return reply.status(404).send('OAuth provider not found');

		const tokenUrl = OAuth.ProvidersUri[provider];
		if (!tokenUrl) return reply.status(500).send('OAuth provider URL not configured');

		try {
			const tokenData = await fetchUserToken(providerData, tokenUrl, code, reply);

			if (!tokenData)
				return;

			const userInfo = await fetchUserInfo(provider, tokenData.access_token);

			const sessionToken = request.cookies.session || request.headers['authorization']?.split(' ')[1];
			if (sessionToken) // If user is logged in, try to link account
				return handleLoggedInUser(userInfo, provider, request, reply);
			
			const oauthAccount = getOauthAccountByProviderAndProviderUserId(provider, userInfo.id);

			const queryParams = request.query as Record<string, string>;
			const requestId = queryParams.state;

			if (oauthAccount)
				return createFullOrPartialSession(oauthAccount.user_id, request, reply, true, true, requestId);

			return handleOauthUserCreation(
				userInfo,
				tokenData,
				provider,
				request, reply);
		} catch (error) {
			console.error('OAuth callback error:', error);
			return reply.status(500).send('Internal Server Error');
		}
	});
}