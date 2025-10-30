/**
 * @file userStats.ts
 * @description Wrapper functions for interacting with the `user_stats` table.
 * Provides retrieval, creation, and update utilities for user statistics.
 */

import { db, insertRow, getRow } from "../../../index.js";

// --- Types ---
export interface UserStats {
	stat_id: number;
	user_id: number;
	elo_rating: number;
	games_played: number;
	games_won: number;
	games_lost: number;
	level: number;
	rank: number;
	total_play_time: number;
}

/**
 * Get stats by user ID.
 * @param userId - The user's ID
 * @returns The UserStats object if found, otherwise undefined
 */
export function getStatsByUserId(userId: string): UserStats | undefined {
	return getRow<UserStats>("user_stats", "user_id", userId);
}

/**
 * Create a new stats row for a user.
 * @param userId - The user's ID
 * @returns The created UserStats row, or undefined if failed
 */
export function createStats(userId: string): UserStats | undefined {
	return insertRow<UserStats>("user_stats", {
		user_id: userId,
		elo_rating: 1000,
		games_played: 0,
		games_won: 0,
		games_lost: 0,
		level: 1,
		rank: 0,
		total_play_time: 0,
	});
}

/**
 * Update stats for a user.
 * Only updates the provided fields.
 *
 * @param userId - The user's ID
 * @param updates - Partial stats to update
 * @returns true if updated, false otherwise
 */
export function updateStats(
	userId: string,
	updates: Partial<Omit<UserStats, "stat_id" | "user_id">>
): boolean {
	const keys = Object.keys(updates);
	if (keys.length === 0) return false;

	const setClause = keys.map(k => `${k} = @${k}`).join(", ");
	const stmt = db.prepare(`
		UPDATE user_stats
		SET ${setClause}
		WHERE user_id = @user_id
	`);
	const info = stmt.run({ user_id: userId, ...updates });
	return info.changes > 0;
}

/**
 * List all user stats, optionally sorted by a column.
 * @param sortBy - Column to sort by (default: user_id)
 * @param desc - Sort descending if true
 * @returns Array of UserStats
 */
export function getAllStats(sortBy: keyof UserStats = "user_id", desc = false): UserStats[] {
	const order = desc ? "DESC" : "ASC";
	const stmt = db.prepare(`SELECT * FROM user_stats ORDER BY ${sortBy} ${order}`);
	return stmt.all() as UserStats[];
}

/**
 * Update Elo rating.
 */
export function updateElo(userId: string, newElo: number): boolean {
	const stmt = db.prepare(`
		UPDATE user_stats
		SET elo_rating = @newElo
		WHERE user_id = @user_id
	`);
	const info = stmt.run({ user_id: userId, newElo });
	return info.changes > 0;
}

/**
 * Increment games played counter.
 */
export function incrementGamesPlayed(userId: string, count = 1): boolean {
	const stmt = db.prepare(`
		UPDATE user_stats
		SET games_played = games_played + @count
		WHERE user_id = @user_id
	`);
	const info = stmt.run({ user_id: userId, count });
	return info.changes > 0;
}

/**
 * Increment games won counter.
 */
export function incrementGamesWon(userId: string, count = 1): boolean {
	const stmt = db.prepare(`
		UPDATE user_stats
		SET games_won = games_won + @count
		WHERE user_id = @user_id
	`);
	const info = stmt.run({ user_id: userId, count });
	return info.changes > 0;
}

/**
 * Increment games lost counter.
 */
export function incrementGamesLost(userId: string, count = 1): boolean {
	const stmt = db.prepare(`
		UPDATE user_stats
		SET games_lost = games_lost + @count
		WHERE user_id = @user_id
	`);
	const info = stmt.run({ user_id: userId, count });
	return info.changes > 0;
}

/**
 * Increment total play time in seconds.
 */
export function incrementPlayTime(userId: string, seconds: number): boolean {
	const stmt = db.prepare(`
		UPDATE user_stats
		SET total_play_time = total_play_time + @seconds
		WHERE user_id = @user_id
	`);
	const info = stmt.run({ user_id: userId, seconds });
	return info.changes > 0;
}

/**
 * Increment user level.
 */
export function incrementLevel(userId: string, increment = 1): boolean {
	const stmt = db.prepare(`
		UPDATE user_stats
		SET level = level + @increment
		WHERE user_id = @user_id
	`);
	const info = stmt.run({ user_id: userId, increment });
	return info.changes > 0;
}
