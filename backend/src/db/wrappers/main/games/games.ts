/*
 * Wrapper functions for interacting with the `games` table.
 * Provides creation, retrieval, updating, and listing utilities for games.
 */

import { db, insertRow, getRow } from "../../../index.js";

// --- Types ---
export interface Game {
	game_id: number;
	created_at: string;
	duration?: number;
	mode: "local" | "online" | "tournament";
	status: "completed" | "ongoing" | "abandoned" | "waiting";
	score_limit: number;
	winner_id?: string;
	max_players: number;
}

/**
 * Get a game by its ID.
 * @param id - The primary key of the game
 * @returns The game object if found, otherwise undefined
 */
export function getGameById(id: number): Game | undefined {
	return getRow<Game>("games", "game_id", id);
}

/**
 * Create a new game.
 * Uses the generic insertRow wrapper.
 *
 * @param mode - Game mode ('local', 'online', 'tournament')
 * @param scoreLimit - Score required to win (default 11)
 * @param maxPlayers - Maximum players allowed (default 2)
 * @returns The created Game, or undefined if failed
 */
export function createGame(
	mode: "local" | "online" | "tournament",
	scoreLimit = 11,
	maxPlayers = 2
): Game | undefined {
	// Insert the new game into the database
	const game = insertRow<Game>("games", {
		mode,
		score_limit: scoreLimit,
		max_players: maxPlayers,
	});

	if (!game) return undefined;

	if (game.winner_id === null) game.winner_id = undefined;
	if (game.duration === null) game.duration = undefined;

	return game;
}

/**
 * Update the status or metadata of a game.
 * Only modifies provided fields.
 *
 * @param gameId - The game's ID
 * @param updates - Partial Game object with fields to update
 * @returns True if a row was updated, false otherwise
 */
export function updateGame(
	gameId: number,
	updates: Partial<Omit<Game, "game_id" | "created_at">>
): boolean {
	const keys = Object.keys(updates);
	if (keys.length === 0) return false;

	const setClause = keys.map(k => `${k} = @${k}`).join(", ");
	const stmt = db.prepare(`
		UPDATE games
		SET ${setClause}
		WHERE game_id = @game_id
	`);
	const info = stmt.run({ game_id: gameId, ...updates });
	return info.changes > 0;
}

/**
 * List all games.
 * @returns An array of all games
 */
export function getAllGames(): Game[] {
	const stmt = db.prepare(`
		SELECT * FROM games
		ORDER BY created_at DESC
	`);
	return stmt.all() as Game[];
}
