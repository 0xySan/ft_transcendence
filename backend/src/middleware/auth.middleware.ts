/**
 * @file backend/src/preHandlers.ts
 * @description Pre-handlers for various routes to enforce security measures.
 */

import { FastifyReply, FastifyRequest } from 'fastify';
import { checkTokenValidity } from '../utils/session.js';
import * as crypto from '../utils/crypto.js';
import { getSessionByTokenHash } from '../db/wrappers/auth/index.js';
/**
 * Middleware to require authentication via session token.
 * @param request The Fastify request object.
 * @param reply The Fastify reply object.
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
	const token = request.cookies.session || request.headers['authorization']?.split(' ')[1];

	if (!token) {
		return reply.status(401).send({ message: 'Unauthorized: No session token' });
	}

	const session = checkTokenValidity(token);
	if (!session.isValid) {
		return reply.status(401).send({ message: 'Unauthorized: Invalid or expired session' });
	}

	// Attach session to request for downstream handlers
	(request as any).session = session.session;
}

export async function requirePartialAuth(request: FastifyRequest, reply: FastifyReply) {
	const token = request.cookies.session || request.headers['authorization']?.split(' ')[1];

	if (!token) {
		return reply.status(401).send({ message: 'Unauthorized: No session token' });
	}

	const tokenHash = crypto.tokenHash(token);
	const session = getSessionByTokenHash(tokenHash);
	if (!session) {
		return { isValid: false, session: null };
	}
	const currentTime = Math.floor(Date.now() / 1000);
	if (session.expires_at <= currentTime || session.stage !== 'partial') {
		return reply.status(401).send({ message: 'Unauthorized: Invalid or expired partial session' });
	}

	(request as any).session = session;
}