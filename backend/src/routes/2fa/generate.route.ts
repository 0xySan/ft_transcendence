/**
 * @file generate.route.ts
 * @description 2FA generation route
 */

import { FastifyInstance } from "fastify";
import { new2faRoutesSchema } from "../../plugins/swagger/schemas/new2faRoutes.schema.js";

export async function new2faRoutes(fastify: FastifyInstance) {
	fastify.post("/2fa/generate", { schema: new2faRoutesSchema, validatorCompiler: ({ schema }) => () => true }, async (request, reply) => {
		try {
			const { username, email, twofa_type } = request.body as {
				username?: string;
				email?: string;
				twofa_type?: string;
			};
			// Here you would implement the logic to generate the 2FA secret
		}
		catch (error) {
			return reply.status(500).send({ error: 'Failed to generate 2FA secret' });
		}
	});
}
