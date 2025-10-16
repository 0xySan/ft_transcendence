/**
 * Wrapper functions for interacting with the `sessions` table.
 * Provides retrieval, creation, and listing utilities.
*/

import { numericToAlpha2 } from "i18n-iso-countries";
import { db, insertRow, getRow } from "../../index.js";

export interface user_2fa_totp {
	totp_id:                number;
    method_id:              number;
    secret_encrypted:       string;
    secret_meta:            string;
    last_used:              number;
}

/**
 * Retrieve a user_2fa_totp by its ID.
 * @param id - This id of the user_2fa_totp 
 * @returns The user_2fa_totp object if found, otherwise undefined
 */
export function getSessionById(id: number): user_2fa_totp | undefined {
    return (getRow<user_2fa_totp>("user_2fa_totp", "totp_id", id));
}

/**
 * Retrieve a user_2fa_totp by its method_id.
 * @param method_id - This id of the user_2fa_totp 
 * @returns The user_2fa_totp object if found, otherwise undefined
 */
export function getUser2faTotpByMethodId(method_id: number): user_2fa_totp | undefined {
	const stmt = db.prepare(`SELECT * FROM user_2fa_totp WHERE method_id = ?`);
	return stmt.get(method_id) as user_2fa_totp | undefined;
}

/**
 * List all user_2fa_totp.
 * @returns An array of user_2fa_totp objects, or an empty array if none found
 */
export function listUser2faTotp(): user_2fa_totp[] {
	const stmt = db.prepare(`SELECT * FROM user_2fa_totp`);
	return stmt.all() as user_2fa_totp[];
}

/**
 * Create a new user_2fa_totp if it doesn't exist.
 * Default values will be applied for missing fields.
 * Uses the generic insertRow wrapper to insert and fetch the user_2fa_totp.
 * 
 * @param options - Partial user_2fa_totp object with totp_id, method_id, secret_encrypted, secret_meta, last_used
 * @returns The newly created or existing user_2fa_totp object, or undefined if insertion failed
 */
export function createUser2faTotp(options: Partial<user_2fa_totp>): user_2fa_totp | undefined {
    const   totp_id = (options.totp_id);
    const   method_id = (options.method_id);
    const   secret_encrypted = (options.secret_encrypted);
    const   secret_meta = (options.secret_meta);
    const   last_used = (options.last_used);

    return (insertRow<user_2fa_totp>("user_2fa_totp", {
        totp_id: totp_id,
        method_id: method_id,
        secret_encrypted: secret_encrypted,
        secret_meta: secret_meta,
        last_used: last_used
    }));
}

/**
 * Update user_2fa_totp.
 * Only updates the provided fields.
 * 
 * @param totp_id - The provider ID
 * @param options - Partial information to update
 * @returns true if updated, false otherwise
 */
export function updateUser2faTotp(totp_id: number, options: Partial<user_2fa_totp>): boolean {
    const keys = Object.keys(options).filter(
        key => options[key as keyof user_2fa_totp] !== undefined && options[key as keyof user_2fa_totp] !== null
    );

    if (keys.length === 0) return false;

    const setClause = keys.map(key => `${key} = @${key}`).join(", ");

    const params: Record<string, unknown> = { totp_id };
    for (const key of keys) {
        params[key] = options[key as keyof user_2fa_totp];
    }

    const stmt = db.prepare(`
        UPDATE user_2fa_totp
        SET ${setClause}
        WHERE totp_id = @totp_id
    `);

    const result = stmt.run(params);

    return (result.changes > 0);
}
