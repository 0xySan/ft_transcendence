/**
 * Wrapper functions for interacting with the `user2faBackupCodes` table.
 * Provides retrieval, creation, and listing utilities.
*/

import { db, insertRow, getRow, user2FaMethods } from "../../../index.js";

export interface	user2faBackupCodes {
	backup_code_id:	number;
    method_id:		string;
    code_json:		string;
    created_at:		number;
	user_id:		string;
}

export interface	User2FaBackupCodesDetails {
	method:		user2FaMethods;
	codes:		user2faBackupCodes;
}

type BackupCodesRow = user2faBackupCodes & {
	method_id:		string;
	user_id:		string;
	label:			string | null;
	method_type:	0 | 1 | 2;
	is_primary:		boolean;
	is_verified:	boolean;
	created_at:		number;
	updated_at:		number;
};

/**
 * Retrieve a user2faBackupCodes by its ID.
 * @param id - The primary key of the user2faBackupCodes
 * @returns The user2faBackupCodes object if found, otherwise undefined
 */
export function getApiTokensById(id: number): user2faBackupCodes | undefined {
    return (getRow<user2faBackupCodes>("user_2fa_backup_codes", "backup_code_id", id));
}

/**
 * Create a new user2faBackupCodes if it doesn't exist.
 * Default values will be applied for missing fields.
 * Uses the generic insertRow wrapper to insert and fetch the user2faBackupCodes.
 * 
 * @param options - Partial user2faBackupCodes object with method_id, code_json, created_at
 * @returns The newly created or existing user2faBackupCodes object, or undefined if insertion failed
 */
export function createUser2faBackupCodes(options: Partial<user2faBackupCodes>): user2faBackupCodes | undefined {
    const   method_id = (options.method_id);
    const   code_json = (options.code_json);
    const   created_at = (options.created_at ?? Date.now());

    return (insertRow<user2faBackupCodes>("user_2fa_backup_codes", {
        method_id: method_id,
        code_json: code_json,
        created_at: created_at
    }));
}

/**
 * Retrieve a user2faBackupCodes by its method_id.
 * @param method_id - The method ID
 * @returns The user2faBackupCodes object if found, otherwise undefined
 */
export function getBackupCodesByMethodId(method_id: string): user2faBackupCodes | undefined {
	return (getRow<user2faBackupCodes>("user_2fa_backup_codes", "method_id", method_id));
}

/**
 * Update user2faBackupCodes.
 * Only updates the provided fields.
 * 
 * @param app_id - The provider ID
 * @param options - Partial information to update
 * @returns true if updated, false otherwise
 */
export function updateBCodes(backup_code_id: number, options: Partial<user2faBackupCodes>): boolean {
    const keys = Object.keys(options).filter(
        key => options[key as keyof user2faBackupCodes] !== undefined && options[key as keyof user2faBackupCodes] !== null
    );

    if (keys.length === 0) return false;

    const setClause = keys.map(key => `${key} = @${key}`).join(", ");

    const params: Record<string, unknown> = { backup_code_id };
    for (const key of keys) {
        params[key] = options[key as keyof user2faBackupCodes];
    }

    const stmt = db.prepare(`
        UPDATE user_2fa_backup_codes
        SET ${setClause}
        WHERE backup_code_id = @backup_code_id
    `);

    const result = stmt.run(params);

    return (result.changes > 0);
}

export function getUserBCodesMethodById(method_id: string): User2FaBackupCodesDetails | undefined {
	const stmt = db.prepare(`
		SELECT 
			m.*, 
			b.*
		FROM user_2fa_methods m
		JOIN user_2fa_backup_codes b ON m.method_id = b.method_id
		WHERE m.method_id = ?
	`);

	const row = stmt.get(method_id) as BackupCodesRow | undefined;
	if (!row) return undefined;

	return {
		method: {
			method_id: row.method_id,
			user_id: row.user_id,
			method_type: row.method_type,
			is_primary: row.is_primary,
			is_verified: row.is_verified,
			created_at: row.created_at,
			label: row.label,
			updated_at: row.updated_at
		},
		codes: {
			backup_code_id: row.backup_code_id,
			method_id: row.method_id,
			code_json: row.code_json,
			created_at: row.created_at,
			user_id: row.user_id
		}
	};
}