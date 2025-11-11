/**
 *  @file totp.route.ts
 *  @description This file contains the route for TOTP 2FA methods.
 */

import { FastifyInstance } from 'fastify';
import { validateTotpSchema } from '../../../plugins/swagger/schemas/twoFa.schema.js';
import { requireAuth } from '../../../middleware/auth.middleware.js';

import { checkRateLimit } from '../../../utils/security.js';
import { getUser2faTotpByMethodId, getUserTotpMethodById, verify2FaMethod } from '../../../db/index.js';
import { verifyTotp } from '../../../auth/2Fa/totpUtils.js';
import { decryptSecret } from '../../../utils/crypto.js';

interface TotpBody {
	twofa_uuid: string;
	totp_code: string;
}

const ipRequestCount: Record<string, { count: number; lastReset: number }> = {};
const userRequestCount: Record<string, { count: number; lastReset: number }> = {};

const RATE_LIMIT = 5;
const IP_RATE_WINDOW = 1 * 60 * 1000;
const USER_RATE_WINDOW = 5 * 60 * 1000;

export async function totpRoutes(fastify: FastifyInstance) {
	fastify.post(
		'/twofa/totp/validate',
		{
			preHandler: requireAuth,
			schema: validateTotpSchema,
			validatorCompiler: ({ schema }) => { return () => true; }
		},
		async (request, reply) => {
			const session = (request as any).session;
			const userId = session.user_id;
			const ip = session.ip || 'unknown';


			if (!checkRateLimit(ipRequestCount, ip, reply, RATE_LIMIT, IP_RATE_WINDOW))
				return reply.status(429).send({ message: 'Rate limit exceeded. Please try again later.' });

			if (!checkRateLimit(userRequestCount, userId, reply, RATE_LIMIT, USER_RATE_WINDOW))
				return reply.status(429).send({ message: 'Rate limit exceeded. Please try again later.' });
			
			const body = request.body as TotpBody;

			if (!body.twofa_uuid || !body.totp_code)
				return reply.status(400).send({ message: 'twofa_uuid and totp_code are required.' });

			if (!body.totp_code.match(/^\d+$/))
			    return reply.status(400).send({ message: 'Invalid TOTP format.' });

			const methodDetails = getUserTotpMethodById(body.twofa_uuid);
			if (!methodDetails || methodDetails.method.method_type !== 1 || !methodDetails.totp)
				return reply.status(404).send({ message: 'TOTP method not found.' });

			const secret = decryptSecret(Buffer.from(methodDetails.totp.secret_encrypted, 'hex'));
			const meta = JSON.parse(methodDetails.totp.secret_meta || '{}');

			if (!verifyTotp(secret, body.totp_code, meta.digits || 6, meta.period || 30))
				return reply.status(401).send({ message: 'Invalid TOTP code.' });

			const result = verify2FaMethod(methodDetails.method.method_id);
			if (!result)
				return reply.status(500).send({ message: 'Failed to verify TOTP method.' });
			return reply.status(200).send({ message: 'TOTP code validated successfully.' });
		});
}