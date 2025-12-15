/**
 * @file startGame.ts
 * @description This file contains type definitions for socket communication in the game server.
 */

import { workers } from "../../../globals.js";
import * as socket from "../socket.types.js";

/**
 * Parses and validates the game payload from incoming messages.
 * @param payload - The raw payload to parse.
 * @returns The validated game payload or null if invalid.
 */
export function parseGamePayload(payload: any): socket.gamePayload | null {
	if (!payload) return null;
	if (typeof payload.action !== "string") return null;
	if (!["start", "pause", "resume", "abort"].includes(payload.action)) return null;
	return {
		action: payload.action as socket.gameAction,
	};
}

/**
 * Handles incoming game messages and updates the game state accordingly.
 * @param ws - The game socket from which the message was received.
 * @param payload - The validated game payload.
 */
export function handleGameMessage(
	ws:			socket.gameSocket,
	payload:	socket.gamePayload
): void {
	const workerEntry = workers.find(w => w.activeGames.includes(ws.gameId));
	if (!workerEntry) return;

	// Notify the worker to update the game state
	workerEntry.worker.postMessage({
		type: "game",
		payload: {
			gameId: ws.gameId,
			action: payload.action
		} as socket.workerGamePayload
	} as socket.message<socket.workerGamePayload>);
}