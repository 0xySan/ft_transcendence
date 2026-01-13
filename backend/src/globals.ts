/**
 * @file globals.ts
 * @description This file contains global variables for the backend server.
 */


import * as socket from './game/sockets/socket.types.js';
import * as worker from './game/workers/worker.types.js';
import * as game from "./game/workers/game/game.types.js";
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
 * 	- ownerId - **string**, Owner ID of the game
 * 	- visibility - **boolean**, indicates if the game is public or private
 * 	- players - **string[]**, list of player IDs participating in the game
 */
export const activeGames: Map<string, worker.activeGame> = new Map();

export interface TournamentMatch {
	matchId: string;
	gameId: string | null;
	player1Id: string | null;
	player2Id: string | null;
	player1Ready: boolean;
	player2Ready: boolean;
	winner: string | null;
	round: number;
}

export interface Tournament {
	tournamentId: string;
	code: string | null;
	visibility: "public" | "private";
	ownerId: string;
	maxPlayers: number;
	players: Set<string>;
	bracket: TournamentMatch[];
	status: "waiting" | "in-progress" | "completed";
	currentRound: number;
	config: Partial<game.config>;
	createdAt: number;
	completedAt: number | null;
}

/**
 * Map to store active tournaments.
 * - Key: Tournament ID **string**
 * - Value: Tournament object
 */
export const activeTournaments: Map<string, Tournament> = new Map();