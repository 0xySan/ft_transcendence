import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../../../../src/db/index.js";
import {
	create2FaMethods,
	getUser2FaMethodsById,
	update2FaMethods
} from "../../../../src/db/wrappers/auth/user2FaMethods.js";

describe("user2FaMethods wrapper - extended tests", () => {
	let userId: number;
	let createdMethodId: number | undefined;

	beforeAll(() => {
		// Insertion d'un utilisateur de test
		const insertUser = db.prepare(`
			INSERT INTO users (email, password_hash, role_id)
			VALUES (?, ?, ?)
		`);
		const res = insertUser.run("2fa_user@example.local", "hashed-password", 1);
		userId = Number(res.lastInsertRowid);
	});

	it("should create a 2FA method with valid data", () => {
		const now = Math.floor(Date.now() / 1000);
		const method = create2FaMethods({
			user_id: userId,
			method_type: 1,
			label: "Phone",
			is_primary: 1,
			is_verified: true,
			created_at: now,
			updated_at: now
		});
		expect(method).toBeDefined();
		expect(method?.user_id).toBe(userId);
		expect(method?.label).toBe("Phone");

		// On suppose que l'objet retourné contient une sorte d'ID
		createdMethodId = (method as any).method_id ?? (method as any).id;
		expect(typeof createdMethodId).toBe("number");
	});

	it("should retrieve a 2FA method by ID", () => {
		if (createdMethodId === undefined) return;
		const method = getUser2FaMethodsById(createdMethodId);
		expect(method).toBeDefined();
		expect(method?.user_id).toBe(userId);
		expect(method?.label).toBe("Phone");
	});

	it("should reject creation with missing required fields", () => {
		const method = create2FaMethods({
			user_id: userId,
			method_type: undefined,
			label: "Email"
		});
		expect(method).toBeUndefined();
	});

	it("should reject invalid types for numeric fields", () => {
		const method = create2FaMethods({
			// @ts-expect-error
			user_id: "not-a-number",
			method_type: 2,
			label: "Invalid",
			is_primary: 0,
			is_verified: true,
			created_at: Math.floor(Date.now() / 1000),
			update_at: Math.floor(Date.now() / 1000)
		});
		expect(method).toBeUndefined();
	});

	it("should reject creation without user_id", () => {
		const now = Math.floor(Date.now() / 1000);
		const method = create2FaMethods({
			method_type: 1,
			label: "MissingUserId",
			is_verified: false,
			created_at: now,
			updated_at: now
		});
		expect(method).toBeUndefined();
	});

	it("should allow multiple 2FA methods for the same user", () => {
		const now = Math.floor(Date.now() / 1000);
		const methodA = create2FaMethods({
			user_id: userId,
			method_type: 3,
			label: "Backup Phone",
			is_primary: 0,
			is_verified: false,
			created_at: now,
			updated_at: now
		});
		const methodB = create2FaMethods({
			user_id: userId,
			method_type: 4,
			label: "Authenticator App",
			is_primary: 0,
			is_verified: true,
			created_at: now,
			updated_at: now
		});
		expect(methodA).toBeDefined();
		expect(methodB).toBeDefined();
		expect(methodA?.label).not.toBe(methodB?.label);
	});

	it("should update label and verification status", () => {
		if (createdMethodId === undefined) return;

		const updated = update2FaMethods(createdMethodId, {
			label: "Updated Phone",
			is_verified: false
		});
		expect(updated).toBe(true);

		const method = getUser2FaMethodsById(createdMethodId);
		expect(method?.label).toBe("Updated Phone");
		expect(method?.is_verified).toBe(0);
	});

	it("should not update when no valid fields are provided", () => {
		if (createdMethodId === undefined) return;

		const updated = update2FaMethods(createdMethodId, {
			// @ts-expect-error
			label: null,
			is_verified: undefined
		});
		expect(updated).toBe(false);
	});

	it("should reject creation with invalid timestamps", () => {
		const method = create2FaMethods({
			user_id: userId,
			method_type: 2,
			label: "InvalidTime",
			is_primary: 0,
			is_verified: true,
			// @ts-expect-error
			created_at: "not-a-timestamp",
			update_at: null
		});
		expect(method).toBeUndefined();
	});

	it("should accept is_verified as number 0/1", () => {
		const now = Math.floor(Date.now() / 1000);
		const method = create2FaMethods({
			user_id: userId,
			method_type: 5,
			label: "NumericVerified",
			is_primary: 0,
			// @ts-ignore
			is_verified: 1,
			created_at: now,
			updated_at: now
		});
		expect(method).toBeDefined();
		expect(method?.is_verified).toBe(1);
	});

	it("should create method with is_primary = 0 if omitted", () => {
		const now = Math.floor(Date.now() / 1000);
		const method = create2FaMethods({
			user_id: userId,
			method_type: 6,
			label: "NoPrimary",
			is_verified: true,
			created_at: now,
			updated_at: now
		});
		expect(method).toBeDefined();
		expect(method?.is_primary ?? 0).toBe(0);
	});
});
