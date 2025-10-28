/**
 * @file gameParticipants.test.ts
 * @description Tests for the game_participants table exercised via the wrappers.
 *
 * These tests rely on the project's DB initialization (init.sql + seeders).
 * In test environment the DB is created in-memory by initializeDatabase().
 *
 * Scenarios covered:
 *  - insertion via wrapper
 *  - UNIQUE constraint (no duplicate participant in same game)
 *  - FOREIGN KEY constraints (invalid game/user)
 *  - update via wrapper
 *  - retrieval by id / by game id / list all
 *  - ON DELETE CASCADE when deleting game or user
 */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";

import {
	addParticipant,
	getParticipantById,
	getParticipantsByGameId,
	updateParticipant,
	getAllParticipants,
} from "../../../../../src/db/wrappers/main/games/gameParticipants.js";

import { db } from "../../../../../src/db/index.js";

let gameId: number;
let userId1: number;
let userId2: number;

describe("GameParticipants wrapper (DB constraints + cascade)", () => {
	// --- Prepare users and a game before the test suite -----------------------
	beforeAll(() => {
		// Insert two users (email & password_hash required by schema)
		const insertUserStmt = db.prepare(
			`INSERT INTO users (email, password_hash, role_id) VALUES (?, ?, ?)`
		);
		const u1 = insertUserStmt.run("test1+gp@example.local", "hash1", 1);
		const u2 = insertUserStmt.run("test2+gp@example.local", "hash2", 1);

		userId1 = Number(u1.lastInsertRowid);
		userId2 = Number(u2.lastInsertRowid);

		// Insert a game
		const insertGameStmt = db.prepare(
			`INSERT INTO games (mode, status, max_players) VALUES (?, ?, ?)`
		);
		const g = insertGameStmt.run("local", "waiting", 2);
		gameId = Number(g.lastInsertRowid);
	});

	// --- Isolation: clear game_participants before each test -------
	beforeEach(() => {
		db.prepare("DELETE FROM game_participants").run();
	});

	// --- Tests ----------------------------------------------------------
	it("should add a participant to a game", () => {
		const participant = addParticipant(gameId, userId1, 1);
		expect(participant).toBeDefined();
		expect(participant?.game_id).toBe(gameId);
		expect(participant?.user_id).toBe(userId1);
		expect(participant?.team === undefined || participant?.team === 1).toBeTruthy();
		expect(participant?.score).toBeDefined();
	});

	it("should not allow duplicate participants (UNIQUE(game_id, user_id))", () => {
		const first = addParticipant(gameId, userId1, 1);
		expect(first).toBeDefined();

		// second insertion for same (gameId, userId1) must fail or return undefined
		let second: unknown;
		try {
			second = addParticipant(gameId, userId1, 2);
		} catch (err) {
			// If wrapper throws, that's acceptable: ensure it's a UNIQUE / constraint error
			expect(String((err as Error).message).match(/UNIQUE|constraint/i)).toBeTruthy();
			return;
		}
		// If wrapper swallows the error and returns undefined, assert that too
		expect(second).toBeUndefined();
	});

	it("should reject insertion with non-existing game or user (FK constraint)", () => {
		// invalid game
		let gotErr = false;
		try {
			addParticipant(9999999, userId1);
		} catch (err) {
			gotErr = true;
			expect(String((err as Error).message)).toMatch(/FOREIGN KEY|constraint/i);
		}
		// wrapper might return undefined instead of throwing - accept both behaviours
		if (!gotErr) {
			const res = addParticipant(9999999, userId1);
			expect(res).toBeUndefined();
		}

		// invalid user
		gotErr = false;
		try {
			addParticipant(gameId, 9999999);
		} catch (err) {
			gotErr = true;
			expect(String((err as Error).message)).toMatch(/FOREIGN KEY|constraint/i);
		}
		if (!gotErr) {
			const res = addParticipant(gameId, 9999999);
			expect(res).toBeUndefined();
		}
	});

	it("should retrieve a participant by id", () => {
		const created = addParticipant(gameId, userId1, 1);
		expect(created).toBeDefined();
		const fetched = getParticipantById(created!.participant_id);
		expect(fetched).toBeDefined();
		expect(fetched?.participant_id).toBe(created!.participant_id);
		expect(fetched?.game_id).toBe(gameId);
		expect(fetched?.user_id).toBe(userId1);
	});

	it("should return undefined for non-existing participant id", () => {
		const res = getParticipantById(9999999);
		expect(res).toBeUndefined();
	});

	it("should return participants by game id", () => {
		addParticipant(gameId, userId1, 1);
		addParticipant(gameId, userId2, 2);
		const participants = getParticipantsByGameId(gameId);
		expect(participants.length).toBeGreaterThanOrEqual(2);
		participants.forEach((p) => expect(p.game_id).toBe(gameId));
	});

	it("should update participant fields (score/team/result)", () => {
		const p = addParticipant(gameId, userId1);
		expect(p).toBeDefined();

		const ok = updateParticipant(p!.participant_id, {
			score: 12,
			team: 2,
			result: "win",
		});
		expect(ok).toBe(true);

		const fetched = getParticipantById(p!.participant_id);
		expect(fetched?.score).toBe(12);
		expect(fetched?.team).toBe(2);
		expect(fetched?.result).toBe("win");
	});

	it("should return false when update is called with no fields", () => {
		const p = addParticipant(gameId, userId1);
		const ok = updateParticipant(p!.participant_id, {});
		expect(ok).toBe(false);
	});

	it("should list all participants", () => {
		addParticipant(gameId, userId1);
		addParticipant(gameId, userId2);
		const all = getAllParticipants();
		expect(all.length).toBeGreaterThanOrEqual(2);
		const ids = all.map((a) => a.participant_id);
		const unique = new Set(ids);
		expect(unique.size).toBe(ids.length);
	});

	it("should cascade delete participants when game is deleted (ON DELETE CASCADE)", () => {
		// create a new game to isolate this test
		const g = db.prepare("INSERT INTO games(mode, status) VALUES (?, ?)").run("online", "waiting");
		const newGameId = Number(g.lastInsertRowid);

		addParticipant(newGameId, userId1);
		addParticipant(newGameId, userId2);

		// delete the game; participants must be gone
		db.prepare("DELETE FROM games WHERE game_id = ?").run(newGameId);
		const participants = getParticipantsByGameId(newGameId);
		expect(participants.length).toBe(0);
	});

	it("should cascade delete participants when a user is deleted (ON DELETE CASCADE)", () => {
		// create a new game for this test
		const g = db.prepare("INSERT INTO games(mode, status) VALUES (?, ?)").run("online", "waiting");
		const newGameId = Number(g.lastInsertRowid);

		addParticipant(newGameId, userId1);
		addParticipant(newGameId, userId2);

		// delete userId1, participants referencing userId1 should be removed
		db.prepare("DELETE FROM users WHERE user_id = ?").run(userId1);

		const participants = getParticipantsByGameId(newGameId);
		// only userId2 remains
		expect(participants.every((p) => p.user_id !== userId1)).toBe(true);
		expect(participants.length).equal(1);
	});
});
