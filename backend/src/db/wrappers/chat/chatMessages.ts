import { db, insertRow } from "../../index.js";

export type MessageType = "text" | "invite" | "system";
export type InviteState = "pending" | "accepted" | "declined" | "cancelled" | null;

export interface ChatMessage {
	message_id: number;
	conversation_id: number;
	sender_id: string;
	content: string;
	message_type: MessageType;
	invite_state: InviteState;
	created_at: string;
	edited_at: string | null;
	deleted: 0 | 1;
}

export function addMessage(
	conversationId: number,
	senderId: string,
	content: string,
	messageType: MessageType = "text",
	inviteState: InviteState = null
): ChatMessage | undefined {
	return insertRow<ChatMessage>("chat_messages", {
		conversation_id: conversationId,
		sender_id: senderId,
		content,
		message_type: messageType,
		invite_state: inviteState,
	});
}

export function listMessages(
	conversationId: number,
	options?: { limit?: number; offset?: number; ascending?: boolean }
): ChatMessage[] {
	const limit = options?.limit ?? 50;
	const offset = options?.offset ?? 0;
	const ascending = options?.ascending ?? false;
	// Whitelist order direction to prevent any potential SQL injection
	const sqlAscending =
		`SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?`;
	const sqlDescending =
		`SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`;
	const stmt = db.prepare(ascending === true ? sqlAscending : sqlDescending);
	return stmt.all(conversationId, limit, offset) as ChatMessage[];
}

export function updateInviteState(messageId: number, inviteState: Exclude<InviteState, null>): boolean {
	const stmt = db.prepare(
		`UPDATE chat_messages SET invite_state = ? WHERE message_id = ?`
	);
	const info = stmt.run(inviteState, messageId);
	return info.changes > 0;
}

export function markMessageDeleted(messageId: number): boolean {
	const stmt = db.prepare(
		`UPDATE chat_messages SET deleted = 1 WHERE message_id = ?`
	);
	const info = stmt.run(messageId);
	return info.changes > 0;
}

export function editMessage(messageId: number, content: string): boolean {
	const stmt = db.prepare(
		`UPDATE chat_messages SET content = ?, edited_at = CURRENT_TIMESTAMP WHERE message_id = ?`
	);
	const info = stmt.run(content, messageId);
	return info.changes > 0;
}
