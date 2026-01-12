import { updateSession } from "../db/wrappers/auth/sessions.js";

// filepath: /home/rey/Desktop/ft_transcendence/backend/src/middleware/utils.ts

/**
 * Update the last_request_at timestamp for a session identified by a raw token.
 * Returns true if the session was found and updated, false otherwise.
 */
export function touchSessionLastRequest(session_id: number): boolean {
    const currentTime = Math.floor(Date.now() / 1000);
    const result = updateSession(session_id, { last_request_at: currentTime });

    return result;
}