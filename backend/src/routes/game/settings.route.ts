/**
 * @file settings.route.ts
 * @description This file defines the routes for game settings management.
 */

import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { parseGameConfig } from "./utils.js";
import { gameUpdateSettings } from "../../game/workers/init.js";
import { activeGames } from "../../globals.js";

export function gameSettingsRoute(fastify: FastifyInstance) {
	fastify.post(
		'/settings',
		{
			preHandler: requireAuth,
		},
		async (request, reply) => {
			const userId = (request as any).session.user_id;
			const body = request.body as { settings: any };

			if (!userId)
				return reply.status(400).send({ error: 'User ID is required to update settings.' });
			let game = null;
			for (const [, g] of activeGames.entries()) {
				if (g.players.has(userId)) {
					game = g;
					break;
				}
			}
			if (!game)
				return reply.status(404).send({ error: 'Game not found for the user.' });

			if (!body.settings)
				return reply.status(400).send({ error: 'Settings data is required.' });

			const [valid, config] = parseGameConfig(body.settings);
			if (!valid || typeof config === 'string' || !config.game)
				return reply.status(400).send({ error: config });

			gameUpdateSettings(userId, config);

			return reply.status(202).send({
				message: 'Settings accepted for processing.',
			});
		}
	);
}