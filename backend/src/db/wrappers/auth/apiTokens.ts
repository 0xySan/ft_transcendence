/**
 * Wrapper functions for interacting with the `apiTokens` table.
 * Provides retrieval, creation, and listing utilities.
*/

import { db, insertRow, getRow } from "../../index.js";

export interface apiTokens {
    app_id:         number;
    token_hash:     string;
    scopes:         string;
    issued_at:      number;
    expires_at:     number;
    last_used_at:   number;
    revoked:        boolean;
}

/**
 * Retrieve a apiTokens by its ID.
 * @param id - The primary key of the apiTokens
 * @returns The apiTokens object if found, otherwise undefined
 */
export function getApiTokensById(id: number): apiTokens | undefined {
    return (getRow<apiTokens>("api_tokens", "token_id", id));
}

/**
 * Create a new apiTokens if it doesn't exist.
 * Default values will be applied for missing fields.
 * Uses the generic insertRow wrapper to insert and fetch the apiTokens.
 * 
 * @param options - Partial apiTokens object with app_id, token_hash, scopes, issued_at, expired_at, last_used_at, revoked
 * @returns The newly created or existing apiTokens object, or undefined if insertion failed
 */
export function createApiTokens(options: Partial<apiTokens>): apiTokens | undefined {
    const   app_id = (options.app_id);
    const   token_hash = (options.token_hash);
    const   scopes = (options.scopes);
    const   issued_at = (options.issued_at);
    const   expires_at = (options.expires_at);
    const   last_used_at = (options.last_used_at);
    const   revoked = (options.revoked ?? 0);

    return (insertRow<apiTokens>("api_tokens", {
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
 * Update apiTokens.
 * Only updates the provided fields.
 * 
 * @param app_id - The provider ID
 * @param options - Partial information to update
 * @returns true if updated, false otherwise
 */
export function updateApiTokens(token_id: number, options: Partial<apiTokens>): boolean {
    const keys = Object.keys(options).filter(
        key => options[key as keyof apiTokens] !== undefined && options[key as keyof apiTokens] !== null
    );

    if (keys.length === 0) return false;

    const setClause = keys.map(key => `${key} = @${key}`).join(", ");

    const params: Record<string, unknown> = { token_id };
    for (const key of keys) {
        if (key === "revoked") {
            params[key] = options.revoked ? 1 : 0;
        } else {
            params[key] = options[key as keyof apiTokens];
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