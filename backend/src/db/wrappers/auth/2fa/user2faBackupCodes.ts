/**
 * Wrapper functions for interacting with the `user2faBackupCodes` table.
 * Provides retrieval, creation, and listing utilities.
*/

import { db, insertRow, getRow } from "../../../index.js";

export interface user2faBackupCodes {
    method_id:  string;
    code_json:  string;
    created_at: number;
}

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
    const   created_at = (options.created_at);

    return (insertRow<user2faBackupCodes>("user_2fa_backup_codes", {
        method_id: method_id,
        code_json: code_json,
        created_at: created_at
    }));
}

/**
 * Update user2faBackupCodes.
 * Only updates the provided fields.
 * 
 * @param app_id - The provider ID
 * @param options - Partial information to update
 * @returns true if updated, false otherwise
 */
export function updateApiTokens(backup_code_id: number, options: Partial<user2faBackupCodes>): boolean {
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
