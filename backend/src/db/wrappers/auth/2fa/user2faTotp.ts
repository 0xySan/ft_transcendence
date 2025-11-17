/**
 * Wrapper functions for interacting with the `sessions` table.
 * Provides retrieval, creation, and listing utilities.
*/

import { db, insertRow, getRow, user2FaMethods } from "../../../index.js";

export interface user2faTotp {
	totp_id:                number;
    method_id:              string;
    secret_encrypted:       string;
    secret_meta:            string;
    last_used:              number;
}

export interface User2FaTotpDetails {
	method: user2FaMethods;
	totp: user2faTotp;
}

type TotpRow = user2FaMethods & {
	totp_id:                number;
	secret_encrypted:       string;
	secret_meta:            string;
	last_used:              number;
};
/**
 * Retrieve a user2faTotp by its ID.
 * @param id - This id of the user2faTotp 
 * @returns The user2faTotp object if found, otherwise undefined
 */
export function getUser2faTotpById(id: number): user2faTotp | undefined {
    return (getRow<user2faTotp>("user_2fa_totp", "totp_id", id));
}

/**
 * Retrieve a user2faTotp by its method_id.
 * @param method_id - This id of the user2faTotp 
 * @returns The user2faTotp object if found, otherwise undefined
 */
export function getUser2faTotpByMethodId(method_id: string): user2faTotp | undefined {
    return (getRow<user2faTotp>("user_2fa_totp", "method_id", method_id));
}

/**
 * List all user2faTotp records.
 * @returns A list of all user2faTotp records.
 */
export function listUser2faTotp(): user2faTotp[] {
	const stmt = db.prepare(`SELECT * FROM user_2fa_totp`);
	return stmt.all() as user2faTotp[];
}

/**
 * Create a new user2faTotp if it doesn't exist.
 * Default values will be applied for missing fields.
 * @param options - Partial user2faTotp object with totp_id, method_id, secret_encrypted, secret_meta, last_used
 * @returns The newly created or existing user2faTotp object, or undefined if insertion failed
 */
export function createUser2faTotp(options: Partial<user2faTotp>): user2faTotp | undefined {
    const   totp_id = (options.totp_id);
    const   method_id = (options.method_id);
    const   secret_encrypted = (options.secret_encrypted);
    const   secret_meta = (options.secret_meta);
    const   last_used = (options.last_used);

    return (insertRow<user2faTotp>("user_2fa_totp", {
        totp_id: totp_id,
        method_id: method_id,
        secret_encrypted: secret_encrypted,
        secret_meta: secret_meta,
        last_used: last_used
    }));
}

/**
 * Update user2faTotp.
 * Only updates the provided fields.
 * 
 * @param totp_id - The provider ID
 * @param options - Partial information to update
 * @returns true if updated, false otherwise
 */
export function updateUser2faTotp(totp_id: number, options: Partial<user2faTotp>): boolean {
    const keys = Object.keys(options).filter(
        key => options[key as keyof user2faTotp] !== undefined && options[key as keyof user2faTotp] !== null
    );

    if (keys.length === 0) return false;

    const setClause = keys.map(key => `${key} = @${key}`).join(", ");

    const params: Record<string, unknown> = { totp_id };
    for (const key of keys) {
        params[key] = options[key as keyof user2faTotp];
    }

    const stmt = db.prepare(`
        UPDATE user_2fa_totp
        SET ${setClause}
        WHERE totp_id = @totp_id
    `);

    const result = stmt.run(params);

    return (result.changes > 0);
}

export function getUserTotpMethodById(method_id: string): User2FaTotpDetails | undefined {
	const stmt = db.prepare(`
		SELECT 
			m.*, 
			t.totp_id, t.secret_encrypted, t.secret_meta, t.last_used
		FROM user_2fa_methods m
		JOIN user_2fa_totp t ON m.method_id = t.method_id
		WHERE m.method_id = ? AND m.method_type = 1
	`);

	const row = stmt.get(method_id) as TotpRow | undefined;
	if (!row) return undefined;

	const method: user2FaMethods = {
		method_id: row.method_id,
		user_id: row.user_id,
		method_type: row.method_type,
		label: row.label,
		is_primary: !!row.is_primary,
		is_verified: !!row.is_verified,
		created_at: row.created_at,
		updated_at: row.updated_at
	};

	const totp: user2faTotp = {
		totp_id: row.totp_id,
		method_id: row.method_id,
		secret_encrypted: row.secret_encrypted,
		secret_meta: row.secret_meta,
		last_used: row.last_used
	};

	return { method, totp };
}