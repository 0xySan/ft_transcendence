/**
 * @file Oauth utilities
 * Utility functions for OAuth operations.
 */

import { oauthAccount } from "../../db/index.js";
import { createNewSession } from "../../utils/session.js";

/**
 * Creates a new session for the given OAuth account and sets the session cookie.
 * @param oauthAccount - The oauthAccount object representing the linked OAuth account
 * @param request - The Fastify request object
 * @param reply - The Fastify reply object
 * @returns A redirect response to the auth success page or an error response
 */
export async function returnOauthSession(oauthAccount: any, request: any, reply: any) {
	const result = createNewSession(oauthAccount.user_id, {
		ip: request.ip,
		userAgent: request.headers['user-agent']
	});

	if (!result) {
		return reply.status(500).send({ error: 'Failed to create session' });
	}

	reply.setCookie('session', result.token, {
		path: '/',
		httpOnly: true,
		secure: process.env.NODE_ENV !== 'test',
		sameSite: 'Strict',
		maxAge: 60 * 60 * 24 * 30 // 30 days
	});
	return reply.redirect(`/auth/success?provider=${oauthAccount.provider_name}`);
}