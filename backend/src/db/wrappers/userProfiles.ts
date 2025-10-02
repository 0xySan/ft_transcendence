/*/*
 * Wrapper functions for interacting with the `user_profiles` table.
 * Provides retrieval, creation, updating, and listing utilities for user profiles.
 */

import { db, insertRow, getRow } from "../index.js";

// --- Types ---
export interface UserProfile {
	profile_id: number;
	user_id: number;
	username: string;
	display_name?: string;
	profile_picture?: string;
	country_id?: number;
	bio?: string;
}

/**
 * Get a profile by its ID.
 * @param id - The primary key of the profile
 * @returns The profile object if found, otherwise undefined
 */
export function getProfileById(id: number): UserProfile | undefined {
	return getRow<UserProfile>("user_profiles", "profile_id", id);
}

/**
 * Get a profile by user ID.
 * Ensures one-to-one relation between user and profile.
 *
 * @param userId - The user's ID
 * @returns The profile object if found, otherwise undefined
 */
export function getProfileByUserId(userId: number): UserProfile | undefined {
	return getRow<UserProfile>("user_profiles", "user_id", userId);
}

/**
 * Get a profile by username.
 * @param username - The unique username
 * @returns The profile object if found, otherwise undefined
 */
export function getProfileByUsername(username: string): UserProfile | undefined {
	return getRow<UserProfile>("user_profiles", "username", username);
}

/**
 * Create a new profile for a given user.
 * Uses the generic insertRow wrapper.
 *
 * @param userId - The ID of the user owning the profile
 * @param username - Unique username (3-20 chars, no spaces/@)
 * @param displayName - Optional display name (≤50 chars)
 * @param profilePicture - Optional profile picture path/URL (≤255 chars)
 * @param countryId - Optional foreign key to countries
 * @param bio - Optional biography (≤500 chars)
 * @returns The created UserProfile, or undefined if failed
 */
export function createProfile(
	userId: number,
	username: string,
	displayName?: string,
	profilePicture?: string,
	countryId?: number,
	bio?: string
): UserProfile | undefined {
	return insertRow<UserProfile>("user_profiles", {
		user_id: userId,
		username,
		display_name: displayName,
		profile_picture: profilePicture,
		country_id: countryId,
		bio,
	});
}

/**
 * Update an existing profile.
 * Only modifies the provided fields (others remain unchanged).
 *
 * @param profileId - The profile's ID
 * @param updates - Partial profile object with fields to update
 * @returns True if a row was updated, false otherwise
 */
export function updateProfile(
	profileId: number,
	updates: Partial<Omit<UserProfile, "profile_id" | "user_id" | "username">>
): boolean {
	const keys = Object.keys(updates);
	if (keys.length === 0) return false;

	const setClause = keys.map(k => `${k} = @${k}`).join(", ");
	const stmt = db.prepare(`
		UPDATE user_profiles
		SET ${setClause}
		WHERE profile_id = @profile_id
	`);
	const info = stmt.run({ profile_id: profileId, ...updates });
	return info.changes > 0;
}

/**
 * List all profiles.
 * @returns An array of all profile objects
 */
export function getAllProfiles(): UserProfile[] {
	const stmt = db.prepare(`
		SELECT * FROM user_profiles
		ORDER BY username
	`);
	return stmt.all() as UserProfile[];
}
