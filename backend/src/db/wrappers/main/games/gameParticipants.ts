/*
 * Wrapper functions for interacting with the `game_participants` table.
 * Provides creation, retrieval, updating, and listing utilities for participants in games.
 */

import { db, insertRow, getRow } from "../../../index.js";

// --- Types ---
export interface GameParticipant {
	participant_id: number;
	game_id: number;
	user_id: number;
	team?: number;
	score: number;
	result?: "win" | "loss" | "draw";
}

/**
 * Get a participant by ID.
 * @param id - The primary key of the participant
 * @returns The participant object if found, otherwise undefined
 */
export function getParticipantById(id: number): GameParticipant | undefined {
	return getRow<GameParticipant>("game_participants", "participant_id", id);
}

/**
 * Get participants of a game.
 * @param gameId - The game's ID
 * @returns Array of participants for the given game
 */
export function getParticipantsByGameId(gameId: number): GameParticipant[] {
	const stmt = db.prepare(`
		SELECT * FROM game_participants
		WHERE game_id = ?
	`);
	return stmt.all(gameId) as GameParticipant[];
}

/**
 * Add a participant to a game.
 * Uses the generic insertRow wrapper.
 *
 * @param gameId - The game ID
 * @param userId - The user ID
 * @param team - Team number (1 or 2)
 * @returns The created GameParticipant, or undefined if failed
 */
export function addParticipant(
	gameId: number,
	userId: number,
	team?: number
): GameParticipant | undefined {
	try {
		// Insert or ignore to respect UNIQUE(game_id, user_id)
		const stmt = db.prepare(`
			INSERT OR IGNORE INTO game_participants (game_id, user_id, team)
			VALUES (?, ?, ?)
		`);
		const info = stmt.run(gameId, userId, team);

		// If nothing was inserted (duplicate), return undefined
		if (info.changes === 0) return undefined;

		// Fetch the newly inserted participant by rowid
		const row = db.prepare(`SELECT * FROM game_participants WHERE rowid = ?`)
			.get(info.lastInsertRowid);

		return row as GameParticipant;
	} catch (err) {
		console.error(`Failed to add participant:`, (err as Error).message);
		return undefined;
	}
}


/**
 * Update a participant (score, team, result).
 * Only modifies provided fields.
 *
 * @param participantId - The participant's ID
 * @param updates - Partial participant object with fields to update
 * @returns True if a row was updated, false otherwise
 */
export function updateParticipant(
	participantId: number,
	updates: Partial<Omit<GameParticipant, "participant_id" | "game_id" | "user_id">>
): boolean {
	const keys = Object.keys(updates);
	if (keys.length === 0) return false;

	const setClause = keys.map(k => `${k} = @${k}`).join(", ");
	const stmt = db.prepare(`
		UPDATE game_participants
		SET ${setClause}
		WHERE participant_id = @participant_id
	`);
	const info = stmt.run({ participant_id: participantId, ...updates });
	return info.changes > 0;
}

/**
 * List all participants.
 * @returns An array of all participants
 */
export function getAllParticipants(): GameParticipant[] {
	const stmt = db.prepare(`
		SELECT * FROM game_participants
	`);
	return stmt.all() as GameParticipant[];
}
