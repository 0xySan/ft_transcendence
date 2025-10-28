/**
 * Wrapper functions for interacting with the `email_verifications` table.
 * Provides creation, retrieval, validation, and status update utilities.
*/

import { db, insertRow, getRow } from "../../index.js";

export interface emailVerification {
	id:             number;
	user_id:        number;
	token:          string;
	expires_at:     number; // Unix timestamp (seconds)
	verified:       boolean;
}

/**
 * Retrieve an emailVerification by its ID.
 * @param id - The primary key of the emailVerification
 * @returns The emailVerification object if found, otherwise undefined
 */
export function getEmailVerificationById(id: number): emailVerification | undefined {
	return getRow<emailVerification>("email_verifications", "id", id);
}

/**
 * Retrieve an emailVerification by its token.
 * @param token - The verification token
 * @returns The emailVerification object if found, otherwise undefined
 */
export function getEmailVerificationByToken(token: string): emailVerification | undefined {
	const stmt = db.prepare("SELECT * FROM email_verifications WHERE token = ?");
	const row = stmt.get(token) as emailVerification | undefined;
	return row;
}

/**
 * Retrieve all emailVerifications for a given user ID.
 * @param userId - The user ID
 * @returns An array of emailVerification objects
 */
export function getEmailVerificationsByUserId(userId: number): emailVerification[] {
	const stmt = db.prepare("SELECT * FROM email_verifications WHERE user_id = ?");
	const rows = stmt.all(userId) as emailVerification[];
	return rows;
}

/**
 * Check if an emailVerification token is valid:
 * - Exists
 * - Not verified yet
 * - Not expired (expires_at timestamp > current time)
 * 
 * @param token - The token to validate
 * @returns true if valid, false otherwise
 */
export function checkEmailVerificationValidity(token: string): boolean {
	const entry = getEmailVerificationByToken(token);
	if (!entry) return false;

	const now = Math.floor(Date.now() / 1000);
	if (entry.verified) return false;
	if (entry.expires_at && entry.expires_at < now) return false;

	return true;
}

/**
 * Create a new emailVerification entry.
 * Automatically sets verified = 0.
 * Uses the generic insertRow wrapper to insert and fetch the entry.
 * 
 * @param options - Partial emailVerification object with user_id, token, expires_at
 * @returns The newly created emailVerification object, or undefined if insertion failed
 */
export function createEmailVerification(options: Partial<emailVerification>): emailVerification | undefined {
	const	user_id = options.user_id;
	const	token = options.token;
	const	expires_at = options.expires_at;
	const	verified = (options.verified ?? 0);

	return insertRow<emailVerification>("email_verifications", {
		user_id: user_id,
		token: token,
		expires_at: expires_at,
		verified: (verified ? 1 : 0)
	});
}

/**
 * Mark an emailVerification as verified.
 * @param token - The verification token
 * @returns true if the row was updated, false otherwise
 */
export function markEmailAsVerified(token: string): boolean {
	const stmt = db.prepare(`
		UPDATE email_verifications
		SET verified = 1
		WHERE token = ? AND verified = 0
	`);
	const result = stmt.run(token);
	return result.changes > 0;
}

/**
 * Clean up expired or verified tokens.
 * @returns The number of rows deleted
 */
export function cleanupOldEmailVerifications(): number {
	const now = Math.floor(Date.now() / 1000);
	const stmt = db.prepare(`
		DELETE FROM email_verifications
		WHERE verified = 1 OR expires_at < ?
	`);
	const result = stmt.run(now);
	return result.changes;
}
