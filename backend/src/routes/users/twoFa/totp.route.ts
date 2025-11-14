/**
 * @file totp.route.ts
 * @description TOTP (2FA) routes with shared validation logic and anti-enumeration.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
	generateTotpTokenSchema,
	validateTotpSchema
} from '../../../plugins/swagger/schemas/twoFa.schema.js';
import { requirePartialAuth } from '../../../middleware/auth.middleware.js';

import { checkRateLimit } from '../../../utils/security.js';
import {
	getUserTotpMethodById,
	verify2FaMethod
} from '../../../db/index.js';
import { verifyTotp } from '../../../auth/2Fa/totpUtils.js';
import {
	decryptSecret,
	generateRandomToken,
	signToken
} from '../../../utils/crypto.js';

// ---------- Types ----------
interface TotpBody {
	twofa_uuid: string;
	totp_code: string;
}

// ---------- Rate limiting ----------
const ipRequestCount: Record<string, { count: number; lastReset: number }> = {};
const userRequestCount: Record<string, { count: number; lastReset: number }> = {};
const RATE_LIMIT = 5;
const IP_RATE_WINDOW = 60_000;
const USER_RATE_WINDOW = 300_000;

// ---------- Shared logic ----------
async function handleTotpValidation(
	request: FastifyRequest,
	reply: FastifyReply,
	{
		requireVerified = false,
		issueToken = false
	}: { requireVerified?: boolean; issueToken?: boolean }
) {
	const session = (request as any).session;
	const userId = session?.user_id;
	const ip = session?.ip || request.ip || 'unknown';
	const body = request.body as TotpBody;

	// --- Rate limit ---
	if (!checkRateLimit(ipRequestCount, ip, reply, RATE_LIMIT, IP_RATE_WINDOW))
		return reply.status(429).send({ message: 'Too many requests. Try again later.' });

	if (!checkRateLimit(userRequestCount, userId, reply, RATE_LIMIT, USER_RATE_WINDOW))
		return reply.status(429).send({ message: 'Too many requests. Try again later.' });

	// --- Input validation ---
	if (!body?.twofa_uuid || !body?.totp_code)
		return reply.status(400).send({ message: 'twofa_uuid and totp_code are required.' });

	if (!/^\d{6,8}$/.test(body.totp_code))
		return reply.status(400).send({ message: 'Invalid TOTP format. Must be 6–8 digits.' });

	// --- Retrieve method (anti-enumeration: generic 404) ---
	const methodDetails = getUserTotpMethodById(body.twofa_uuid);
	if (
		!methodDetails ||
		methodDetails.method.method_type !== 1 ||
		methodDetails.method.user_id !== userId
	)
		return reply.status(404).send({ message: 'TOTP method not found.' });

	if (requireVerified && !methodDetails.method.is_verified)
		return reply.status(404).send({ message: 'TOTP method not found.' });

	// --- Verify code ---
	try {
		const secret = decryptSecret(Buffer.from(methodDetails.totp.secret_encrypted, 'hex'));
		const meta = JSON.parse(methodDetails.totp.secret_meta || '{}');
		const digits = meta.digits || 6;
		const period = meta.period || 30;
		const algorithm = meta.algorithm || 'sha1';

		if (!verifyTotp(secret, body.totp_code, digits, period, algorithm))
			return reply.status(401).send({ message: 'Invalid or expired TOTP code.' });
	} catch {
		return reply.status(500).send({ message: 'Failed to process TOTP verification.' });
	}

	// --- Specific actions ---
	if (issueToken) {
		const token = signToken(
			`2fa_totp:${methodDetails.totp.method_id}:${generateRandomToken(16)}`
		);
		return reply.status(200).send({ token });
	}

	if (!verify2FaMethod(methodDetails.totp.method_id))
		return reply.status(404).send({ message: 'TOTP method not found.' });

	return reply.status(200).send({ message: 'TOTP code validated successfully.' });
}

// ---------- Routes ----------
export async function totpRoutes(fastify: FastifyInstance) {

	fastify.post(
		'/twofa/totp/validate',
		{
			preHandler: requirePartialAuth,
			schema: validateTotpSchema,
			validatorCompiler: () => () => true
		},
		async (req, rep) => handleTotpValidation(req, rep, {})
	);

	fastify.post(
		'/twofa/totp/token',
		{
			preHandler: requirePartialAuth,
			schema: generateTotpTokenSchema,
			validatorCompiler: () => () => true
		},
		async (req, rep) => handleTotpValidation(req, rep, { requireVerified: true, issueToken: true })
	);
}