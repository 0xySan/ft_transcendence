import { db, insertRow } from "../../index.js";

export interface ChatConversationMember {
	conversation_id: number;
	user_id: string;
	joined_at: string;
	last_read_message_id: number | null;
	last_read_at: string | null;
}

export function getConversationMember(
	conversationId: number,
	userId: string
): ChatConversationMember | undefined {
	const stmt = db.prepare(
		`SELECT * FROM chat_conversation_members WHERE conversation_id = ? AND user_id = ?`
	);
	return stmt.get(conversationId, userId) as ChatConversationMember | undefined;
}

export function addConversationMember(
	conversationId: number,
	userId: string,
): ChatConversationMember | undefined {
	const member = insertRow<ChatConversationMember>("chat_conversation_members", {
		conversation_id: conversationId,
		user_id: userId,
	});

	if (!member) {
		const existing = db.prepare(
			`SELECT * FROM chat_conversation_members WHERE conversation_id = ? AND user_id = ?`
		).get(conversationId, userId) as ChatConversationMember | undefined;
		return existing;
	}

	return member;
}

export function updateLastRead(
	conversationId: number,
	userId: string,
	lastReadMessageId: number | null
): boolean {
	const stmt = db.prepare(
		`UPDATE chat_conversation_members
		 SET last_read_message_id = ?, last_read_at = CURRENT_TIMESTAMP
		 WHERE conversation_id = ? AND user_id = ?`
	);
	const info = stmt.run(lastReadMessageId, conversationId, userId);
	return info.changes > 0;
}

export function listConversationMembers(conversationId: number): ChatConversationMember[] {
	const stmt = db.prepare(
		`SELECT * FROM chat_conversation_members WHERE conversation_id = ? ORDER BY joined_at`
	);
	return stmt.all(conversationId) as ChatConversationMember[];
}

export function removeConversationMember(
	conversationId: number,
	userId: string
): boolean {
	const stmt = db.prepare(
		`DELETE FROM chat_conversation_members WHERE conversation_id = ? AND user_id = ?`
	);
	const info = stmt.run(conversationId, userId);
	return info.changes > 0;
}
