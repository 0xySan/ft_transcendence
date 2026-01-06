import { db, insertRow } from "../../index.js";

export type MemberRole = "member" | "admin";
export type MemberStatus = "active" | "left" | "banned";

export interface ChatConversationMember {
	conversation_id: number;
	user_id: string;
	role: MemberRole;
	status: MemberStatus;
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
	role: MemberRole = "member",
	status: MemberStatus = "active"
): ChatConversationMember | undefined {
	const member = insertRow<ChatConversationMember>("chat_conversation_members", {
		conversation_id: conversationId,
		user_id: userId,
		role,
		status,
	});

	if (!member) {
		const existing = db.prepare(
			`SELECT * FROM chat_conversation_members WHERE conversation_id = ? AND user_id = ?`
		).get(conversationId, userId) as ChatConversationMember | undefined;
		return existing;
	}

	return member;
}

export function setConversationMemberStatus(
	conversationId: number,
	userId: string,
	status: MemberStatus
): boolean {
	const stmt = db.prepare(
		`UPDATE chat_conversation_members SET status = ? WHERE conversation_id = ? AND user_id = ?`
	);
	const info = stmt.run(status, conversationId, userId);
	return info.changes > 0;
}

export function setConversationMemberRole(
	conversationId: number,
	userId: string,
	role: MemberRole
): boolean {
	const stmt = db.prepare(
		`UPDATE chat_conversation_members SET role = ? WHERE conversation_id = ? AND user_id = ?`
	);
	const info = stmt.run(role, conversationId, userId);
	return info.changes > 0;
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
