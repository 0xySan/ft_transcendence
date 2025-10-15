/**
 * Wrapper functions for interacting with the `oauthAccounts` table.
 * Provides retrieval, creation, and listing utilities.
*/

import { link } from "fs";
import { db, insertRow, getRow } from "../../index.js";

export interface oauthAccounts {
    user_id:            number;
    provider_name:      string;
    provider_user_id:   string;
    profile_json:       string;
    id_token_hash:      string;
    linked_at:          number;
    revoked_at:         number;
}

/**
 * Retrieve a oauthAccounts by its ID.
 * @param id - The primary key of the oauthAccounts
 * @returns The oauthAccounts object if found, otherwise undefined
 */
export function getOauthAccountsById(id: number): oauthAccounts | undefined {
	return (getRow<oauthAccounts>("oauth_accounts", "oauth_account_id", id));
}

/**
 * Create a new oauthAccounts if it doesn't exist.
 * Default values will be applied for missing fields.
 * Uses the generic insertRow wrapper to insert and fetch the oauthAccounts.
 * 
 * @param options - Partial oauthAccounts object with user_id, provider_name, provider_user_id, profile_json, if_token_hash, linked_at, revoked_at
 * @returns The newly created or existing oauthAccounts object, or undefined if insertion failed
 */
export function createOauthAccounts(options: Partial<oauthAccounts>): oauthAccounts | undefined {
    const   user_id = options.user_id;
    const   provider_name = (options.provider_name ?? "Unknow");
    const   provider_user_id = options.provider_user_id;
    const   profile_json = options.profile_json;
    const   id_token_hash = options.id_token_hash;
    const   linked_at = options.linked_at;
    const   revoked_at = options.revoked_at;

	const	new_row = insertRow<oauthAccounts>("oauth_accounts", {
        user_id: user_id,
        provider_name: provider_name,
        provider_user_id: provider_user_id,
        profile_json: profile_json,
        id_token_hash: id_token_hash,
        linked_at: linked_at,
        revoked_at: revoked_at
	});

	return (new_row);
}

/**
 * Update oauthAccounts.
 * Only updates the provided fields.
 * 
 * @param provider_id - The provider ID
 * @param options - Partial information to update
 * @returns true if updated, false otherwise
 */
export function updateOauthAccounts(oauth_account_id: number, options: Partial<oauthAccounts>): boolean {
    const keys = Object.keys(options).filter(
        key => options[key as keyof oauthAccounts] !== undefined && options[key as keyof oauthAccounts] !== null
    );

    if (keys.length === 0) return false;

    const setClause = keys.map(key => `${key} = @${key}`).join(", ");

    const params: Record<string, unknown> = { oauth_account_id };
    for (const key of keys) {
        params[key] = options[key as keyof oauthAccounts];
    }

    const stmt = db.prepare(`
        UPDATE oauth_accounts
        SET ${setClause}
        WHERE oauth_account_id = @oauth_account_id
    `);

    const result = stmt.run(params);

    return (result.changes > 0);
}