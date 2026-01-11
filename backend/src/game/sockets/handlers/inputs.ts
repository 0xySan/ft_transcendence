/**
 * @file inputs.ts
 * @description This file contains handlers for processing game input messages received via WebSocket.
 */

import { workers } from '../../../globals.js';
import * as msg from '../socket.types.js';

/**
 * Parses and validates the input payload received from a WebSocket message.
 * @param data - The raw data object to be validated and parsed.
 * @returns The validated inputPayload object or null if validation fails.
 */
export function parseInputPayload(data: any): msg.inputPayload | null {
	if (typeof data !== 'object' || data === null) return null;
	if (!Array.isArray(data.inputs)) return null;

	const inputs: msg.inputFrame[] = [];

	for (const frame of data.inputs) {
		if (typeof frame !== 'object' || frame === null) return null;
		if (typeof frame.frameId !== 'number') return null;
		if (!Array.isArray(frame.inputs)) return null;

		const gameInputs: msg.gameInput[] = [];

		for (const input of frame.inputs) {
			if (typeof input !== 'object' || input === null) return null;
			if (typeof input.key !== 'string') return null;
			if (typeof input.pressed !== 'boolean') return null;

			gameInputs.push({
				key: input.key,
				pressed: input.pressed,
			});
		}

		inputs.push({
			frameId: frame.frameId,
			inputs: gameInputs,
		});
	}

	return { inputs };
}

export function handleInputMessage(
	ws:			msg.gameSocket,
	payload:	msg.inputPayload
): void {
	// Currently, input handling is done in the worker thread.
	// Find the worker responsible for this game and forward the inputs.
	const workerEntry = workers.find(w => w.activeGames.includes(ws.gameId));
	if (!workerEntry) return;

	workerEntry.worker.postMessage({
		type: "input",
		payload: {
			gameId: ws.gameId,
			userId: ws.id,
			inputs: payload.inputs
		} as msg.workerInputPayload
	} as msg.message<msg.workerInputPayload>);
}