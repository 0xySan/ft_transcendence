/**
 * @file Oauth utilities
 * Utility functions for OAuth operations.
 */

import { FastifyReply, FastifyRequest } from "fastify";
import { getUser2FaMethodsByUserId } from "../../db/index.js";
import { createNewSession } from "../../utils/session.js";

/**
 * @brief Create and return a `full`/`partial session` depending on if the user has **2FA** configured
 * @param userId - The user's uuid
 * @param request - The fastify request object
 * @param reply - The fastify reply object, **its status and reply will be set**
 * @param isPersistent - Affect a `full session` **validity duration** @default to `false`
 * @returns The fastify reply object with **success status**
 * 		- `500` - `Failed to create session`
 * 		- `202` - message: '2FA required.', twoFactorRequired: `true`, twoFactorMethods [**list of available methods**]
 * 		- `200` - `Login successful.`
 */
export async function createFullOrPartialSession(userId: string, request: FastifyRequest, reply: FastifyReply, isPersistent = false) {
	const user2FaMethods = getUser2FaMethodsByUserId(userId)
		.filter(method => method.is_verified)
		.map(method => ({
			method_type: method.method_type,
			label: method.label,
			is_primary: method.is_primary
		}));

	let twoFactorRequired = false;
	if (user2FaMethods.length > 0)
		twoFactorRequired = true;
	
	const session = createNewSession(userId, {
		ip: request.ip,
		userAgent: request.headers['user-agent'],
		stage: twoFactorRequired ? 'partial' : 'active',
		isPersistent: twoFactorRequired ? false : isPersistent
	});

	if (!session) {
		return reply.status(500).send({ error: 'Failed to create session' });
	}

	reply.setCookie('session', session.token, {
		path: '/',
		httpOnly: true,
		secure: process.env.NODE_ENV !== 'test',
		sameSite: 'strict',
		// 2fa = 10 min else isPersistent ? 30 days : 2 hours
		maxAge: twoFactorRequired ? 
			10 * 60 
			: isPersistent ? 
				60 * 60 * 24 * 30
				: 60 * 60 * 2
	});

	if (twoFactorRequired) {
		return reply.status(202).send({
			message: '2FA required.',
			twoFactorRequired: true,
			twoFactorMethods: user2FaMethods
		});
	} else {
		return reply.status(200).send({
			message: 'Login successful.'
		});
	}
}
