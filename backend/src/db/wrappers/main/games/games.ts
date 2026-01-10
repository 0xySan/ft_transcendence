/*
 * Wrapper functions for interacting with the `games` table.
 * Provides creation, retrieval, updating, and listing utilities for games.
 */

import { db, insertRow, getRow } from "../../../index.js";
import { v7 as uuidv7 } from "uuid";

// --- Types ---
export interface Game {
	game_id: string;
	created_at: string;
	duration?: number;
	mode: "local" | "online" | "tournament";
	status: "completed" | "ongoing" | "abandoned" | "waiting";
	score_limit: number;
	winner_id?: string;
	max_players: number;
	points: string;
}

/**
 * Get a game by its ID.
 * @param id - The primary key of the game
 * @returns The game object if found, otherwise undefined
 */
export function getGameById(id: string): Game | undefined {
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
	maxPlayers = 2,
	duration: number,
	status: 'completed' | 'ongoing' | 'abandoned' | 'waiting',
	winner_id: string,
	points: string,
	id?: string
): Game | undefined {

	const game_id = id ? id : uuidv7();
	// Insert the new game into the database
	const game = insertRow<Game>("games", {
		game_id,
		mode,
		score_limit: scoreLimit,
		max_players: maxPlayers,
		duration: duration,
		status: status,
		created_at: Date.now() - duration,
		winner_id: winner_id,
		points: points
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
	gameId: string,
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
