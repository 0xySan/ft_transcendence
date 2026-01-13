/**
 * @file init.ts
 * @description This file initializes game workers and manages player assignments.
 */

import { Worker } from "worker_threads";
import { fileURLToPath } from "node:url";
import path from "path";
import os from "os";

import { getStatsByUserId, createStats, updateStats, incrementGamesWon, incrementGamesLost } from "../../db/wrappers/main/users/userStats.js"
import { createGame, getAllGames } from "../../db/wrappers/main/games/games.js"
import { addParticipant } from "../../db/wrappers/main/games/gameParticipants.js"
import { v7 as uuidv7 } from "uuid";

import type * as msg from "../sockets/socket.types.js";
import * as game from "../workers/game/game.types.js";

import{ activeGames, workers } from "../../globals.js";
import WebSocket from "ws";
import { workerMessage } from "./worker.types.js";

const NUM_WORKERS = os.cpus().length;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

for (let i = 0; i < NUM_WORKERS; i++) {
	const worker = new Worker(path.resolve(__dirname, "game/loop.js"), {
		workerData: { workerId: i },
	});

	worker.on("message", (msg: workerMessage) => {
		const message = JSON.stringify({
			type: msg.type,
			payload: msg.payload
		});

		if (msg.type === "db" && msg.payload as msg.dbPayload) {
			let winner_id: string = "null";

			for (const stat of msg.payload.users) {
				let userStats = getStatsByUserId(stat.userId);

				if (!userStats)
					userStats = createStats(stat.userId);

				if (userStats) {
					updateStats(stat.userId, {
						games_played: (userStats.games_played ?? 0) + 1,
						earn_points: (userStats.earn_points ?? 0) + stat.earnPoints,
						total_play_time: (userStats.total_play_time ?? 0) + msg.payload.timeGame
					});

					if (stat.state == "win") { incrementGamesWon(userStats.user_id); winner_id = userStats.user_id; }
					else if (stat.state == "lose") incrementGamesLost(userStats.user_id);
				}
			}

			const newGameId = uuidv7();

			createGame("online", msg.payload.scoreLimit, msg.payload.users.length, msg.payload.timeGame, "completed", winner_id, JSON.stringify(msg.payload.pointsTime), newGameId);
			for (const stat of msg.payload.users) {
				if (stat.state == "null") stat.state = "draw";
				else if (stat.state == "lose") stat.state = "loss";
				addParticipant(newGameId, stat.userId, stat.score, stat.state, msg.payload.users.length > 2 ? 2 : 1);
			}

			return;
		}

		for (const userId of msg.userIds) {
			for (const [gameId, gameObj] of activeGames.entries()) {
				if (gameObj.players.has(userId)) {
					const ws = gameObj.players.get(userId);
					if (ws && ws.readyState === WebSocket.OPEN) {
						ws.send(message);
					}
				}
			}
		}
	});

	worker.on("error", (err) => {
		console.error(`Worker ${i} error:`, err);
	});

	worker.on("exit", (code) => {
		if (code !== 0) console.error(`Worker ${i} stopped with exit code ${code}`);
	});

	workers.push({ worker: worker, activeGames: [], activePlayers: 0 });
}

/**
 * Assigns a new game to the least loaded worker.
 * @param uuid - Unique identifier for the game.
 * @param ownerId - Owner ID of the game.
 * @param gameConfig - Configuration settings for the game.
 * @returns **true** if the game was successfully assigned to a worker, **false** otherwise.
 */
export function assignGameToWorker(uuid: string, ownerId: string, gameConfig: game.config): boolean {
	const workerCharges = workers.map(w => w.activeGames.length + w.activePlayers * 0.5);
	const minChargeIndex = workerCharges.indexOf(Math.min(...workerCharges));
	if (minChargeIndex === -1) return false;
	workers[minChargeIndex].activeGames.push(uuid);
	workers[minChargeIndex].worker.postMessage({
		type: "create",
		payload: {
			uuid: uuid,
			ownerId: ownerId,
			gameConfig: gameConfig
		} as msg.createPayload
	} as msg.message<msg.createPayload>);
	return true;
}

/**
 * Returns the game ID in which a user is currently participating.
 * @param userId - The unique identifier of the user
 * @returns The game ID as a string if found, otherwise null
 */
export function getGameIdByUser(userId: string): string | null {
	// Iterate through active games to find the one containing the userId
	for (const [gameId, gameObj] of activeGames.entries()) {
		if (gameObj.players.has(userId)) {
			return (gameId); // Return the game ID if userId is found
		}
	}
	return null;
}

/**
 * Add a player to a game via the appropriate worker.
 * The worker will then notify all players in the game about the new player.
 * @param uuid - Player unique identifier
 * @param displayName - Player display name
 * @param action - "join" to add the player, "leave" to remove the player
 * @param status - "player" or "spectator" indicating the player's status
 * @returns **true** if the player was successfully added, **false** otherwise.
 */
export function addOrRemovePlayerGameWorker(uuid: string, displayName: string = "", action: msg.playerConnectAction, status: msg.playerStatus = "player"): boolean {
	const gameId = getGameIdByUser(uuid);
	if (!gameId) return false;

	// Find the worker responsible for this game
	const workerEntry = workers.find(w => w.activeGames.includes(gameId));
	if (!workerEntry) return false;

	workerEntry.activePlayers += (action === "join") ? 1 : -1;
	if (workerEntry.activePlayers < 1) {
		activeGames.delete(gameId);
		// Remove the game from the worker's active games list
		workerEntry.activeGames = workerEntry.activeGames.filter(gid => gid !== gameId);
	} else if (action === "leave") {
		activeGames.get(gameId)?.players.delete(uuid);
	}

	// Notify the worker to add the player
	workerEntry.worker.postMessage({
		type: "player",
		payload: {
			playerId: uuid,
			displayName: displayName,
			action: action,
			status: status,
			gameId: gameId
		} as msg.workerPlayerPayload
	} as msg.message<msg.workerPlayerPayload>);

	return true;
}

/**
 * Update game settings via the appropriate worker.
 * @param uuid - User unique identifier
 * @param newSettings - Partial game configuration settings to be updated
 */
export function gameUpdateSettings(uuid: string, newSettings: Partial<game.config>) {
	const gameId = getGameIdByUser(uuid);
	if (!gameId) return;
	// Find the worker responsible for this game
	const workerEntry = workers.find(w => w.activeGames.includes(gameId));
	if (!workerEntry) return;

	const activeGame = activeGames.get(gameId);
	if (!activeGame) return;
	// Only the original owner can change visibility
	if (activeGame.ownerId == uuid)
		activeGame.visibility = newSettings.game?.visibility ?? activeGame.visibility;

	// Notify the worker to update the game settings
	workerEntry.worker.postMessage({
		type: "settings",
		payload: {
			gameId: gameId,
			userId: uuid,
			newSettings: newSettings
		} as msg.settingsPayload
	} as msg.message<msg.settingsPayload>);
}
