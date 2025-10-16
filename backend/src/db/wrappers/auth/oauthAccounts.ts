/**
 * Wrapper functions for interacting with the `oauthAccounts` table.
 * Provides retrieval, creation, and listing utilities.
*/

import { db, insertRow, getRow } from "../../index.js";

export interface oauthAccount {
    user_id:            number;
    provider_name:      string;
    provider_user_id:   string;
    profile_json:       string;
    id_token_hash:      string;
    linked_at:          number;
    revoked_at:         number;
}

/**
 * Retrieve a oauthAccount by its ID.
 * @param id - The primary key of the oauthAccount
 * @returns The oauthAccount object if found, otherwise undefined
 */
export function getOauthAccountById(id: number): oauthAccount | undefined {
	return (getRow<oauthAccount>("oauth_accounts", "oauth_account_id", id));
}

/**
 * List all oauthAccounts linked to a specific user ID.
 * @param user_id - The user ID to filter oauthAccount
 * @returns An array of oauthAccounts objects, or an empty array if none found
 */
export function getOauthAccountsByUserId(user_id: number): oauthAccount[] {
    const stmt = db.prepare("SELECT * FROM oauth_accounts WHERE user_id = ?");
	return (stmt.all(user_id) as oauthAccount[]);
}

/** 
 * Retrieve a oauthAccount by provider name and provider user ID.
 * @param provider_name - The OAuth provider name (e.g., 'google', 'facebook')
 * @param provider_user_id - The user ID assigned by the OAuth provider
 * @returns The oauthAccount object if found, otherwise undefined
 */
export function getOauthAccountByProviderAndUserId(provider_name: string, provider_user_id: string): oauthAccount | undefined {
	try {
		const stmt = db.prepare(`SELECT * FROM oauth_accounts WHERE provider_name = ? AND provider_user_id = ?`);
		const row = stmt.get(provider_name, provider_user_id);
		return row ? (row as oauthAccount) : undefined;
	} catch (error) {
		return undefined;
	}
}

/**
 * Create a new oauthAccount if it doesn't exist.
 * Default values will be applied for missing fields.
 * Uses the generic insertRow wrapper to insert and fetch the oauthAccount.
 * 
 * @param options - Partial oauthAccount object with user_id, provider_name, provider_user_id, profile_json, if_token_hash, linked_at, revoked_at
 * @returns The newly created or existing oauthAccount object, or undefined if insertion failed
 */
export function createOauthAccount(options: Partial<oauthAccount>): oauthAccount | undefined {
    const   user_id = options.user_id;
    const   provider_name = (options.provider_name || "Unknow");
    const   provider_user_id = options.provider_user_id;
    const   profile_json = options.profile_json;
    const   id_token_hash = options.id_token_hash;
    const   linked_at = options.linked_at;
    const   revoked_at = options.revoked_at;

    console.log("DEBUG: provider_name = " + provider_name);

	return (insertRow<oauthAccount>("oauth_accounts", {
        user_id: user_id,
        provider_name: provider_name,
        provider_user_id: provider_user_id,
        profile_json: profile_json,
        id_token_hash: id_token_hash,
        linked_at: linked_at,
        revoked_at: revoked_at
	}));
}

/**
 * Update oauthAccount.
 * Only updates the provided fields.
 * 
 * @param provider_id - The provider ID
 * @param options - Partial information to update
 * @returns true if updated, false otherwise
 */
export function updateOauthAccount(oauth_account_id: number, options: Partial<oauthAccount>): boolean {
    const keys = Object.keys(options).filter(
        key => options[key as keyof oauthAccount] !== undefined && options[key as keyof oauthAccount] !== null
    );

    if (keys.length === 0) return false;

    const setClause = keys.map(key => `${key} = @${key}`).join(", ");

    const params: Record<string, unknown> = { oauth_account_id };
    for (const key of keys) {
        params[key] = options[key as keyof oauthAccount];
    }

    const stmt = db.prepare(`
        UPDATE oauth_accounts
        SET ${setClause}
        WHERE oauth_account_id = @oauth_account_id
    `);

    const result = stmt.run(params);

    return (result.changes > 0);
}
