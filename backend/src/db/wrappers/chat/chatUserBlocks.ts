import { db } from "../../index.js";

export interface ChatUserBlock {
	blocker_id: string;
	blocked_id: string;
	created_at: string;
}

export function blockUser(blockerId: string, blockedId: string): boolean {
	const stmt = db.prepare(
		`INSERT OR IGNORE INTO chat_user_blocks (blocker_id, blocked_id) VALUES (?, ?)`
	);
	const info = stmt.run(blockerId, blockedId);
	return info.changes > 0;
}

export function unblockUser(blockerId: string, blockedId: string): boolean {
	const stmt = db.prepare(
		`DELETE FROM chat_user_blocks WHERE blocker_id = ? AND blocked_id = ?`
	);
	const info = stmt.run(blockerId, blockedId);
	return info.changes > 0;
}

export function isUserBlocked(blockerId: string, blockedId: string): boolean {
	const stmt = db.prepare(
		`SELECT 1 FROM chat_user_blocks WHERE blocker_id = ? AND blocked_id = ?`
	);
	return Boolean(stmt.get(blockerId, blockedId));
}

export function isBlockedBy(userId: string, potentialBlockerId: string): boolean {
	const row = db.prepare(
		`SELECT 1 FROM chat_user_blocks WHERE blocker_id = ? AND blocked_id = ?`
	).get(potentialBlockerId, userId);
	return !!row;
}

export function listBlockedUsers(blockerId: string): ChatUserBlock[] {
	const stmt = db.prepare(
		`SELECT * FROM chat_user_blocks WHERE blocker_id = ? ORDER BY created_at DESC`
	);
	return stmt.all(blockerId) as ChatUserBlock[];
}
