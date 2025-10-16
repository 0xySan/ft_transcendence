/**
 * Wrapper for OAuth token database operations.
 * Provides functions to create, retrieve, and manage OAuth tokens.
 */

import { db, insertRow, getRow } from "../../index.js";

export interface OauthToken {
	oauth_token_id:		number;
	oauth_account_id:	number;
	access_token_hash:	string;
	refresh_token_hash:	string;
	scopes:				string;
	token_type:			string;
	issued_at:			number;
	expires_at:			number;
	revoked:			boolean;
}

/**
 * Retrieve an OAuth token by its ID.
 * @param id - The ID of the OAuth token
 * @returns The OauthToken object if found, otherwise undefined
 */
export function getOauthTokenById(id: number): OauthToken | undefined {
	return (getRow<OauthToken>("oauth_tokens", "oauth_token_id", id));
}

/**
 * Retrieve all OAuth tokens for a specific account ID.
 * @param account_id - The ID of the OAuth account
 * @returns An array of OauthToken objects
 */
export function getOauthTokenByAccountId(account_id: number): OauthToken[] {
	const stmt = db.prepare("SELECT * FROM oauth_tokens WHERE oauth_account_id = ?");
	return stmt.all(account_id) as OauthToken[];
}

/**
 * Retrieve an OAuth token by its access token hash.
 * @param access_token_hash - The hash of the access token
 * @returns The OauthToken object if found, otherwise undefined
 */
export function getOauthTokenByAccessTokenHash(access_token_hash: string): OauthToken | undefined {
	return (getRow<OauthToken>("oauth_tokens", "access_token_hash", access_token_hash));
}

/**
 * Check if a token is valid (not expired and not revoked).
 * @param oauth_token_id - The ID of the OAuth token
 * @returns True if the token is valid, otherwise false
 */
export function isTokenValid(oauth_token_id: number): boolean {
	const token = getOauthTokenById(oauth_token_id);
	if (!token) return false;
	const currentTime = Math.floor(Date.now() / 1000);
	return !token.revoked && token.expires_at > currentTime;
}

/**
 * Create a new OauthToken if it doesn't exist.
 * Default values will be applied for missing fields.
 * Uses the generic insertRow wrapper to insert and fetch the OauthToken.
 * ! if no expiration is provided, it defaults to 1 hour from issued_at
 * 
 * @param options - Partial OauthToken object with name, url, client_id, secret, enabled and date
 * @returns The newly created or existing OauthToken object, or undefined if insertion failed
 */
export function createOauthToken(options: Partial<OauthToken>): OauthToken | undefined {
	const	oauth_account_id = (null)
	const	access_token_hash = (options.access_token_hash)
	const	refresh_token_hash = (options.refresh_token_hash || null)
	const	scopes = (options.scopes || null)
	const	token_type = (options.token_type || "Bearer")
	const	issued_at = (options.issued_at || Math.floor(Date.now() / 1000))
	const	expires_at = (options.expires_at || (issued_at + 3600)) // Default to 1 hour expiry
	const	revoked = (options.revoked ?? false)

	return (insertRow<OauthToken>("oauth_tokens", {
		oauth_account_id: oauth_account_id,
		access_token_hash: access_token_hash,
		refresh_token_hash: refresh_token_hash,
		scopes: scopes,
		token_type: token_type,
		issued_at: issued_at,
		expires_at: expires_at,
		revoked: revoked ? 1 : 0
	}));
}

/**
 * Update OauthToken.
 * Only updates the provided fields.
 * 
 * @param oauth_token_id - The provider ID
 * @param options - Partial information to update
 * @returns true if updated, false otherwise
 */
export function updateOauthToken(oauth_token_id: number, options: Partial<OauthToken>): boolean {
	const keys = Object.keys(options).filter(
		key => options[key as keyof OauthToken] !== undefined && options[key as keyof OauthToken] !== null
	);

	if (keys.length === 0) return false;

	const setClause = keys.map(key => `${key} = @${key}`).join(", ");

	const params: Record<string, unknown> = { oauth_token_id };
	for (const key of keys) {
		if (key === "revoked") {
			params[key] = options.revoked ? 1 : 0;
		} else {
			params[key] = options[key as keyof OauthToken];
		}
	}

	const stmt = db.prepare(`
		UPDATE oauth_tokens
		SET ${setClause}
		WHERE oauth_token_id = @oauth_token_id
	`);

	const result = stmt.run(params);

	return (result.changes > 0);
}

/**
 * List all OauthTokens for a specific account ID.
 * @param account_id - The ID of the OAuth account
 * @returns Array of OauthToken objects
 */
export function listOauthTokensByAccountId(account_id: number): OauthToken[] {
	const stmt = db.prepare("SELECT * FROM oauth_tokens WHERE oauth_account_id = ?");
	return stmt.all(account_id) as OauthToken[];
}
