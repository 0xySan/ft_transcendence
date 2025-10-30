/**
 * Wrapper functions for interacting with the `passwordResets` table.
 * Provides retrieval, creation, and listing utilities.
*/

import { db, insertRow, getRow } from "../../index.js";

export interface passwordReset {
	reset_id:		number;
	user_id:		string;
	token_hash:		string;
	created_at:		number;
	expired_at:		number;
	consumed:		boolean;
	consumed_at:	number;
}

/**
 * Retrieve a passwordReset by its ID.
 * @param id - This id of the reset password
 * @returns The passwordReset object if found, otherwise undefined
 */
export function getPasswordResetById(id: number): passwordReset | undefined {
	return (getRow<passwordReset>("password_resets", "reset_id", id));
}

/**
 * Retrieve a passwordReset by its token hash.
 * @param token_hash - The token hash of the reset password
 * @returns The passwordReset object if found, otherwise undefined
 */
export function getPasswordResetByTokenHash(token_hash: string): passwordReset | undefined {
	return (getRow<passwordReset>("password_resets", "token_hash", token_hash));
}

/**
 * List all passwordResets linked to a specific user ID.
 * @param user_id - The user ID to filter passwordResets
 * @returns An array of passwordResets objects, or an empty array if none found
 */
export function getPasswordResetsByUserId(user_id: string): passwordReset[] {
	const stmt = db.prepare("SELECT * FROM password_resets WHERE user_id = ?");
	return (stmt.all(user_id) as passwordReset[]);
}

/**
 * Retrieve all unconsumed passwordResets that are not expired for a specific user ID.
 * @param user_id - The user ID to filter passwordResets
 * @returns An array of unconsumed and valid passwordResets objects, or an empty array if none found
 */
export function getValidPasswordResetsByUserId(user_id: string): passwordReset[] {
	try {
		const currentTime = Math.floor(Date.now() / 1000);
		const stmt = db.prepare(`SELECT * FROM password_resets WHERE user_id = ? AND consumed = 0 AND expired_at > ?`);
		const rows = stmt.all(user_id, currentTime);
		return rows as passwordReset[];
	} catch (error) {
		return [];
	}
}

/**
 * Create a new passwordReset if it doesn't exist.
 * Default values will be applied for missing fields.
 * Uses the generic insertRow wrapper to insert and fetch the passwordReset.
 * 
 * @param options - Partial passwordReset object with id, token_hash, created and expired timestamp, consumed et date of consumed
 * @returns The newly created or existing passwordReset object, or undefined if insertion failed
 */
export function createPasswordReset(options: Partial<passwordReset>): passwordReset | undefined {
	const	user_id = options.user_id;
	const	token_hash = options.token_hash;
	const	created_at = Math.floor(Date.now() / 1000);
	const	expired_at = options.expired_at;
	const	consumed = (options.consumed ?? false);
	const	consumed_at = 0;

	return (insertRow<passwordReset>("password_resets", {
		user_id: user_id,
		token_hash: token_hash,
		created_at: created_at,
		expired_at: expired_at,
		consumed: consumed ? 1 : 0,
		consumed_at: consumed_at
	}));
}

/**
 * Update passwordReset.
 * Only updates the provided fields.
 * 
 * @param reset_id - The reset ID
 * @param options - Partial information to update
 * @returns true if updated, false otherwise
 */
export function updatePasswordReset(reset_id: number, options: Partial<passwordReset>): boolean {
	const keys = Object.keys(options).filter(
		key => options[key as keyof passwordReset] !== undefined && options[key as keyof passwordReset] !== null
	);

	if (keys.length === 0) return false;

	const setClause = keys.map(key => `${key} = @${key}`).join(", ");

	const params: Record<string, unknown> = { reset_id };
	for (const key of keys) {
		if (key === "consumed") {
			params[key] = options.consumed ? 1 : 0;
		} else {
			params[key] = options[key as keyof passwordReset];
		}
	}

	const stmt = db.prepare(`
		UPDATE password_resets
		SET ${setClause}
		WHERE reset_id = @reset_id
	`);

	const result = stmt.run(params);

	return (result.changes > 0);
}
