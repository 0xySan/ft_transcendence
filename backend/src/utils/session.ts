/**
 * @file session.ts
 * @description Utility functions for managing user sessions in the database.
 */

import { session, createSession, getSessionByTokenHash } from "../db/wrappers/auth/sessions.js";
import * as crypto from "./crypto.js";

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

/**
 * Creates a new user session and stores it in the database.
 * @param userId The ID of the user for whom the session is being created
 * @param opts Optional parameters for session creation
 * @returns An object containing the session and the raw token, or undefined on failure
 */
export function createNewSession(userId: string, opts?: {
	ip?: string;
	userAgent?: string;
	ttlMs?: number;
	isPersistent?: boolean;
	stage?: 'partial' | 'active' | 'expired';
}): { session: session; token: string } | undefined {
	const ttlMs = (opts && opts.ttlMs) || DEFAULT_TTL_MS;

	// Generate session token
	const token = crypto.generateRandomToken(128);
	const tokenHash = crypto.encryptSecret(token);

	const expiresAt = new Date(Date.now() + ttlMs);

	// Create session in DB
	const newSession = createSession({
		user_id: userId,
		session_token_hash: tokenHash.toString('hex'), // Store only the hash
		expires_at: Math.floor(expiresAt.getTime() / 1000),
		stage: opts?.stage || 'active',
		ip: opts?.ip || undefined,
		user_agent: opts?.userAgent || undefined,
		last_used_at: Math.floor(Date.now() / 1000),
		is_persistent: opts?.isPersistent || false,
	});

	if (!newSession) return undefined;

	// Return session + token to set in cookie
	return { session: newSession, token };
}


export function checkTokenValidity(token: string): boolean {
	const tokenHash = crypto.encryptSecret(token).toString('hex');
	const session = getSessionByTokenHash(tokenHash);
	if (!session) {
		return false;
	}
	const currentTime = Math.floor(Date.now() / 1000);
	return session.expires_at > currentTime;
}
