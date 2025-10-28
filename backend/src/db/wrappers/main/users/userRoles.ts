/*
 * Wrapper functions for interacting with the `user_roles` table.
 * Provides retrieval, creation, and listing utilities for user roles.
 */

import { db, insertRow, getRow } from "../../../index.js";

// --- Types ---
export interface UserRole {
	role_id: number;
	role_name: string;
}

/**
 * Get a role by its ID.
 * @param id - The primary key of the role
 * @returns The role object if found, otherwise undefined
 */
export function getRoleById(id: number): UserRole | undefined {
	return getRow<UserRole>("user_roles", "role_id", id);
}

/**
 * Get a role by its name.
 * @param name - The role name
 * @returns The role object if found, otherwise undefined
 */
export function getRoleByName(name: string): UserRole | undefined {
	return getRow<UserRole>("user_roles", "role_name", name);
}

/**
 * Create a new role if it doesn't exist.
 * Uses the generic insertRow wrapper.
 *
 * @param name - Role name (max 20 chars)
 * @returns The created or existing UserRole, or undefined if failed
 */
export function createRole(name: string): UserRole | undefined {
	const role =  insertRow<UserRole>("user_roles", {
		role_name: name,
	});

	if (!role) {
		const isExisting = getRoleByName(name);
		if (isExisting) return isExisting;
		return undefined;
	}
	
	return role;
}

/**
 * List all roles in alphabetical order by name.
 * @returns An array of all role objects
 */
export function getAllRoles(): UserRole[] {
	const stmt = db.prepare(`
		SELECT * FROM user_roles
		ORDER BY role_name
	`);
	return stmt.all() as UserRole[];
}
