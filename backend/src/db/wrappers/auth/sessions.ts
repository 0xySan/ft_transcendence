/**
 * Wrapper functions for interacting with the `sessions` table.
 * Provides retrieval, creation, and listing utilities.
*/

import { db, insertRow, getRow } from "../../index.js";

export interface session {
	user_id:	    	    string;
	session_token_hash:		string;
	created_at:		        number;
	expires_at:		        number;
	last_used_at:		    number;
	ip:                     string;
    user_agent:	            string;
    is_persistent:          boolean;
}

/**
 * Retrieve a session by its ID.
 * @param id - This id of the session 
 * @returns The session object if found, otherwise undefined
 */
export function getSessionById(id: number): session | undefined {
    return (getRow<session>("sessions", "session_id", id));
}

/** Retrieve a session by its token hash.
 * @param token_hash - The token hash of the session
 * @returns The session object if found, otherwise undefined
 */
export function getSessionByTokenHash(token_hash: string): session | undefined {
	return (getRow<session>("sessions", "session_token_hash", token_hash));
}

/**
 * List all sessions linked to a specific user ID.
 * @param user_id - The user ID to filter sessions
 * @returns An array of sessions objects, or an empty array if none found
 */
export function getSessionsByUserId(user_id: string): session[] {
    const stmt = db.prepare("SELECT * FROM sessions WHERE user_id = ?");
    return (stmt.all(user_id) as session[]);
}

/**
 * List all active (not expired) sessions linked to a specific user ID.
 * @param user_id - The user ID to filter sessions
 * @returns An array of active sessions objects, or an empty array if none found
 */
export function getActiveSessionsByUserId(user_id: string): session[] {
	try {
		const currentTime = Math.floor(Date.now() / 1000);
		const stmt = db.prepare(`SELECT * FROM sessions WHERE user_id = ? AND expires_at > ?`);
		const rows = stmt.all(user_id, currentTime);
		return rows as session[];
	} catch (error) {
		return [];
	}
}

/**
 * Retrieve all active (not expired) sessions of a specific IP address.
 * @param ip - The IP address to filter sessions
 * @returns An array of active sessions objects, or an empty array if none found
 */
export function getActiveSessionsByIp(ip: string): session[] {
	try {
		const currentTime = Math.floor(Date.now() / 1000);
		const stmt = db.prepare(`SELECT * FROM sessions WHERE ip = ? AND expires_at > ?`);
		const rows = stmt.all(ip, currentTime);
		return rows as session[];
	} catch (error) {
		return [];
	}
}

/**
 * Create a new session if it doesn't exist.
 * Default values will be applied for missing fields.
 * Uses the generic insertRow wrapper to insert and fetch the session.
 * 
 * @param options - Partial session object with session user_id, token_hash, created_at, expires_at, last_used_at, ip, user_agent, is_persistent
 * @returns The newly created or existing session object, or undefined if insertion failed
 */
export function createSession(options: Partial<session>): session | undefined {
    if (typeof options.expires_at !== 'number' || typeof options.last_used_at !== 'number') { return (undefined); }
    const   user_id = options.user_id;
    const   session_token_hash = options.session_token_hash;
    const   created_at = Math.floor(Date.now() / 1000);
    const   expires_at = options.expires_at;
    const   last_used_at = options.last_used_at;
    const   ip = options.ip;
    const   user_agent = options.user_agent;
    const   is_persistent = (options.is_persistent ?? 0);

    return (insertRow<session>("sessions", {
        user_id: user_id,
		session_token_hash: session_token_hash,
		created_at: created_at,
		expires_at: expires_at,
		last_used_at: last_used_at,
		ip: ip,
        user_agent: user_agent,
        is_persistent: is_persistent ? 1 : 0
    }));
}

/**
 * Update session.
 * Only updates the provided fields.
 * 
 * @param session_id - The provider ID
 * @param options - Partial information to update
 * @returns true if updated, false otherwise
 */
export function updateSession(session_id: number, options: Partial<session>): boolean {
    const keys = Object.keys(options).filter(
        key => options[key as keyof session] !== undefined && options[key as keyof session] !== null
    );

    if (keys.length === 0) return false;

    const setClause = keys.map(key => `${key} = @${key}`).join(", ");

    const params: Record<string, unknown> = { session_id };
    for (const key of keys) {
        if (key === "is_persistent") {
            params[key] = options.is_persistent ? 1 : 0;
        } else {
            params[key] = options[key as keyof session];
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
