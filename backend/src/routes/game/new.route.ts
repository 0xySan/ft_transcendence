/**
 * @file new.route.ts
 * @description This file contains the route for creating a new game.
 */

import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.middleware.js";

import { v7 as uuidv7 } from "uuid";

import { addUserToGame, getGameByCode, isUserInGame, parseGameConfig } from "./utils.js";
import { generateRandomToken } from "../../utils/crypto.js";
import { wsPendingConnections } from "../../globals.js";
import { assignGameToWorker } from "../../game/workers/init.js";
import { config } from "../../game/workers/game/game.types.js";

export function createNewGameRoute(fastify: FastifyInstance) {
	fastify.post(
		'/new',
		{
			preHandler: requireAuth,
		},
	async (request, reply) => {
		const userId = (request as any).session.user_id;

		if (!userId)
			return reply.status(400).send({ error: 'User ID is required to create a new game.' });

		if (isUserInGame(userId))
			return reply.status(400).send({ error: 'User is already in a game.' });

		const newGameId = uuidv7();
		const authToken = generateRandomToken(32);

		wsPendingConnections.set(authToken, {
			userId: userId,
			gameId: newGameId,
			expiresAt: Date.now() + 5 * 60 * 1000, // Expires in 5 minutes
		});

		
		const [valid, config] = parseGameConfig(request.body);
		if (!valid || typeof config === 'string' || !config.game) {
			wsPendingConnections.delete(authToken);
			return reply.status(400).send({ error: config });
		}

		while (getGameByCode(config.game.code) !== null || config.game.code === '') {
			// Generate a new 4-character code
			config.game.code = Math.random().toString(36).substring(2, 6).toUpperCase();
		}

		addUserToGame(userId, newGameId, config.game.code);


		assignGameToWorker(newGameId, userId, config as config);

		return reply.status(201).send({
			gameId: newGameId,
			code: config.game.code,
			authToken: authToken,
		});
	});
}
