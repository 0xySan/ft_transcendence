/**
 * @file globals.ts
 * @description This file contains global variables for the backend server.
 */


import * as socket from './game/sockets/socket.types.js';
import * as worker from './game/workers/worker.types.js';
import { WorkerInfo } from "./game/workers/worker.types.js";

/**
 * Map to store pending WebSocket connections.
 * - Key: AuthToken **string**
 * - Value: pendingConnection object containing:
 * 	- userId - **string**, the user identifier
 * 	- gameId - **string**, the game identifier
 * 	- expiresAt - **number**, timestamp when the pending connection expires
 */
export const wsPendingConnections: Map<socket.AuthToken, socket.pendingConnection> = new Map();

// Clean up expired pending connections every minute
setInterval(() => {
	const now = Date.now();
	for (const [token, pending] of wsPendingConnections.entries()) {
		if (pending.expiresAt < now)
			wsPendingConnections.delete(token);
	}
}, 60_000);

/**
 * Array to store information about worker processes.
 */
export const workers: WorkerInfo[] = [];

/**
 * Map to store active games.
 * - Key: Game ID **string**
 * - Value: activeGame object containing:
 * 	- worker_id - **number**, identifier of the worker handling the game
 * 	- code - **string**, 4-character game code
 * 	- players - **string[]**, list of player IDs participating in the game
 */
export const activeGames: Map<string, worker.activeGame> = new Map();