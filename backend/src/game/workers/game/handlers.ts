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
	const game = new Game(payload.uuid, false, payload.ownerId, payload.gameConfig);
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
		const message : msg.playerSyncPayload = {
			ownerId: game.ownerId,
			players: Array.from(game.players.values()).map(p => ({
				playerId: p.id,
				displayName: p.name,
				status: "player" as msg.playerStatus
			})).concat(
				Array.from(game.spectators.values()).map(s => ({
					playerId: s.id,
					displayName: s.name,
					status: "spectator" as msg.playerStatus
				}))
			)
		};
		// Send the updated player list to the new player only
		const personalMessage = {
			type: "playerSync",
			payload: message,
			userIds: [payload.playerId]
		};
		parentPort!.postMessage(personalMessage);
	}
	else if (payload.action === "leave") {
		game.removePlayer(payload.playerId);
		if (game.players.length === 0 && game.spectators.length === 0) {
			games.delete(game.id); // Clean up empty games
			return;
		}
		if (game.ownerId === payload.playerId) // Transfer ownership if the owner leaves
			game.ownerId = game.players.length > 0 ? game.players[0].id : (game.spectators.length > 0 ? game.spectators[0].id : "");
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

/**
 * Handler for processing player inputs.
 * @param msg - The message containing the worker input payload.
 * @param games - The map of active games.
 */
export function inputsHandler(msg: msg.message<msg.workerInputPayload>, games: Map<string, Game>) {
	const payload = msg.payload as msg.workerInputPayload;
	const game = games.get(payload.gameId);
	if (!game) {
		console.warn(`Game with ID ${payload.gameId} not found for input handling.`);
		return;
	}
	const player = game.getPlayerById(payload.userId);
	if (!player) {
		console.warn(`Player with ID ${payload.userId} not found in game ${payload.gameId} for input handling.`);
		return;
	}
	player.addInputs(payload.inputs);
}