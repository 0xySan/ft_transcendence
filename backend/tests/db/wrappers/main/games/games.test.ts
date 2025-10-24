/**
 * @file games.test.ts
 * @description Unit tests for the Games database wrapper.
 * These tests verify that all CRUD-like operations on the `games` table
 * behave as expected, and that the seeder populated the data correctly.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../../../../../src/db/index.js";
import { createGame, getGameById, updateGame, getAllGames} from "../../../../../src/db/wrappers/main/games/games.js";

let gameId: number;
let winnerId: number;

beforeAll(() => {
	// --- Clean tables for isolated tests ---
	db.prepare("DELETE FROM game_participants").run();
	db.prepare("DELETE FROM games").run();
	db.prepare("DELETE FROM users").run();

	const user = db.prepare(
		"INSERT INTO users (email, password_hash, role_id) VALUES (?, ?, ?)"
	).run("winner@example.local", "hash", 1);
	winnerId = Number(user.lastInsertRowid);
});

describe("Games wrapper (DB operations)", () => {
	it("should create a new game with default values", () => {
		const game = createGame("local");
		expect(game).toBeDefined();
		expect(game?.mode).toBe("local");
		expect(game?.score_limit).toBe(11);
		expect(game?.max_players).toBe(2);
		expect(game?.status).toBe("waiting");
		if (game) gameId = game.game_id;
	});

	it("should create a new game with custom values", () => {
		const game = createGame("online", 21, 4);
		expect(game).toBeDefined();
		expect(game?.mode).toBe("online");
		expect(game?.score_limit).toBe(21);
		expect(game?.max_players).toBe(4);
		expect(game?.status).toBe("waiting");
	});

	it("should retrieve a game by its ID", () => {
		const game = getGameById(gameId);
		expect(game).toBeDefined();
		expect(game?.game_id).toBe(gameId);
		expect(game?.mode).toBe("local");
	});

	it("should return undefined for non-existing game ID", () => {
		const game = getGameById(999999);
		expect(game).toBeUndefined();
	});

	it("should update a game's status and metadata", () => {
		const updated = updateGame(gameId, { status: "ongoing", max_players: 3, winner_id: winnerId });
		expect(updated).toBe(true);

		const game = getGameById(gameId);
		expect(game?.status).toBe("ongoing");
		expect(game?.max_players).toBe(3);
		expect(game?.winner_id).toBe(winnerId);
	});

	it("should not update if no fields are provided", () => {
		const updated = updateGame(gameId, {});
		expect(updated).toBe(false);
	});

	it("should list all games ordered by creation date descending", () => {
		const allGames = getAllGames();
		expect(allGames.length).toBeGreaterThanOrEqual(2);

		for (const game of allGames) {
			expect(game).toHaveProperty("game_id");
			expect(game).toHaveProperty("mode");
			expect(["local", "online", "tournament"]).toContain(game.mode);
		}

		// Check ordering (most recent first)
		for (let i = 1; i < allGames.length; i++) {
			expect(new Date(allGames[i - 1].created_at).getTime()).toBeGreaterThanOrEqual(
				new Date(allGames[i].created_at).getTime()
			);
		}
	});

	it("should enforce CHECK constraints on mode and status", () => {
		// Directly test insert violation bypassing wrapper
		try {
			db.prepare(
				"INSERT INTO games (mode, status, max_players) VALUES (?, ?, ?)"
			).run("invalid_mode", "waiting", 2);
			expect(false).toBe(true); // should not reach
		} catch (err: any) {
			expect(err.message).toMatch(/CHECK constraint failed/);
		}
	});

	it("should enforce positive score_limit and max_players", () => {
		try {
			db.prepare(
				"INSERT INTO games (mode, score_limit, max_players) VALUES (?, ?, ?)"
			).run("local", -1, 0);
			expect(false).toBe(true); // should not reach
		} catch (err: any) {
			expect(err.message).toMatch(/CHECK constraint failed/);
		}
	});

	it("should allow null winner_id", () => {
		const game = createGame("tournament");
		expect(game).toBeDefined();
		expect(game?.winner_id).toBeUndefined();
	});


	it("should fail to create a game with invalid mode", () => {
	// @ts-expect-error - deliberately passing an invalid value to test DB constraint
		const game = createGame("invalid_mode");
		expect(game).toBeUndefined();
	});

	it("should fail to create a game with negative score_limit", () => {
		const game = createGame("local", -10);
		expect(game).toBeUndefined();
	});

	it("should fail to create a game with zero max_players", () => {
		const game = createGame("online", 11, 0);
		expect(game).toBeUndefined();
	});


	it("should allow setting winner_id to an existing user", () => {
		const game = createGame("tournament");
		if (game) {
			const updated = updateGame(game.game_id, { winner_id: winnerId });
			expect(updated).toBe(true);
			const fetched = getGameById(game.game_id);
			expect(fetched?.winner_id).toBe(winnerId);
		}
	});
});

