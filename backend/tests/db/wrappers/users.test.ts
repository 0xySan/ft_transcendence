/**
 * @file users.test.ts
 * @description Unit tests for the users database wrapper.
 * 
 * This suite verifies:
 *  - insertion and retrieval of users,
 *  - updating last login and roles,
 *  - alphabetical listing.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../../../src/db/index.js";
import {
	getUserById,
	getUserByEmail,
	createUser,
	updateLastLogin,
	updateUserRole,
	getAllUsers,
} from "../../../src/db/wrappers/users.js";

describe("Users wrapper", () => {
	let adminId: number;
	let userId: number;
	let guestId: number;

	// --- Populate DB with initial users -----------------------------------
	beforeAll(() => {
		// Clean users table for testing
		db.prepare(`DELETE FROM users`).run();

		// Assuming user_roles already populated with 'Admin', 'User', 'Guest'
		const insertUser = db.prepare(`
			INSERT INTO users (email, password_hash, role_id)
			VALUES (?, ?, ?)
		`);
		const r1 = insertUser.run("admin@example.com", "hashed_admin", 1); // Admin role
		const r2 = insertUser.run("user@example.com", "hashed_user", 2);  // User role
		const r3 = insertUser.run("guest@example.com", "hashed_guest", 3); // Guest role

		adminId = Number(r1.lastInsertRowid);
		userId = Number(r2.lastInsertRowid);
		guestId = Number(r3.lastInsertRowid);
	});

	afterAll(() => {
		try {
			db.prepare(`DELETE FROM users`).run();
		} catch {
			// ignore cleanup errors
		}
	});

	// --- Tests for retrieval ---------------------------------------------
	it("should return a user by ID", () => {
		const user = getUserById(adminId);
		expect(user).toBeDefined();
		expect(user?.email).toBe("admin@example.com");
	});

	it("should return undefined if ID does not exist", () => {
		const result = getUserById(9999);
		expect(result).toBeUndefined();
	});

	it("should return a user by email", () => {
		const user = getUserByEmail("user@example.com");
		expect(user).toBeDefined();
		expect(user?.email).toBe("user@example.com");
	});

	it("should return undefined for a non-existing email", () => {
		const result = getUserByEmail("nonexistent@example.com");
		expect(result).toBeUndefined();
	});

	// --- Tests for creation ----------------------------------------------
	it("should create a new user successfully", () => {
		const newUser = createUser("new@example.com", "hashed_new", 2);
		expect(newUser).toBeDefined();
		expect(newUser?.email).toBe("new@example.com");
		expect(newUser?.role_id).toBe(2);
	});

	it("should return existing user if email already exists", () => {
		const duplicate = createUser("admin@example.com", "hashed_admin", 1);
		expect(duplicate).toBeDefined();
		expect(duplicate?.email).toBe("admin@example.com");
	});

	it("should return undefined if creation fails for other reasons", () => {
		// Simulate failure by passing invalid role_id (assuming roles 1-3 exist)
		const result = createUser("test@example.com", "hashed_test", 99);
		expect(result).toBeUndefined();
	});

	// --- Tests for updates -----------------------------------------------
	it("should update last login successfully", () => {
		const updated = updateLastLogin(userId);
		expect(updated).toBe(true);

		const user = getUserById(userId);
		expect(user?.last_login).toBeDefined();
	});

	it("should return false when updating last login for non-existing user", () => {
		const result = updateLastLogin(9999);
		expect(result).toBe(false);
	});

	it("should update user role successfully", () => {
		const updated = updateUserRole(guestId, 2); // change Guest -> User
		expect(updated).toBe(true);

		const user = getUserById(guestId);
		expect(user?.role_id).toBe(2);
	});

	it("should return false when updating role for non-existing user", () => {
		const result = updateUserRole(9999, 1);
		expect(result).toBe(false);
	});

	// --- Tests for listing -----------------------------------------------
	it("should list all users sorted alphabetically by email", () => {
		const users = getAllUsers();
		expect(users.length).toBeGreaterThanOrEqual(3);

		const emails = users.map(u => u.email);
		const isSorted = emails.every((v, i, arr) => !i || arr[i - 1] <= v);
		expect(isSorted).toBe(true);
	});
});
