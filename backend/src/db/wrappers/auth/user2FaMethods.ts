/**
 * Wrapper functions for interacting with the `user_2fa_methods` table.
 * Provides retrieval, creation, and listing utilities.
*/

import { db, insertRow, getRow } from "../../index.js";

export interface user2FaMethods {
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

    const	new_row = insertRow<user2FaMethods>("user_2fa_methods", {
        user_id: user_id,
        method_type: method_type,
        label: label,
        is_primary: is_primary,
        is_verified: is_verified ? 1 : 0,
        created_at: created_at,
        updated_at: updated_at
    });
    return (new_row);
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