/**
 * Wrapper functions for interacting with the `apiToken` table.
 * Provides retrieval, creation, and listing utilities.
*/

import { db, insertRow, getRow } from "../../index.js";

export interface apiToken {
    token_id:       number;
    app_id:         number;
    token_hash:     string;
    scopes:         string;
    issued_at:      number;
    expires_at:     number;
    last_used_at:   number;
    revoked:        boolean;
}

/**
 * Retrieve a apiToken by its ID.
 * @param id - The primary key of the apiToken
 * @returns The apiToken object if found, otherwise undefined
 */
export function getApiTokenById(id: number): apiToken | undefined {
    return (getRow<apiToken>("api_tokens", "token_id", id));
}

/**
 * Retrieve an apiToken by its token_hash.
 * @param token_hash - The hash of the token
 * @returns The apiToken object if found, otherwise undefined
 */
export function getTokenApiByHash(token_hash: string): apiToken | undefined {
    const stmt = db.prepare("SELECT * FROM api_tokens WHERE token_hash = ?");
    const token = stmt.get(token_hash) as apiToken | undefined;
    return token;
}

/**
 * Check if an apiToken is valid:
 * - Exists
 * - Not revoked
 * - Not expired (expires_at timestamp > current time)
 * 
 * @param token_hash - The hash of the token to validate
 * @returns true if valid, false otherwise
 */
export function checkApiTokenValidity(token_hash: string): boolean {
    const token = getTokenApiByHash(token_hash);
    if (!token) return false;

    const now = Math.floor(Date.now() / 1000);
    if (token.revoked) return false;
    if (token.expires_at && token.expires_at < now) return false;

    return true;
}

/**
 * Create a new apiToken if it doesn't exist.
 * Default values will be applied for missing fields.
 * Uses the generic insertRow wrapper to insert and fetch the apiToken.
 * 
 * @param options - Partial apiToken object with app_id, token_hash, scopes, issued_at, expired_at, last_used_at, revoked
 * @returns The newly created or existing apiToken object, or undefined if insertion failed
 */
export function createApiToken(options: Partial<apiToken>): apiToken | undefined {
    const   app_id = (options.app_id);
    const   token_hash = (options.token_hash);
    const   scopes = (options.scopes);
    const   issued_at = (options.issued_at);
    const   expires_at = (options.expires_at);
    const   last_used_at = (options.last_used_at);
    const   revoked = (options.revoked ?? 0);

    return (insertRow<apiToken>("api_tokens", {
        app_id: app_id,
        token_hash: token_hash,
        scopes: scopes,
        issued_at: issued_at,
        expires_at: expires_at,
        last_used_at: last_used_at,
        revoked: (revoked ? 1 : 0)
    }));
}

/**
 * Update apiToken.
 * Only updates the provided fields.
 * 
 * @param app_id - The provider ID
 * @param options - Partial information to update
 * @returns true if updated, false otherwise
 */
export function updateApiToken(token_id: number, options: Partial<apiToken>): boolean {
    const keys = Object.keys(options).filter(
        key => options[key as keyof apiToken] !== undefined && options[key as keyof apiToken] !== null
    );

    if (keys.length === 0) return false;

    const setClause = keys.map(key => `${key} = @${key}`).join(", ");

    const params: Record<string, unknown> = { token_id };
    for (const key of keys) {
        if (key === "revoked") {
            params[key] = options.revoked ? 1 : 0;
        } else {
            params[key] = options[key as keyof apiToken];
        }
    }

    const stmt = db.prepare(`
        UPDATE api_tokens
        SET ${setClause}
        WHERE token_id = @token_id
    `);

    const result = stmt.run(params);

    return (result.changes > 0);
}