/**
 * @file handlers.ts
 * @description This file contains handlers for different message types in the game worker.
 */

import { parentPort } from 'worker_threads';
import * as msg from '../../sockets/socket.types.js';
import type * as worker from '../worker.types.js';
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
export function playerHandler(msg: msg.message<msg.playerPayload>, games: Map<string, Game>, gameStates: Map<string, "starting" | "playing" | "paused" | "stopped" | "ended">) {
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
		if (gameStates.get(game.id) == "playing") {
			gameStates.set(game.id, "stopped");
		}
		console.log("ID: ", game.id);
		// if (game.players.length < 2)
		// 	gameStates.set(payload.gameId, "paused");
		if (game.ownerId === payload.playerId) { // Transfer ownership if the owner leaves
			game.ownerId = game.players.length > 0 ? game.players[0].id : (game.spectators.length > 0 ? game.spectators[0].id : "");
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
			// Notify all players about the new owner
			const ownerMessage = {
				type: "playerSync",
				payload: message,
				userIds: Array.from(game.players.values()).map(p => p.id).concat(Array.from(game.spectators.values()).map(s => s.id))
			};
			parentPort!.postMessage(ownerMessage);
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

	game.updateSettings(payload.newSettings, payload.userId);
	const message = {
		type: "settings",
		payload: payload.newSettings,
		userIds: Array.from(game.players.values()).map(p => p.id)
	};
	parentPort!.postMessage(message);
}

/**
 * Handler for processing player inputs.
 * @param msg - The message containing the input payload.
 * @param games - The map of active games.
 */
export function inputsHandler(msg: msg.message<msg.workerInputPayload>, games: Map<string, Game>, gameStates: Map<string, "starting" | "playing" | "paused" | "stopped" | "ended">) {
	const payload = msg.payload as msg.workerInputPayload;
	const game = games.get(payload.gameId);
	if (!game) {
		console.warn(`Game with ID ${payload.gameId} not found for input handling.`);
		return;
	}

	if (gameStates.get(payload.gameId) !== "playing") {
		console.warn(`Game with ID ${payload.gameId} is not in playing state; ignoring inputs.`);
		return;
	}

	const player = game.getPlayerById(payload.userId);
	if (!player) {
		console.warn(`Player with ID ${payload.userId} not found in game ${payload.gameId} for input handling.`);
		return;
	}

	if (!payload.inputs || payload.inputs.length === 0) return;

	// calibrate frameOffset if needed
	const clientLatest = Math.max(...payload.inputs.map(f => f.frameId));
	if (player.frameOffset === undefined) {
		const estimatedNetworkLag = game.config.network.inputDelayFrames ?? 2;
		player.frameOffset = game.currentFrameId - clientLatest - estimatedNetworkLag;
	}

	const MAX_PAST_FRAMES = 120;
	const MAX_FUTURE_FRAMES = 10;

	const acceptedFrames: { serverFrame: number; inputs: msg.gameInput[] }[] = [];

	for (const inputFrame of payload.inputs) {
		const serverFrame = inputFrame.frameId + (player.frameOffset ?? 0);

		if (serverFrame < game.currentFrameId - MAX_PAST_FRAMES) continue;
		if (serverFrame > game.currentFrameId + MAX_FUTURE_FRAMES) continue;

		// store for possible replay / ordering
		player.addInputsForServerFrame(serverFrame, inputFrame.inputs);

		// apply immediately to player state
		player.applyPersistentInputs(inputFrame.inputs);

		acceptedFrames.push({ serverFrame, inputs: inputFrame.inputs });
	}

	// ack last accepted frame to sender (optional but useful)
	if (acceptedFrames.length > 0) {
		const lastAccepted = acceptedFrames[acceptedFrames.length - 1].serverFrame;
		const ackMsg = {
			type: "inputAck",
			payload: { lastAcceptedServerFrame: lastAccepted },
			userIds: [player.id]
		};
		parentPort!.postMessage(ackMsg);
	} else
		console.warn(`No valid input frames from player ${payload.userId} were accepted.`);

	// broadcast validated inputs to other players (serverFrame numbers)
	if (acceptedFrames.length > 0) {
		const clientInputPayload: msg.clientInputPayload = {
			userId: payload.userId,
			inputs: acceptedFrames.map(f => ({
				frameId: f.serverFrame,
				inputs: f.inputs
			}))
		};

		const recieverIds = game.players
			.filter(p => p.id !== payload.userId)
			.map(p => p.id);

		const message: worker.workerMessage = {
			type: "input",
			payload: clientInputPayload,
			userIds: recieverIds
		};
		parentPort!.postMessage(message);
	}
}
