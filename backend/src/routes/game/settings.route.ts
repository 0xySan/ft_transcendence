/**
 * @file settings.route.ts
 * @description This file defines the routes for game settings management.
 */

import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { parseGameConfig } from "./utils.js";
import { gameUpdateSettings, gameGetSettings, gameGetSettingsByGameId } from "../../game/workers/init.js";
import type * as game from '../../game/workers/game/game.types.js';
import { postSettingsSchema, getSettingsSchema } from '../../plugins/swagger/schemas/settings.schema.js';
import { activeGames } from "../../globals.js";

export function gameSettingsRoute(fastify: FastifyInstance) {
	fastify.post(
		'/settings',
		{ schema: postSettingsSchema, validatorCompiler: ({ schema }) => {return () => true;}, preHandler: requireAuth },
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

	fastify.get(
		'/settings',
		{ schema: getSettingsSchema, validatorCompiler: ({ schema }) => {return () => true;}, preHandler: requireAuth },
		async (request, reply) => {
			const userId = (request as any).session.user_id;
			const q = request.query as { gameId?: string; code?: string };
			// If a gameId or code is provided allow fetching settings for that game
			try {
				let settings: game.config | null = null;
				if (q?.gameId) {
					settings = gameGetSettingsByGameId(q.gameId);
				} else if (q?.code) {
					// find game by code
					let foundId: string | null = null;
					for (const [gid, g] of activeGames.entries()) {
						if (String(g.code).toUpperCase() === String(q.code).toUpperCase()) {
							foundId = gid;
							break;
						}
					}
					if (foundId) settings = gameGetSettingsByGameId(foundId);
				} else {
					// fallback: require user to be in a game and return their game's settings
					if (!userId)
						return reply.status(400).send({ error: 'User ID is required to get settings.' });
					settings = gameGetSettings(userId);
				}
				if (!settings)
					return reply.status(404).send({ error: 'Settings not found for the game.' });
				return reply.status(200).send({ settings });
			} catch (err) {
				console.error('Error getting settings:', err);
				return reply.status(500).send({ error: 'Internal server error.' });
			}
		}
	);
}