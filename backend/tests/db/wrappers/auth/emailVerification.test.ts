import { describe, it, expect, beforeAll } from "vitest";
import { v7 as uuidv7 } from "uuid";

import { db } from "../../../../src/db/index.js";
import {
	createEmailVerification,
	getEmailVerificationById,
	getEmailVerificationByToken,
	checkEmailVerificationValidity,
	markEmailAsVerified,
	cleanupOldEmailVerifications,
	getEmailVerificationsByUserId
} from "../../../../src/db/wrappers/auth/emailVerification.js";

describe("emailVerification wrapper - tests", () => {
	let userId: string;
	let createdVerification: any;
	let validToken: string;

	beforeAll(() => {
		userId = uuidv7();
		const insertUser = db.prepare(`
			INSERT INTO users (user_id, email, password_hash, role_id)
			VALUES (?, ?, ?, ?)
		`);
		insertUser.run(userId, "verify_test_user@example.com", "hashed-pass", 1);
	});

	it("should create a new email verification entry", () => {
		const now = Math.floor(Date.now() / 1000);
		validToken = "token_" + Math.random().toString(36).substring(2, 10);

		const verification = createEmailVerification({
			user_id: userId,
			token: validToken,
			expires_at: now + 3600, // 1h
		});

		if (!verification) throw new Error("Throw error (undefined)");
		createdVerification = verification;

		expect(verification.user_id).toBe(userId);
		expect(verification.token).toBe(validToken);
		expect(verification.verified).toBe(0);
	});

	it("should retrieve the email verification by ID", () => {
		const found = getEmailVerificationById((createdVerification as any).id);
		if (!found) throw new Error("Throw error (undefined)");
		expect(found.token).toBe(validToken);
		expect(found.user_id).toBe(userId);
	});

	it("should retrieve the email verification by token", () => {
		const found = getEmailVerificationByToken(validToken);
		if (!found) throw new Error("Throw error (undefined)");
		expect(found.id).toBe((createdVerification as any).id);
	});

	it("should detect a valid (not expired, not verified) token", () => {
		const isValid = checkEmailVerificationValidity(validToken);
		expect(isValid).toBe(true);
	});

	it("should detect invalid token if it doesn’t exist", () => {
		const isValid = checkEmailVerificationValidity("nonexistent_token");
		expect(isValid).toBe(false);
	});

	it("should detect expired token as invalid", () => {
		const expiredToken = "expired_" + Math.random().toString(36).substring(2, 10);
		const now = Math.floor(Date.now() / 1000);

		createEmailVerification({
			user_id: userId,
			token: expiredToken,
			expires_at: now - 60 // expired 1 minute ago
		});

		const isValid = checkEmailVerificationValidity(expiredToken);
		expect(isValid).toBe(false);
	});

	it("should mark a token as verified successfully", () => {
		const result = markEmailAsVerified(validToken);
		expect(result).toBe(true);

		const found = getEmailVerificationByToken(validToken);
		if (!found) throw new Error("Throw error (undefined)");
		expect(found.verified).toBe(1);
	});

	it("should not mark already verified token again", () => {
		const result = markEmailAsVerified(validToken);
		expect(result).toBe(false);
	});

	it("should detect verified token as invalid", () => {
		const isValid = checkEmailVerificationValidity(validToken);
		expect(isValid).toBe(false);
	});

	it("should delete expired or verified tokens via cleanup", () => {
		const now = Math.floor(Date.now() / 1000);

		// Create an expired token and a valid one
		const expiredToken = "expired_" + Math.random().toString(36).substring(2, 10);
		const validToken2 = "still_valid_" + Math.random().toString(36).substring(2, 10);

		createEmailVerification({
			user_id: userId,
			token: expiredToken,
			expires_at: now - 5
		});

		createEmailVerification({
			user_id: userId,
			token: validToken2,
			expires_at: now + 3600
		});

		const deletedCount = cleanupOldEmailVerifications();
		expect(deletedCount).toBeGreaterThanOrEqual(1);

		// Le token encore valide doit toujours exister
		const found = getEmailVerificationByToken(validToken2);
		expect(found).toBeDefined();
	});

	it("should retrieve all email verifications for a user", () => {
		const verifications = getEmailVerificationsByUserId(userId);
		expect(verifications).toBeDefined();
		expect(verifications.length).toBeGreaterThan(0);
		expect(verifications[0].user_id).toBe(userId);
	});

	it("should cascade delete when user is deleted", () => {
		db.prepare(`DELETE FROM users WHERE user_id = ?`).run(userId);
		const found = getEmailVerificationById((createdVerification as any).id);
		expect(found).toBeUndefined();
	});
});
