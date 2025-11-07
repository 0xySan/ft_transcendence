/**
 * @file routes/users/twoFa.route.ts
 * @description Routes for handling Two-Factor Authentication (2FA) verification.
 */

// src/routes/users/twofa.route.ts
import { FastifyInstance } from 'fastify';
import { getTwoFaMethodsSchema } from '../../../plugins/swagger/schemas/twoFa.schema.js';

import { requireAuth } from '../../../middleware/auth.middleware.js';
import {
	getUser2FaMethodsByUserId,
} from '../../../db/wrappers/auth/2fa/user2FaMethods.js';

export default async function twoFaRoutes(fastify: FastifyInstance) {

	fastify.get('/twofa/',
		{ preHandler: requireAuth, schema: getTwoFaMethodsSchema, validatorCompiler: ({ schema }) => {return () => true;} },
		async (request, reply) => {

		const session = (request as any).session;
		const methods = getUser2FaMethodsByUserId(session.user_id)
			.filter(m => m.is_verified)
			.map(m => ({
				method_type: m.method_type,
				label: m.label,
				is_primary: m.is_primary
			}));
		if (methods.length === 0) {
			return reply.status(404).send({ message: '2Fa is not set up for your account.' });
		}
		return reply.send({ twoFaMethods: methods });
	});
}
