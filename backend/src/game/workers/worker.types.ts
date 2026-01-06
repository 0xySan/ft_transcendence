/**
 * @file worker.types.ts
 * @description This file contains type definitions for game worker threads.
 */

import { Worker as NodeWorker } from "worker_threads";
import type * as socket from "../sockets/socket.types.js";
import WebSocket from "ws";

/**
 * Information about a game worker.
 * - **worker**: The Worker instance.
 * - **activeGames**: List of active game UUIDs handled by this worker.
 * - **activePlayers**: Number of active players handled by this worker.
 */
export interface WorkerInfo {
	worker:			NodeWorker;
	activeGames:	string[];
	activePlayers:	number;
}

/**
 * Information about an active game.
 * - **worker_id**: Identifier of the worker handling the game.
 * - **code**: 4-character game code.
 * - **ownerId**: Owner ID of the game.
 * - **visibility**: Boolean indicating if the game is public or private.
 * - **players**: List of player IDs participating in the game.
 */
export interface activeGame {
	worker_id:		number;
	code:			string;
	ownerId:		string;
	visibility:		boolean;
	players:		Map<string, WebSocket | null>;
}

/**
 * Message structure for communication between workers and the main thread.
 * - Extends the base socket message structure.
 * - **userIds**: List of user IDs related to the message.
 */
export interface workerMessage extends socket.message<any> {
	userIds: string[];
	gameId?: string;
}