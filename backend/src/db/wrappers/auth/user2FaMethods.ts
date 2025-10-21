/**
 * Wrapper functions for interacting with the `user_2fa_methods` table.
 * Provides retrieval, creation, and listing utilities.
*/

import { db, insertRow, getRow } from "../../index.js";

export interface user2FaMethods {
    method_id:              number;
	user_id:	    	    number;
    method_type:            number;
    label:                  string;
    is_primary:             number;
    is_verified:            boolean;
    created_at:             number;
    updated_at:             number;
}

/**
 * Retrieve a user2FaMethods by its ID.
 * @param id - This id of the user2FaMethods 
 * @returns The user2FaMethods object if found, otherwise undefined
 */
export function getUser2FaMethodsById(id: number): user2FaMethods | undefined {
    return (getRow<user2FaMethods>("user_2fa_methods", "method_id", id));
}

/**
 * Retrieve all 2FA methods for a specific user.
 * @param user_id - The ID of the user
 * @returns An array of user2FaMethods objects associated with the user
 */
export function getUser2FaMethodsByUserId(user_id: number): user2FaMethods[] {
	const stmt = db.prepare("SELECT * FROM user_2fa_methods WHERE user_id = ?");
	return stmt.all(user_id) as user2FaMethods[];
}

/**
 * Retrieve the primary 2FA method for a specific user.
 * @param user_id - The ID of the user
 * @returns The primary user2FaMethods object if found, otherwise undefined
 */
export function getPrimary2FaMethodByUserId(user_id: number): user2FaMethods | undefined {
	const stmt = db.prepare("SELECT * FROM user_2fa_methods WHERE user_id = ? AND is_primary = 1");
	return stmt.get(user_id) as user2FaMethods | undefined;
}

/**
 * Create a new user2FaMethods if it doesn't exist.
 * Default values will be applied for missing fields.
 * Uses the generic insertRow wrapper to insert and fetch the session.
 * 
 * @param options - Partial session object with user2FaMethods, user_id, method_type, label, is_primary, is_verified, created_at, update_at
 * @returns The newly created or existing user2FaMethods object, or undefined if insertion failed
 */
export function create2FaMethods(options: Partial<user2FaMethods>): user2FaMethods | undefined {
    if (typeof options.user_id !== 'number' || typeof options.updated_at !== 'number' || typeof options.created_at !== 'number') { return (undefined); }
    const   user_id = options.user_id;
    const   method_type = options.method_type;
    const   label = options.label;
    const   is_primary = (options.is_primary ?? 0);
    const   is_verified = (options.is_verified ?? 0);
    const   created_at = options.created_at;
    const   updated_at = options.updated_at;

    return (insertRow<user2FaMethods>("user_2fa_methods", {
        user_id: user_id,
        method_type: method_type,
        label: label,
        is_primary: is_primary,
        is_verified: is_verified ? 1 : 0,
        created_at: created_at,
        updated_at: updated_at
    }));
}

/**
 * Update user2FaMethods.
 * Only updates the provided fields.
 * 
 * @param method_id - The provider ID
 * @param options - Partial information to update
 * @returns true if updated, false otherwise
 */
export function update2FaMethods(method_id: number, options: Partial<user2FaMethods>): boolean {
    const keys = Object.keys(options).filter(
        key => options[key as keyof user2FaMethods] !== undefined && options[key as keyof user2FaMethods] !== null
    );

    if (keys.length === 0) return false;

    const setClause = keys.map(key => `${key} = @${key}`).join(", ");

    const params: Record<string, unknown> = { method_id };
    for (const key of keys) {
        if (key === "is_verified") {
            params[key] = options.is_verified ? 1 : 0;
        } else {
            params[key] = options[key as keyof user2FaMethods];
        }
    }

    const stmt = db.prepare(`
        UPDATE user_2fa_methods
        SET ${setClause}
        WHERE method_id = @method_id
    `);

    const result = stmt.run(params);

    return (result.changes > 0);
}

/**
 * Delete a user2FaMethods by its ID.
 * @param method_id - The ID of the user2FaMethods to delete
 * @returns true if deleted, false otherwise
 */
export function delete2FaMethods(method_id: number): boolean {
	const stmt = db.prepare("DELETE FROM user_2fa_methods WHERE method_id = ?");
	const result = stmt.run(method_id);
	return (result.changes > 0);
}

/**
 * Set a 2FA method as primary for a user, unsetting any previous primary.
 * @param user_id - The ID of the user
 * @param method_id - The ID of the 2FA method to set as primary
 * @returns true if updated, false otherwise
 */
export function setPrimary2FaMethod(user_id: number, method_id: number): boolean {
	const unsetStmt = db.prepare("UPDATE user_2fa_methods SET is_primary = 0 WHERE user_id = ? AND is_primary = 1");
	unsetStmt.run(user_id);
	const setStmt = db.prepare("UPDATE user_2fa_methods SET is_primary = 1 WHERE method_id = ? AND user_id = ?");
	const result = setStmt.run(method_id, user_id);
	return (result.changes > 0);
}

/**
 * Verify a 2FA method.
 * @param method_id - The ID of the 2FA method to verify
 * @returns true if updated, false otherwise
 */
export function verify2FaMethod(method_id: number): boolean {
	const stmt = db.prepare("UPDATE user_2fa_methods SET is_verified = 1 WHERE method_id = ?");
	const result = stmt.run(method_id);
	return (result.changes > 0);
}
