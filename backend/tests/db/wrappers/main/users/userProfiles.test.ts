/**
 * @file userProfiles.test.ts
 * @description Unit tests for the user_profiles wrapper.
 * 
 * This test file:
 *  - prepares minimal test data (users + profiles) in beforeAll,
 *  - ensures any missing helper column (updated_at) is added so triggers don't crash,
 *  - runs CRUD + constraint tests on user_profiles via the wrapper functions.
 *
 * Notes:
 *  - We assume the DB schema (tables) is already created by init.sql (as in your test environment).
 *  - We use returned lastInsertRowid values instead of hard-coded IDs to avoid FK issues.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../../../../../src/db/index.js";
import {
	getProfileById,
	getProfileByUserId,
	getProfileByUsername,
	createProfile,
	updateProfile,
	getAllProfiles
} from "../../../../../src/db/wrappers/main/users/userProfiles.js";

describe("UserProfiles wrapper", () => {
	let userId1: number;
	let userId2: number;
	let userId3: number;
	let createdProfileId: number | undefined;

	// Prepare initial users and profiles before tests
	beforeAll(() => {
		// --- Ensure updated_at column exists on user_profiles (trigger expects it) ---
		// If the column already exists this will throw; swallow that error.
		try {
			db.prepare(`ALTER TABLE user_profiles ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`).run();
		} catch (err) {
			// ignore if column already exists or ALTER not applicable
		}

		// --- Insert some users and capture their IDs (use returned lastInsertRowid) ---
		const insertUser = db.prepare(`
			INSERT INTO users (email, password_hash, role_id)
			VALUES (?, ?, ?)
		`);
		const r1 = insertUser.run("test_admin@example.local", "hash-admin", 1);
		const r2 = insertUser.run("test_guest@example.local", "hash-guest", 1);
		const r3 = insertUser.run("test_player@example.local", "hash-player", 1);

		userId1 = Number(r1.lastInsertRowid);
		userId2 = Number(r2.lastInsertRowid);
		userId3 = Number(r3.lastInsertRowid);

		// --- Insert initial profiles for those users ---
		const insertProfile = db.prepare(`
			INSERT INTO user_profiles (user_id, username, display_name, profile_picture, country_id, bio)
			VALUES (?, ?, ?, ?, ?, ?)
		`);

		// use lowercase usernames for consistency
		insertProfile.run(userId1, "admin", "Admin User", "/avatars/admin.png", 1, "Super admin");
		insertProfile.run(userId2, "guest", "Guest User", "/avatars/guest.png", 1, "Just visiting");
		insertProfile.run(userId3, "player", "Regular Player", "/avatars/player.png", 1, "Plays daily");
	});

	it("should list all profiles sorted alphabetically", () => {
		const all = getAllProfiles();
		expect(all.length).toBeGreaterThan(0);

		const names = all.map(p => p.username);
		const isSorted = names.every((v, i, arr) => !i || arr[i - 1] <= v);
		expect(isSorted).toBe(true);
	});

	it("should return a profile by its ID", () => {
		const all = getAllProfiles();
		const firstId = all[0]?.profile_id;
		const profile = getProfileById(firstId);
		expect(profile).toBeDefined();
		expect(profile?.profile_id).toBe(firstId);
	});

	it("should return undefined if ID does not exist", () => {
		const result = getProfileById(999999);
		expect(result).toBeUndefined();
	});

	it("should return a profile by user ID", () => {
		const profile = getProfileByUserId(userId1);
		expect(profile).toBeDefined();
		expect(profile?.user_id).toBe(userId1);
	});

	it("should return undefined for an unknown user ID", () => {
		const result = getProfileByUserId(999999);
		expect(result).toBeUndefined();
	});

	it("should return a profile by username", () => {
		const profile = getProfileByUsername("admin");
		expect(profile).toBeDefined();
		expect(profile?.username).toBe("admin");
	});

	it("should return undefined for an unknown username", () => {
		const result = getProfileByUsername("nonexistent_user");
		expect(result).toBeUndefined();
	});

	it("should create a new profile with provided values", () => {
		// create a new user first to satisfy FK
		const addUser = db.prepare(`INSERT INTO users (email, password_hash, role_id) VALUES (?, ?, ?)`);
		const r = addUser.run("test_random@example.local", "hash-random", 1);
		const newUserId = Number(r.lastInsertRowid);

		// create profile for that new user
		const newProfile = createProfile(
			newUserId,
			"random_player",         // lowercase username
			"RNG Explorer",
			"/avatars/random.png",
			1,
			"Random bio"
		);

		expect(newProfile).toBeDefined();
		expect(newProfile?.username).toBe("random_player");
		expect(newProfile?.display_name).toBe("RNG Explorer");

		// keep id for further tests
		createdProfileId = newProfile?.profile_id;
	});

	it("should not create a duplicate profile with same username", () => {
		// create another user
		const addUser = db.prepare(`INSERT INTO users (email, password_hash, role_id) VALUES (?, ?, ?)`);
		const r = addUser.run("test_random2@example.local", "hash-random2", 1);
		const newUserId = Number(r.lastInsertRowid);

		// attempt to create a profile with an already used username => should fail (returns undefined)
		const duplicate = createProfile(newUserId, "random_player", "Another", "/avatars/another.png", 1, "bio");
		expect(duplicate).toBeUndefined();
	});

	it("should update an existing profile", () => {
		// ensure the profile exists
		const target = getProfileByUsername("random_player");
		expect(target).toBeDefined();

		const updated = updateProfile(target!.profile_id, {
			display_name: "RNG Master",
			bio: "Updated bio"
		});
		expect(updated).toBe(true);

		const fetched = getProfileById(target!.profile_id);
		expect(fetched?.display_name).toBe("RNG Master");
		expect(fetched?.bio).toBe("Updated bio");
	});

	it("should return false when updating a non-existing profile", () => {
		const result = updateProfile(999999, { display_name: "Ghost" });
		expect(result).toBe(false);
	});

	it("should return false if updates object is empty", () => {
		const result = updateProfile(createdProfileId!, {});
		expect(result).toBe(false);
	});
});
