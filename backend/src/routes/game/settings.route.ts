/**
 * @file settings.route.ts
 * @description This file defines the routes for game settings management.
 */

import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { parseGameConfig } from "./utils.js";
import { gameUpdateSettings, gameGetSettings, gameGetSettingsByGameId } from "../../game/workers/init.js";
import type * as game from '../../game/workers/game/game.types.js';
import type * as msg from "../../game/sockets/socket.types.js";
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
			console.log("DEBUG:  1 Games = ", activeGames + " | config = ", body.settings);
			for (const [, g] of activeGames.entries()) {
				console.log("DEBUG: userId = " + userId + " | g.players = " + g.players);
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
			console.log("DEBUG:  2 games = ", activeGames + " | config = ", body.settings);

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
				let settings: any = null;
				let foundGameId: string | null = null;
				if (q?.gameId) {
					foundGameId = q.gameId;
					settings = gameGetSettingsByGameId(q.gameId);
				} else if (q?.code) {
					// find game by code
					for (const [gid, g] of activeGames.entries()) {
						if (String(g.code).toUpperCase() === String(q.code).toUpperCase()) {
							foundGameId = gid;
							break;
						}
					}
					if (foundGameId) settings = gameGetSettingsByGameId(foundGameId);
				} else {
					// fallback: require user to be in a game and return their game's settings
					if (!userId)
						return reply.status(400).send({ error: 'User ID is required to get settings.' });
					// determine user's gameId
					for (const [gid, g] of activeGames.entries()) {
						if (g.players.has(userId)) {
							foundGameId = gid;
							break;
						}
					}
					settings = gameGetSettings(userId);
				}

				if (!settings)
					return reply.status(404).send({ error: 'Settings not found for the game.' });

				// Normalize to msg.settingsPayload if we have a raw game.config
				let payload: msg.settingsPayload;
				if (settings && typeof settings === 'object' && settings.game !== undefined) {
					const gid = foundGameId ?? '';
					const ownerId = gid ? (activeGames.get(gid)?.ownerId ?? userId) : userId;
					payload = {
						gameId: gid,
						userId: ownerId,
						newSettings: settings
					} as msg.settingsPayload;
				} else {
					payload = settings as msg.settingsPayload;
				}

				if (!payload)
					return reply.status(404).send({ error: 'Settings not found for the game.' });

				return reply.status(200).send({ settings: payload });
			} catch (err) {
				console.error('Error getting settings:', err);
				return reply.status(500).send({ error: 'Internal server error.' });
			}
		}
	);
}