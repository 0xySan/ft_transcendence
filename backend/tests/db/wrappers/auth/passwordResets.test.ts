import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../../../../src/db/index.js";
import {
	createPasswordReset,
	getPasswordResetById,
	updatePasswordReset,
	getValidPasswordResetsByUserId,
	getPasswordResetByTokenHash,
	getPasswordResetsByUserId
} from "../../../../src/db/wrappers/auth/passwordResets.js";

describe("passwordResets wrapper", () => {
	let userId1: number;
	let userId2: number;
	let createdResetId: number | undefined;

	beforeAll(() => {
		try {
			db.prepare(`INSERT OR IGNORE INTO user_roles (role_id, name) VALUES (?, ?)`).run(1, "testRole");
		} catch {}

		const insertUser = db.prepare(`
			INSERT INTO users (email, password_hash, role_id)
			VALUES (?, ?, ?)
		`);
		const r1 = insertUser.run("test_user1@example.local", "hash-user1", 1);
		const r2 = insertUser.run("test_user2@example.local", "hash-user2", 1);

		userId1 = Number(r1.lastInsertRowid);
		userId2 = Number(r2.lastInsertRowid);
	});

	it("should create a new passwordReset with provided values", () => {
		const newReset = createPasswordReset({
			user_id: userId1,
			token_hash: "hashed_token_123",
			expired_at: Math.floor(Date.now() / 1000) + 3600,
			consumed: false,
		});

		expect(newReset).toBeDefined();
		expect(newReset?.user_id).toBe(userId1);
		expect(newReset?.token_hash).toBe("hashed_token_123");
		expect(newReset?.consumed).toBe(0);
		createdResetId = newReset?.reset_id;
	});

	it("should create a passwordReset without consumed field (default false)", () => {
		const reset = createPasswordReset({
			user_id: userId1,
			token_hash: "token_no_consumed",
			expired_at: Math.floor(Date.now() / 1000) + 1800,
		});
		expect(reset).toBeDefined();
		expect(reset?.consumed).toBe(0);
	});

	it("should create a passwordReset with consumed set to true", () => {
		const reset = createPasswordReset({
			user_id: userId2,
			token_hash: "token_consumed_true",
			expired_at: Math.floor(Date.now() / 1000) + 1800,
			consumed: true,
		});
		expect(reset).toBeDefined();
		expect(reset?.consumed).toBe(1);
	});

	it("should have created_at timestamp close to now", () => {
		const now = Math.floor(Date.now() / 1000);
		const reset = createPasswordReset({
			user_id: userId2,
			token_hash: "token_created_at",
			expired_at: now + 3600,
		});
		expect(reset).toBeDefined();
		expect(Math.abs((reset?.created_at ?? 0) - now)).toBeLessThan(5);
	});

	it("should return a passwordReset by ID", () => {
		if (!createdResetId) return;
		const reset = getPasswordResetById(createdResetId);
		expect(reset).toBeDefined();
		expect(reset?.reset_id).toBe(createdResetId);
		expect(reset?.user_id).toBe(userId1);
	});

	it("should return undefined if ID does not exist", () => {
		const reset = getPasswordResetById(999999);
		expect(reset).toBeUndefined();
	});

	it("should update consumed and consumed_at fields", () => {
		if (!createdResetId) return;

		const consumedAtTimestamp = Math.floor(Date.now() / 1000);

		const updated = updatePasswordReset(createdResetId, {
			consumed: true,
			consumed_at: consumedAtTimestamp,
		});
		expect(updated).toBe(true);

		const reset = getPasswordResetById(createdResetId);
		expect(reset?.consumed).toBe(1);
		expect(reset?.consumed_at).toBe(consumedAtTimestamp);
	});

	it("should update only token_hash", () => {
		if (!createdResetId) return;

		const newToken = "updated_token_hash";
		const updated = updatePasswordReset(createdResetId, {
			token_hash: newToken,
		});
		expect(updated).toBe(true);

		const reset = getPasswordResetById(createdResetId);
		expect(reset?.token_hash).toBe(newToken);
	});

	it("should return false when updating with no valid fields", () => {
		if (!createdResetId) return;
		const updated = updatePasswordReset(createdResetId, {});
		expect(updated).toBe(false);
	});

	it("should return false when updating non-existing reset", () => {
		const updated = updatePasswordReset(999999, {
			consumed: true,
		});
		expect(updated).toBe(false);
	});

	it("should update consumed to false and reset consumed_at to 0", () => {
		if (!createdResetId) return;

		const updated = updatePasswordReset(createdResetId, {
			consumed: false,
			consumed_at: 0,
		});
		expect(updated).toBe(true);

		const reset = getPasswordResetById(createdResetId);
		expect(reset?.consumed).toBe(0);
		expect(reset?.consumed_at).toBe(0);
	});

	it("should return undefined if creating with non-existing user_id (FK fail)", () => {
		const invalidReset = createPasswordReset({
			user_id: 999999,
			token_hash: "invalid_fk",
			expired_at: Math.floor(Date.now() / 1000) + 3600,
		});
		expect(invalidReset).toBeUndefined();
	});

	it("should return a passwordReset by token_hash", () => {
		const reset = createPasswordReset({
			user_id: userId1,
			token_hash: "unique_hash_for_token_test",
			expired_at: Math.floor(Date.now() / 1000) + 3600,
		});
		expect(reset).toBeDefined();

		const found = getPasswordResetByTokenHash("unique_hash_for_token_test");
		expect(found).toBeDefined();
		expect(found?.token_hash).toBe("unique_hash_for_token_test");
	});

	it("should return undefined for unknown token_hash", () => {
		const found = getPasswordResetByTokenHash("non_existing_hash");
		expect(found).toBeUndefined();
	});

	it("should return all password resets for a given user ID", () => {
		createPasswordReset({
			user_id: userId2,
			token_hash: "multi_1",
			expired_at: Math.floor(Date.now() / 1000) + 3000,
		});
		createPasswordReset({
			user_id: userId2,
			token_hash: "multi_2",
			expired_at: Math.floor(Date.now() / 1000) + 3000,
		});

		const resets = getPasswordResetsByUserId(userId2);
		expect(Array.isArray(resets)).toBe(true);
		expect(resets.length).toBeGreaterThanOrEqual(2);
	});

	it("should return only valid (not consumed & not expired) resets for user", () => {
		const now = Math.floor(Date.now() / 1000);

		createPasswordReset({
			user_id: userId1,
			token_hash: "valid_reset",
			expired_at: now + 3600,
			consumed: false,
		});

		createPasswordReset({
			user_id: userId1,
			token_hash: "expired_reset",
			expired_at: now - 100,
			consumed: false,
		});

		createPasswordReset({
			user_id: userId1,
			token_hash: "consumed_reset",
			expired_at: now + 3600,
			consumed: true,
		});

		const validResets = getValidPasswordResetsByUserId(userId1);
		expect(Array.isArray(validResets)).toBe(true);
		
		// @ts-expect-error
		const onlyValid = validResets.every(r => r.expired_at > now && r.consumed === 0);
		expect(onlyValid).toBe(true);
	});

	it("should return empty array if db.prepare throws (test catch block)", () => {
		const originalPrepare = db.prepare;

		db.prepare = () => {
			throw new Error("Forced error");
		};

		const result = getValidPasswordResetsByUserId(userId1);
		expect(result).toEqual([]);

		db.prepare = originalPrepare;
	});
});
