/**
 * Wrapper functions for interacting with the `passwordResets` table.
 * Provides retrieval, creation, and listing utilities.
*/

import { db, insertRow, getRow } from "../../index.js";

export interface passwordResets {
	reset_id:		number;
	user_id:		number;
	token_hash:		string;
	created_at:		number;
	expired_at:		number;
	consumed:		boolean;
	consumed_at:	number;
}

/**
 * Retrieve a passwordResets by its ID.
 * @param id - This id of the reset password
 * @returns The passwordResets object if found, otherwise undefined
 */
export function getPasswordResetsById(id: number): passwordResets | undefined {
	return (getRow<passwordResets>("password_resets", "reset_id", id));
}

/**
 * Create a new passwordResets if it doesn't exist.
 * Default values will be applied for missing fields.
 * Uses the generic insertRow wrapper to insert and fetch the passwordResets.
 * 
 * @param options - Partial passwordResets object with id, token_hash, created and expired timestamp, consumed et date of consumed
 * @returns The newly created or existing passwordResets object, or undefined if insertion failed
 */
export function createPasswordResets(options: Partial<passwordResets>): passwordResets | undefined {
	const	user_id = options.user_id;
	const	token_hash = options.token_hash;
	const	created_at = Math.floor(Date.now() / 1000);
	const	expired_at = options.expired_at;
	const	consumed = (options.consumed ?? false);
	const	consumed_at = 0;

	const	new_row = insertRow<passwordResets>("password_resets", {
		user_id: user_id,
		token_hash: token_hash,
		created_at: created_at,
		expired_at: expired_at,
		consumed: consumed ? 1 : 0,
		consumed_at: consumed_at
	});

	return (new_row);
}

/**
 * Update passwordResets.
 * Only updates the provided fields.
 * 
 * @param reset_id - The provider ID
 * @param options - Partial information to update
 * @returns true if updated, false otherwise
 */
export function updatePasswordResets(reset_id: number, options: Partial<passwordResets>): boolean {
	const keys = Object.keys(options).filter(
		key => options[key as keyof passwordResets] !== undefined && options[key as keyof passwordResets] !== null
	);

	if (keys.length === 0) return false;

	const setClause = keys.map(key => `${key} = @${key}`).join(", ");

	const params: Record<string, unknown> = { reset_id };
	for (const key of keys) {
		if (key === "consumed") {
			params[key] = options.consumed ? 1 : 0;
		} else {
			params[key] = options[key as keyof passwordResets];
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