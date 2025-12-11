/**
 * @file backupCodes.route.ts
 * @description Backup Codes (2FA) routes optimized with shared helpers.
 */

import { FastifyInstance } from 'fastify';
import { requirePartialAuth } from '../../../middleware/auth.middleware.js';
import { getUserBCodesMethodById, updateBCodes } from '../../../db/index.js';
import { decryptSecret, generateRandomToken, hashString, signToken, verifyToken } from '../../../utils/crypto.js';
import { checkRateLimit } from '../../../utils/security.js';
import { getBackupCodesSchema, verifyBackupCodeSchema } from '../../../plugins/swagger/schemas/twoFa.schema.js';

interface VerifyBackupCodeRequestBody {
	uuid: string;
	code: string;
}

interface GetBackupCodeRequestBody {
	uuid: string;
	token: string;
}

// ---------- Rate limiting ----------
const ipRequestCount: Record<string, { count: number; lastReset: number }> = {};
const userRequestCount: Record<string, { count: number; lastReset: number }> = {};
const RATE_LIMIT = 5;
const IP_RATE_WINDOW = 60_000;
const USER_RATE_WINDOW = 300_000;

/* ---------------------------------------------------------
 * Shared helpers
 * --------------------------------------------------------- */

/**
 * Ensure user is authenticated
 * @param request - The Fastify request object
 * @param reply - The Fastify reply object
 * @returns The user ID if authenticated, otherwise sends a 401 response
 */
function requireUser(request: any, reply: any) {
	const userId = request.session?.user_id;
	if (!userId) {
		reply.status(401).send({ message: 'Unauthorized' });
		return null;
	}
	return userId;
}

/**
 * Apply rate limiting based on IP and user ID
 * @param request - The Fastify request object
 * @param reply - The Fastify reply object
 * @param userId - The ID of the authenticated user
 * @returns True if within rate limits, otherwise sends a 429 response
 */
function applyRateLimit(request: any, reply: any, userId: string) {
	const ip = request.session?.ip || request.ip || 'unknown';

	if (!checkRateLimit(ipRequestCount, ip, reply, RATE_LIMIT, IP_RATE_WINDOW))
		return reply.status(429).send({ message: 'Too many requests. Try again later.' });

	if (!checkRateLimit(userRequestCount, userId, reply, RATE_LIMIT, USER_RATE_WINDOW))
		return reply.status(429).send({ message: 'Too many requests. Try again later.' });

	return true;
}

/**
 * Retrieve and validate backup codes method
 * @param uuid - UUID of the backup codes method
 * @param userId - ID of the user
 * @param reply - The Fastify reply object
 * @returns The backup codes method details if valid, otherwise sends a 404 response
 */
function getAndValidateMethod(uuid: string, userId: string, reply: any) {
	const codeMethod = getUserBCodesMethodById(uuid);

	if (!codeMethod || codeMethod.method.user_id !== userId) {
		reply.status(404).send({ message: 'Backup codes not found' });
		return null;
	}
	return codeMethod;
}

/* ---------------------------------------------------------
 * Routes
 * --------------------------------------------------------- */

export async function backupCodesRoute(fastify: FastifyInstance) {
	/* ---------------- GET BACKUP CODES ---------------- */
	fastify.get(
		'/twofa/backup-codes',
		{
			preHandler: requirePartialAuth,
		},
		async (request, reply) => {
			const userId = requireUser(request, reply);
			if (!userId) return;

			if (applyRateLimit(request, reply, userId) !== true) return;

			const query = request.query as GetBackupCodeRequestBody;
			if (!query?.uuid || !query?.token)
				return reply.status(400).send({ message: 'Invalid request body' });

			try {
				if (!verifyToken(query.token))
					reply.status(400).send({ message: 'Invalid token' });
			} catch {
				reply.status(400).send({ message: 'Invalid token' });
			}

			const codeMethod = getAndValidateMethod(query.uuid, userId, reply);
			if (!codeMethod) return;
			const codes = JSON.parse(codeMethod.codes.code_json) as Array<{ hash: string; used: boolean }>;

			const parsedCodes = codes.map(c => ({
				hash: Buffer.from(c.hash, 'base64'),
				used: c.used
			}));

			const decryptedCodes = parsedCodes.map(c => decryptSecret(c.hash));
			return reply.status(200).send({
				codes: decryptedCodes,
			});
		}
	);

	/* ---------------- VERIFY BACKUP CODE ---------------- */
	fastify.post(
		'/twofa/backup-codes',
		{
			schema: verifyBackupCodeSchema,
			preHandler: requirePartialAuth,
			validatorCompiler: () => () => true
		},
		async (request, reply) => {
			const userId = requireUser(request, reply);
			if (!userId) return;

			if (applyRateLimit(request, reply, userId) !== true) return;

			const body = request.body as VerifyBackupCodeRequestBody;
			if (!body?.uuid || !body?.code)
				return reply.status(400).send({ message: 'Invalid request body' });

			const codeMethod = getAndValidateMethod(body.uuid, userId, reply);
			if (!codeMethod) return;

			if (codeMethod.method.method_type !== 2 || !codeMethod.method.is_verified)
				return reply.status(404).send({ message: 'Backup codes not found' });


			const codes = JSON.parse(codeMethod.codes.code_json) as Array<{ hash: string; used: boolean }>;

			const parsedCodes = codes.map(c => ({
				hash: Buffer.from(c.hash, 'base64'),
				used: c.used
			}));

			const index = parsedCodes.findIndex(c => {
				console.log('Encrypted code hash:', c.hash);
				const decryptedCode = decryptSecret(c.hash);
				console.log('Decrypted code:', decryptedCode);
				return decryptedCode === body.code;
			});

			if (index === -1 || codes[index].used)
				return reply.status(404).send({ message: 'Backup codes not found' });

			// Use the backup code
			codes[index].used = true;
			updateBCodes(codeMethod.codes.backup_code_id, {
				code_json: JSON.stringify(codes)
			});

			const token = signToken(
				`2fa_bcodes:${codeMethod.codes.method_id}:${generateRandomToken(16)}`
			);

			return reply.status(200).send({
				token,
				remaining: codes.filter(c => !c.used).length
			});
		}
	);
}