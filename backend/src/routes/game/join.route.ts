/**
 * @file join.route.ts
 * @description This file contains the route for joining an existing game.
 */

import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.middleware.js";

import { addUserToGame, getGameByCode, isUserInGame } from "./utils.js";
import { activeGames, wsPendingConnections } from "../../globals.js";

export function joinGameRoute(fastify: FastifyInstance) {
	fastify.post(
		'/join',
		{
			preHandler: requireAuth,
		},
	async (request, reply) => {
		const userId = (request as any).session.user_id;
		const body = request.body as { gameId?: string; code?: string };

		if (!userId)
			return reply.status(400).send({ error: 'User ID is required to join a game.' });

		if (isUserInGame(userId))
			return reply.status(400).send({ error: 'User is already in a game.' });

		let gameId: string | null = null;

		if (body.gameId)
			gameId = body.gameId;
		else if (body.code) {
			const gameEntry = getGameByCode(body.code.toUpperCase());
			if (!gameEntry)
				return reply.status(404).send({ error: 'Game with this code not found.' });
			gameId = gameEntry;
		} else
			return reply.status(400).send({ error: 'You must provide a gameId or code to join.' });

		if (!activeGames.has(gameId))
			return reply.status(404).send({ error: 'Game not found.' });

		// Add user to the game
		addUserToGame(userId, gameId);

		// Generate a temporary auth token for the websocket connection
		const authToken = Math.random().toString(36).substring(2, 10).toUpperCase();

		wsPendingConnections.set(authToken, {
			userId,
			gameId,
			expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
		});

		return reply.status(200).send({
			gameId,
			authToken,
		});
	});
}
