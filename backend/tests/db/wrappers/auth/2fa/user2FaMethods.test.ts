import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../../../../../src/db/index.js";
import {
	create2FaMethods,
	getUser2FaMethodsById,
	update2FaMethods,
	getPrimary2FaMethodByUserId,
	getUser2FaMethodsByUserId,
	verify2FaMethod,
	setPrimary2FaMethod,
	delete2FaMethods
} from "../../../../../src/db/wrappers/auth/2fa/user2FaMethods.js";

describe("user2FaMethods wrapper - extended tests", () => {
	let userId: number;
	let createdMethodId: number | undefined;

	beforeAll(() => {
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
        if (!method)throw new Error("Expected an user2FaMethods from create2FaMethods(), but got undefined.");
		expect(method.user_id).toBe(userId);
		expect(method.label).toBe("Phone");

		createdMethodId = (method as any).method_id ?? (method as any).id;
		expect(typeof createdMethodId).toBe("number");
	});

	it("should retrieve a 2FA method by ID", () => {
		if (createdMethodId === undefined) return;
		const method = getUser2FaMethodsById(createdMethodId);
		expect(method).toBeDefined();
        if (!method)throw new Error("Expected an user2FaMethods from getUser2FaMethodsById(), but got undefined.");
		expect(method.user_id).toBe(userId);
		expect(method.label).toBe("Phone");
	});

	it("should retrieve the primary 2FA method for a user", () => {
		const method = getPrimary2FaMethodByUserId(userId);
		expect(method).toBeDefined();
        if (!method)throw new Error("Expected an user2FaMethods from getPrimary2FaMethodByUserId(), but got undefined.");
		expect(method.user_id).toBe(userId);
		expect(method.is_primary).toBe(1);
	});

	it("should delete a 2FA method by ID", () => {
		const now = Math.floor(Date.now() / 1000);
		const method = create2FaMethods({
			user_id: userId,
			method_type: 99,
			label: "ToDelete",
			is_primary: 0,
			is_verified: false,
			created_at: now,
			updated_at: now
		});
		const methodId = (method as any).method_id;

		const deleted = delete2FaMethods(methodId);
		expect(deleted).toBe(true);

		const fetched = getUser2FaMethodsById(methodId);
		expect(fetched).toBeUndefined();
	});

	it("should set a method as primary and unset previous primary", () => {
		const now = Math.floor(Date.now() / 1000);

		const method = create2FaMethods({
			user_id: userId,
			method_type: 7,
			label: "NewPrimary",
			is_primary: 0,
			is_verified: true,
			created_at: now,
			updated_at: now
		});
		const methodId = (method as any).method_id;

		const success = setPrimary2FaMethod(userId, methodId);
		expect(success).toBe(true);

		const primary = getPrimary2FaMethodByUserId(userId);
        if (!primary)throw new Error("Expected an user2FaMethods from getPrimary2FaMethodByUserId(), but got undefined.");
		expect(primary.method_type).toBe(7);
		expect(primary.method_id).toBe(methodId);
	});

	it("should verify a 2FA method", () => {
		const now = Math.floor(Date.now() / 1000);
		const method = create2FaMethods({
			user_id: userId,
			method_type: 8,
			label: "ToVerify",
			is_primary: 0,
			is_verified: false,
			created_at: now,
			updated_at: now
		});
		const methodId = (method as any).method_id;

		const verified = verify2FaMethod(methodId);
		expect(verified).toBe(true);

		const fetched = getUser2FaMethodsById(methodId);
        if (!fetched)throw new Error("Expected an user2FaMethods from getUser2FaMethodsById(), but got undefined.");
		expect(fetched.is_verified).toBe(1);
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
        if (!methodA)throw new Error("Expected an user2FaMethods from create2FaMethods(), but got undefined.");
		const methodB = create2FaMethods({
			user_id: userId,
			method_type: 4,
			label: "Authenticator App",
			is_primary: 0,
			is_verified: true,
			created_at: now,
			updated_at: now
		});
		if (!methodA) throw new Error("Throw error (undefined)");
		if (!methodB) throw new Error("Throw error (undefined)");
		expect(methodA.label).not.toBe(methodB.label);
	});

	it("should update label and verification status", () => {
		if (createdMethodId === undefined) return;

		const updated = update2FaMethods(createdMethodId, {
			label: "Updated Phone",
			is_verified: false
		});
		expect(updated).toBe(true);

		const method = getUser2FaMethodsById(createdMethodId);
        if (!method)throw new Error("Expected an user2FaMethods from getUser2FaMethodsById(), but got undefined.");
		expect(method.label).toBe("Updated Phone");
		expect(method.is_verified).toBe(0);
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
        if (!method)throw new Error("Expected an user2FaMethods from create2FaMethods(), but got undefined.");
		expect(method).toBeDefined();
		expect(method.is_verified).toBe(1);
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
        if (!method)throw new Error("Expected an user2FaMethods from create2FaMethods(), but got undefined.");
		expect(method).toBeDefined();
		expect(method.is_primary ?? 0).toBe(0);
	});

	it("should retrieve all 2FA methods for a user", () => {
		const methods = getUser2FaMethodsByUserId(userId);
		expect(Array.isArray(methods)).toBe(true);
		expect(methods.length).toBeGreaterThanOrEqual(2);
		methods.forEach(method => {
			expect(method.user_id).toBe(userId);
		});
	});

	it("should treat is_verified = undefined as 0 on creation", () => {
		const now = Math.floor(Date.now() / 1000);
		const method = create2FaMethods({
			user_id: userId,
			method_type: 10,
			label: "No Verified Field",
			is_primary: 0,
			created_at: now,
			updated_at: now,
		});
        if (!method)throw new Error("Expected an user2FaMethods from create2FaMethods(), but got undefined.");
		expect(method).toBeDefined();
		expect(method.is_verified).toBe(0);
	});

	it("should treat is_verified = false as 0 on creation", () => {
		const now = Math.floor(Date.now() / 1000);
		const method = create2FaMethods({
			user_id: userId,
			method_type: 11,
			label: "False Verified",
			is_primary: 0,
			is_verified: false,
			created_at: now,
			updated_at: now,
		});
        if (!method)throw new Error("Expected an user2FaMethods from create2FaMethods(), but got undefined.");
		expect(method).toBeDefined();
		expect(method.is_verified).toBe(0);
	});

	it("should treat is_verified = true as 1 on creation", () => {
		const now = Math.floor(Date.now() / 1000);
		const method = create2FaMethods({
			user_id: userId,
			method_type: 12,
			label: "True Verified",
			is_primary: 0,
			is_verified: true,
			created_at: now,
			updated_at: now,
		});
        if (!method)throw new Error("Expected an user2FaMethods from create2FaMethods(), but got undefined.");
		expect(method).toBeDefined();
		expect(method.is_verified).toBe(1);
	});

	it("should reject creation when created_at or updated_at are missing", () => {
		let method = create2FaMethods({
			user_id: userId,
			method_type: 13,
			label: "Missing created_at",
			is_verified: true,
			updated_at: Math.floor(Date.now() / 1000),
		});
		expect(method).toBeUndefined();

		method = create2FaMethods({
			user_id: userId,
			method_type: 14,
			label: "Missing updated_at",
			is_verified: true,
			created_at: Math.floor(Date.now() / 1000),
		});
		expect(method).toBeUndefined();
	});

	it("should update is_verified correctly (true to false)", () => {
		const now = Math.floor(Date.now() / 1000);
		const method = create2FaMethods({
			user_id: userId,
			method_type: 15,
			label: "Update Verified",
			is_primary: 0,
			is_verified: true,
			created_at: now,
			updated_at: now,
		});
		expect(method).toBeDefined();
		const methodId = (method as any).method_id;
		expect(methodId).toBeDefined();

		let updated = update2FaMethods(methodId, { is_verified: true });
		expect(updated).toBe(true);

		let fetched = getUser2FaMethodsById(methodId);
        if (!fetched)throw new Error("Expected an user2FaMethods from getUser2FaMethodsById(), but got undefined.");
		expect(fetched.is_verified).toBe(1);

		updated = update2FaMethods(methodId, { is_verified: false });
		expect(updated).toBe(true);

		fetched = getUser2FaMethodsById(methodId);
        if (!fetched)throw new Error("Expected an user2FaMethods from getUser2FaMethodsById(), but got undefined.");
		expect(fetched.is_verified).toBe(0);
	});

	it("should ignore undefined and null values in update", () => {
		const now = Math.floor(Date.now() / 1000);
		const method = create2FaMethods({
			user_id: userId,
			method_type: 16,
			label: "Ignore Undefined",
			is_primary: 0,
			is_verified: true,
			created_at: now,
			updated_at: now,
		});
		expect(method).toBeDefined();
		const methodId = (method as any).method_id;
		expect(methodId).toBeDefined();

		const updated = update2FaMethods(methodId, {
			is_verified: undefined,
			// @ts-expect-error
			label: null,
		});
		expect(updated).toBe(false);
	});

	it("should update created_at and updated_at when provided", () => {
		const now = Math.floor(Date.now() / 1000);
		const method = create2FaMethods({
			user_id: userId,
			method_type: 17,
			label: "Update Timestamps",
			is_primary: 0,
			is_verified: false,
			created_at: now,
			updated_at: now,
		});
		expect(method).toBeDefined();
		const methodId = (method as any).method_id;
		expect(methodId).toBeDefined();

		const newTimestamp = now + 1000;
		const updated = update2FaMethods(methodId, {
			created_at: newTimestamp,
			updated_at: newTimestamp,
		});
		expect(updated).toBe(true);

		const fetched = getUser2FaMethodsById(methodId);
        if (!fetched)throw new Error("Expected an user2FaMethods from getUser2FaMethodsById(), but got undefined.");
		expect(fetched.created_at).toBe(newTimestamp);
		expect(fetched.updated_at).toBe(newTimestamp);
	});
});
