/**
 * @file userStats.test.ts
 * @description Unit tests for the user_stats database wrapper.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { v7 as uuidv7 } from "uuid";

import { db } from "../../../../../src/db/index.js";
import {
	createStats,
	getStatsByUserId,
	updateElo,
	incrementGamesPlayed,
	incrementGamesWon,
	incrementGamesLost,
	incrementPlayTime,
	incrementLevel,
	updateStats,
	getAllStats,
	UserStats,
} from "../../../../../src/db/wrappers/main/users/userStats.js";

describe("UserStats wrapper", () => {
	let testUserId: string;
	let statsId: number;

	// --- Setup test user_stats row ---------------------------------------
	beforeAll(() => {
		// --- Clean tables ---
		db.prepare(`DELETE FROM user_stats`).run();
		db.prepare(`DELETE FROM users WHERE user_id > 0`).run();

		// --- Insert test user ---
		testUserId = uuidv7();
		const insertUser = db.prepare(`
			INSERT INTO users (user_id, email, password_hash, role_id)
			VALUES (?, ?, ?, ?)
		`);
		insertUser.run(testUserId, "test@example.com", "hashedpassword", 1);

		// --- Insert test stats for that user ---
		const row = createStats(testUserId);
		expect(row).toBeDefined();
		statsId = row!.stat_id;
	});


	// --- Retrieval tests --------------------------------------------------
	it("should get stats by user ID", () => {
		const stats = getStatsByUserId(testUserId);
		expect(stats).toBeDefined();
		expect(stats?.user_id).toBe(testUserId);
		expect(stats?.elo_rating).toBe(1000);
		expect(stats?.games_played).toBe(0);
	});

	it("should return undefined for non-existing user ID", () => {
		const stats = getStatsByUserId("9999");
		expect(stats).toBeUndefined();
	});

	// --- Update tests -----------------------------------------------------
	it("should update Elo rating", () => {
		const result = updateElo(testUserId, 1200);
		expect(result).toBe(true);
		const stats = getStatsByUserId(testUserId);
		expect(stats?.elo_rating).toBe(1200);
	});

	it("should increment games played", () => {
		const result = incrementGamesPlayed(testUserId, 2);
		expect(result).toBe(true);
		const stats = getStatsByUserId(testUserId);
		expect(stats?.games_played).toBe(2);
	});

	it("should increment games won", () => {
		const result = incrementGamesWon(testUserId, 1);
		expect(result).toBe(true);
		const stats = getStatsByUserId(testUserId);
		expect(stats?.games_won).toBe(1);
	});

	it("should increment games lost", () => {
		const result = incrementGamesLost(testUserId, 1);
		expect(result).toBe(true);
		const stats = getStatsByUserId(testUserId);
		expect(stats?.games_lost).toBe(1);
	});

	it("should increment total play time", () => {
		const result = incrementPlayTime(testUserId, 3600);
		expect(result).toBe(true);
		const stats = getStatsByUserId(testUserId);
		expect(stats?.total_play_time).toBe(3600);
	});

	it("should increment level", () => {
		const result = incrementLevel(testUserId, 2);
		expect(result).toBe(true);
		const stats = getStatsByUserId(testUserId);
		expect(stats?.level).toBe(3);
	});

	it("should update multiple fields with updateStats", () => {
		const result = updateStats(testUserId, { rank: 5, elo_rating: 1300 });
		expect(result).toBe(true);
		const stats = getStatsByUserId(testUserId);
		expect(stats?.rank).toBe(5);
		expect(stats?.elo_rating).toBe(1300);
	});

	it("should return false if updateStats is called with empty object", () => {
		const result = updateStats(testUserId, {});
		expect(result).toBe(false);
	});

	// --- Listing ----------------------------------------------------------
	it("should list all stats", () => {
		const allStats = getAllStats();
		expect(allStats.length).toBeGreaterThanOrEqual(1);
		expect(allStats[0].user_id).toBe(testUserId);
	});

	it("should return stats sorted ascending by default", () => {
		const stats = getAllStats("elo_rating"); // desc=false par défaut
		expect(stats).toBeDefined();
		for (let i = 1; i < stats.length; i++) {
			expect(stats[i].elo_rating).toBeGreaterThanOrEqual(stats[i - 1].elo_rating);
		}
	});

	it("should return stats sorted descending when desc=true", () => {
		const stats = getAllStats("elo_rating", true); // desc=true
		expect(stats).toBeDefined();
		for (let i = 1; i < stats.length; i++) {
			expect(stats[i].elo_rating).toBeLessThanOrEqual(stats[i - 1].elo_rating);
		}
	});

});
