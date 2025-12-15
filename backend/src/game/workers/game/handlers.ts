/**
 * @file handlers.ts
 * @description This file contains handlers for different message types in the game worker.
 */

import { parentPort } from 'worker_threads';
import * as msg from '../../sockets/socket.types.js';
import { Game } from '../game/game.class.js';
import { Player } from './player.class.js';

/**
 * Handler for creating a new game.
 * @param msg - The message containing the create payload.
 * @param games - The map of active games.
 */
export function createHandler(msg: msg.message<msg.createPayload>, games: Map<string, Game>) {
	const payload = msg.payload as msg.createPayload;
	const game = new Game(payload.uuid, payload.ownerId, payload.gameConfig);
	games.set(game.id, game);
}

/**
 * Handler for player join/leave actions.
 * @param msg - The message containing the player payload.
 * @param games - The map of active games.
 */
export function playerHandler(msg: msg.message<msg.playerPayload>, games: Map<string, Game>) {
	const payload = msg.payload as msg.workerPlayerPayload;
	const game = games.get(payload.gameId);
	if (!game) {
		console.warn(`Game with ID ${payload.gameId} not found for player action.`);
		return;
	}
	// Build the message to send to the players
	let playerStatus: msg.playerStatus = payload.status === "spectator" ? "spectator" : "player";
	// Handle player join/leave
	if (payload.action === "join") {
		const player = new Player(payload.playerId, payload.displayName);
		if (playerStatus === "spectator")
			game.addSpectator(player);
		else if (!game.addPlayer(player)) {
			game.addSpectator(player); // Fallback to spectator if player slots are full
			playerStatus = "spectator";
		}
	}
	else if (payload.action === "leave") {
		game.removePlayer(payload.playerId);
		if (game.players.length === 0 && game.spectators.length === 0) {
			games.delete(game.id); // Clean up empty games
			return;
		}
	}
	const messagePayload: msg.playerPayload = {
			playerId: payload.playerId,
			displayName: payload.displayName,
			status: playerStatus,
			action: payload.action
		};
	// Notify all players in the game about the player joining/leaving
	game.broadcast("player", messagePayload);
}

/**
 * Handler for updating game settings.
 * @param msg - The message containing the settings payload.
 * @param games - The map of active games.
 * @returns - void
 */
export function settingsHandler(msg: msg.message<msg.settingsPayload>, games: Map<string, Game>) {
	const payload = msg.payload as msg.settingsPayload;
	const game = games.get(payload.gameId);
	if (!game) {
		console.warn(`Game with ID ${payload.gameId} not found for settings update.`);
		return;
	}
	game.updateSettings(payload.newSettings);
	const message = {
		type: "settings",
		payload: payload.newSettings,
		userIds: Array.from(game.players.values()).map(p => p.id)
	};
	parentPort!.postMessage(message);
}