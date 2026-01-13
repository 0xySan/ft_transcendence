export type FriendStatus = "pending" | "accepted" | "rejected";

export interface Friend {
	sender_user_id: string;
	target_user_id: string;
	status: FriendStatus;
	created_at: string;
}

import { db, insertRow } from "../../../index.js";

export function sendFriendRequest(
	senderUserId: string,
	targetUserId: string
): Friend | undefined {
	return insertRow<Friend>("friends", {
		sender_user_id: senderUserId,
		target_user_id: targetUserId,
		status: "pending"
	});
}

export function getFriendRequest(
	senderUserId: string,
	targetUserId: string
): Friend | undefined {
	try {
		return db
			.prepare(
				`SELECT * FROM friends 
				 WHERE sender_user_id = ? AND target_user_id = ?`
			)
			.get(senderUserId, targetUserId) as Friend | undefined;
	} catch (err) {
		console.error("Failed to get friend request:", (err as Error).message);
		return undefined;
	}
}

export function acceptFriendRequest(
	senderUserId: string,
	targetUserId: string
): boolean {
	try {
		const result = db
			.prepare(
				`UPDATE friends
				 SET status = 'accepted'
				 WHERE sender_user_id = ?
				   AND target_user_id = ?
				   AND status = 'pending'`
			)
			.run(senderUserId, targetUserId);

		return result.changes === 1;
	} catch (err) {
		console.error("Failed to accept friend request:", (err as Error).message);
		return false;
	}
}

export function rejectFriendRequest(
	senderUserId: string,
	targetUserId: string
): boolean {
	try {
		const result = db
			.prepare(
				`UPDATE friends
				 SET status = 'rejected'
				 WHERE sender_user_id = ?
				   AND target_user_id = ?
				   AND status = 'pending'`
			)
			.run(senderUserId, targetUserId);

		return result.changes === 1;
	} catch (err) {
		console.error("Failed to reject friend request:", (err as Error).message);
		return false;
	}
}

export function getFriends(userId: string): Friend[] {
	try {
		return db
			.prepare(
				`SELECT * FROM friends
				 WHERE status = 'accepted'
				   AND (sender_user_id = ? OR target_user_id = ?)`
			)
			.all(userId, userId) as Friend[];
	} catch (err) {
		console.error("Failed to get friends:", (err as Error).message);
		return [];
	}
}

export function getPendingFriendRequests(
	userId: string
): Friend[] {
	try {
		return db
			.prepare(
				`SELECT * FROM friends
				 WHERE target_user_id = ?
				   AND status = 'pending'`
			)
			.all(userId) as Friend[];
	} catch (err) {
		console.error("Failed to get pending requests:", (err as Error).message);
		return [];
	}
}

export function getSentFriendRequests(
	userId: string
): Friend[] {
	try {
		return db
			.prepare(
				`SELECT * FROM friends
				 WHERE sender_user_id = ?
				   AND status = 'pending'`
			)
			.all(userId) as Friend[];
	} catch (err) {
		console.error("Failed to get sent requests:", (err as Error).message);
		return [];
	}
}

export function deleteFriendRelation(
	userA: string,
	userB: string
): boolean {
	try {
		const result = db
			.prepare(
				`DELETE FROM friends
				 WHERE (sender_user_id = ? AND target_user_id = ?)
				    OR (sender_user_id = ? AND target_user_id = ?)`
			)
			.run(userA, userB, userB, userA);

		return result.changes > 0;
	} catch (err) {
		console.error("Failed to delete friend relation:", (err as Error).message);
		return false;
	}
}
