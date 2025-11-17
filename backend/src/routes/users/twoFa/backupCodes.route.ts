/**
 * @file backupCodes.route.ts
 * @description Backup Codes (2FA) routes.
 */

import { FastifyInstance } from 'fastify';
import { requirePartialAuth } from '../../../middleware/auth.middleware.js';
import { getUserBCodesMethodById, updateBCodes } from '../../../db/index.js';
import { generateRandomToken, hashString, signToken, verifyToken } from '../../../utils/crypto.js';

interface VerifyBackupCodeRequestBody {
	uuid: string;
	code: string;
}

interface GetBackupCodeRequestBody {
	uuid: string;
	token: string;
}

export async function backupCodesRoute(fastify: FastifyInstance) {
	fastify.get(
		'/twofa/backup-codes',
		{
			schema: {},
			preHandler: requirePartialAuth,
			validatorCompiler: () => () => true
		},
		async (request, reply) => {
			const session = (request as any).session;
			const userId = session?.user_id;

			if (!userId)
				return reply.status(401).send({ message: 'Unauthorized' });

			const query = request.query as GetBackupCodeRequestBody;
			if (!query?.uuid || !query?.token)
				return reply.status(400).send({ message: 'Invalid request body' });

			try {
				const status = verifyToken(query.token);
				if (!status)
					return reply.status(400).send({ message: 'Invalid token' });
			} catch {
				return reply.status(400).send({ message: 'Invalid token' });
			}

			// Load method
			const codeMethod = getUserBCodesMethodById(query.uuid);
			if (!codeMethod || codeMethod.method.user_id !== userId)
				return reply.status(404).send({ message: 'Backup codes not found' });

			// Success
			return reply.status(200).send({
				codes: JSON.parse(codeMethod.codes.code_json)
			});
		}
	);

	fastify.post(
		'/twofa/backup-codes',
		{
			schema: {},
			preHandler: requirePartialAuth,
			validatorCompiler: () => () => true
		},
		async (request, reply) => {
			const session = (request as any).session;
			const userId = session?.user_id;
			const body = request.body as VerifyBackupCodeRequestBody;

			if (!userId)
				return reply.status(401).send({ message: 'Unauthorized' });

			if (!body?.uuid || !body?.code)
				return reply.status(400).send({ message: 'Invalid request body' });

			// Load method
			const codeMethod = getUserBCodesMethodById(body.uuid);
			if (!codeMethod || codeMethod.method.user_id !== userId)
				return reply.status(404).send({ message: 'Backup codes not found' });

			// Parse codes
			const codes = JSON.parse(codeMethod.codes.code_json) as Array<{
				hash: string;
				used: boolean;
			}>;

			// Hash user input
			const hashedInput = await hashString(body.code);

			// Find match
			const index = codes.findIndex(c => c.hash === hashedInput);
			if (index === -1)
				return reply.status(400).send({ message: 'Invalid backup code' });

			// Already used?
			if (codes[index].used === true)
				return reply.status(400).send({ message: 'Invalid backup code' });

			// Mark as used
			codes[index].used = true;

			// Save to DB
			updateBCodes(codeMethod.codes.backup_code_id, {
				code_json: JSON.stringify(codes)
			});

			const token = signToken(
				`2fa_bcodes:${codeMethod.codes.method_id}:${generateRandomToken(16)}`
			);

			// Success
			return reply.status(200).send({
				token: token,
				remaining: codes.filter(c => !c.used).length
			});
		}
	);
}