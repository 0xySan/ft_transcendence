/**
 * Wrapper functions for interacting with the `sessions` table.
 * Provides retrieval, creation, and listing utilities.
*/

import { numericToAlpha2 } from "i18n-iso-countries";
import { db, insertRow, getRow } from "../../index.js";

export interface sessions {
	user_id:	    	    number;
	session_token_hash:		string;
	created_at:		        number;
	expires_at:		        number;
	last_used_at:		    number;
	ip:                     string;
    user_agent:	            string;
    is_persistent:          boolean;
}

/**
 * Retrieve a sessions by its ID.
 * @param id - This id of the session 
 * @returns The session object if found, otherwise undefined
 */
export function getSessionsById(id: number): sessions | undefined {
    return (getRow<sessions>("sessions", "session_id", id));
}

/**
 * Create a new session if it doesn't exist.
 * Default values will be applied for missing fields.
 * Uses the generic insertRow wrapper to insert and fetch the session.
 * 
 * @param options - Partial session object with session user_id, token_hash, created_at, expires_at, last_used_at, ip, user_agent, is_persistent
 * @returns The newly created or existing session object, or undefined if insertion failed
 */
export function createSession(options: Partial<sessions>): sessions | undefined {
    if (typeof options.expires_at !== 'number' || typeof options.last_used_at !== 'number') { return (undefined); }
    const   user_id = options.user_id;
    const   session_token_hash = options.session_token_hash;
    const   created_at = Math.floor(Date.now() / 1000);
    const   expires_at = options.expires_at;
    const   last_used_at = options.last_used_at;
    const   ip = options.ip;
    const   user_agent = options.user_agent;
    const   is_persistent = (options.is_persistent ?? 0);

    const	new_row = insertRow<sessions>("sessions", {
        user_id: user_id,
		session_token_hash: session_token_hash,
		created_at: created_at,
		expires_at: expires_at,
		last_used_at: last_used_at,
		ip: ip,
        user_agent: user_agent,
        is_persistent: is_persistent ? 1 : 0
    });
    return (new_row);
}

/**
 * Update session.
 * Only updates the provided fields.
 * 
 * @param session_id - The provider ID
 * @param options - Partial information to update
 * @returns true if updated, false otherwise
 */
export function updateSession(session_id: number, options: Partial<sessions>): boolean {
    const keys = Object.keys(options).filter(
        key => options[key as keyof sessions] !== undefined && options[key as keyof sessions] !== null
    );

    if (keys.length === 0) return false;

    const setClause = keys.map(key => `${key} = @${key}`).join(", ");

    const params: Record<string, unknown> = { session_id };
    for (const key of keys) {
        if (key === "is_persistent") {
            params[key] = options.is_persistent ? 1 : 0;
        } else {
            params[key] = options[key as keyof sessions];
        }
    }

    const stmt = db.prepare(`
        UPDATE sessions
        SET ${setClause}
        WHERE session_id = @session_id
    `);

    const result = stmt.run(params);

    return (result.changes > 0);
}