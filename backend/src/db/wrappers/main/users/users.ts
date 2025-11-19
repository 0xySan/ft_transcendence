/*
 * Wrapper functions for interacting with the `users` table.
 * Provides retrieval, creation, and update utilities for user accounts.
 */

import { db, getRow, insertRow } from "../../../index.js";
import { v7 as uuidv7 } from "uuid";

// --- Types ---
export interface User {
	user_id: string;
	email: string;
	password_hash: string;
	created_at: string;
	updated_at: string;
	last_login?: string;
	role_id: number;
}

/**
 * Get a user by ID.
 * @param id - The primary key of the user
 * @returns The user object if found, otherwise undefined
 */
export function getUserById(id: string): User | undefined {
	return getRow<User>("users", "user_id", id);
}

/**
 * Get a user by email.
 * @param email - The user's email
 * @returns The user object if found, otherwise undefined
 */
export function getUserByEmail(email: string): User | undefined {
	return getRow<User>("users", "email", email);
}

/**
 * Create a new user.
 * Uses the generic insertRow wrapper to simplify insertion.
 *
 * @param email - The user's email
 * @param passwordHash - The hashed password
 * @param roleId - The role ID (defaults to 1)
 * @returns The created or existing user, or undefined if failed
 */
export function createUser(email: string, passwordHash: string, roleId = 1): User | undefined {
	const userId = uuidv7(); // <-- generate UUID v4

	const user = insertRow<User>("users", {
		user_id: userId,
		email,
		password_hash: passwordHash,
		role_id: roleId,
	});

	if (!user) {
		const isExisting = getUserByEmail(email);
		if (isExisting) return isExisting;
		return undefined;
	}

	if (user.last_login === null) user.last_login = undefined;

	return user;
}

export function getPasswordHashByUserId(userId: string): string | undefined {
	return getRow<User>("users", "user_id", userId)?.password_hash;
}

/**
 * Update a user's last login timestamp to the current time.
 * Returns true if a user was actually updated.
 *
 * @param userId - The user's ID
 * @returns boolean indicating if the update was successful
 */
export function updateLastLogin(userId: string): boolean {
	const stmt = db.prepare(`
		UPDATE users
		SET last_login = CURRENT_TIMESTAMP
		WHERE user_id = ?
	`);
	const info = stmt.run(userId);
	return info.changes > 0;
}

/**
 * Update a user's role.
 * Returns true if a user was actually updated, false if the userId does not exist.
 *
 * @param userId - The user's ID
 * @param roleId - The new role ID
 * @returns boolean indicating if the update was successful
 */
export function updateUserRole(userId: string, roleId: number): boolean {
	const stmt = db.prepare(`
		UPDATE users
		SET role_id = ?
		WHERE user_id = ?
	`);
	const info = stmt.run(roleId, userId);
	return info.changes > 0;
}

/**
 * List all users in alphabetical order by email.
 * @returns An array of all user objects
 */
export function getAllUsers(): User[] {
	const stmt = db.prepare(`
		SELECT * FROM users
		ORDER BY email
	`);
	return stmt.all() as User[];
}

/**
 * Update user.
 * Only updates the provided fields.
 * 
 * @param user_id - The reset ID
 * @param options - Partial information to update
 * @returns true if updated, false otherwise
 */
export function updateUser(user_id: string, options: Partial<User>): boolean {
	const keys = Object.keys(options).filter(
		key => options[key as keyof User] !== undefined && options[key as keyof User] !== null
	);

	if (keys.length === 0) return false;

	const setClause = keys.map(key => `${key} = @${key}`).join(", ");

	const params: Record<string, unknown> = { user_id };
	for (const key of keys) {
		params[key] = options[key as keyof User];
	}

	const stmt = db.prepare(`
		UPDATE users
		SET ${setClause}
		WHERE user_id = @user_id
	`);

	const result = stmt.run(params);

	return (result.changes > 0);
}
