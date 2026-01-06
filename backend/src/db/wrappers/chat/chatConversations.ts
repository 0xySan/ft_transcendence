import { db, getRow, insertRow } from "../../index.js";

export type ConversationType = "direct" | "group";

export interface ChatConversation {
	conversation_id: number;
	conversation_type: ConversationType;
	title: string | null;
	created_by: string | null;
	created_at: string;
	updated_at: string;
}

export interface ChatDirectConversation {
	conversation_id: number;
	user_a: string;
	user_b: string;
}

export interface UserConversationSummary extends ChatConversation {
	role: "member" | "admin";
	status: "active" | "left" | "banned";
	last_read_message_id: number | null;
	last_read_at: string | null;
	last_message_at: string | null;
}

export function getConversationById(id: number): ChatConversation | undefined {
	return getRow<ChatConversation>("chat_conversations", "conversation_id", id);
}

export function createConversation(
	conversationType: ConversationType,
	options?: { title?: string | null; createdBy?: string | null }
): ChatConversation | undefined {
	return insertRow<ChatConversation>("chat_conversations", {
		conversation_type: conversationType,
		title: options?.title ?? null,
		created_by: options?.createdBy ?? null,
	});
}

export function getDirectConversation(userA: string, userB: string): ChatConversation | undefined {
	const [a, b] = [userA, userB].sort();
	const stmt = db.prepare(
		`SELECT c.*
		 FROM chat_direct_conversations dc
		 JOIN chat_conversations c ON c.conversation_id = dc.conversation_id
		 WHERE dc.user_a = ? AND dc.user_b = ?`
	);
	return stmt.get(a, b) as ChatConversation | undefined;
}

export function ensureDirectConversation(
	userA: string,
	userB: string,
	createdBy?: string
): ChatConversation | undefined {
	const existing = getDirectConversation(userA, userB);
	if (existing) return existing;

	const [a, b] = [userA, userB].sort();

	// Wrap in transaction to prevent orphaned conversation records
	const createTransaction = db.transaction(() => {
		const conversation = createConversation("direct", { createdBy });
		if (!conversation) throw new Error("Failed to create conversation");

		const info = db.prepare(
			`INSERT OR IGNORE INTO chat_direct_conversations (conversation_id, user_a, user_b) VALUES (?, ?, ?)`
		).run(conversation.conversation_id, a, b);
		
		if (info.changes === 0) {
			// Another transaction created it concurrently
			const concurrentStmt = db.prepare(
				`SELECT c.*
				 FROM chat_direct_conversations dc
				 JOIN chat_conversations c ON c.conversation_id = dc.conversation_id
				 WHERE dc.user_a = ? AND dc.user_b = ?`
			);
			const concurrent = concurrentStmt.get(a, b) as ChatConversation | undefined;
			if (concurrent) {
				return concurrent;
			}
			throw new Error("Failed to resolve concurrently created direct conversation");
		}
		
		return conversation;
	});

	try {
		return createTransaction();
	} catch (err) {
		console.error("Failed to create direct conversation:", (err as Error).message);
		return getDirectConversation(userA, userB);
	}
}

export function listConversationsForUser(userId: string): UserConversationSummary[] {
	const stmt = db.prepare(`
		SELECT c.*, m.role, m.status, m.last_read_message_id, m.last_read_at,
		       (
		           SELECT MAX(created_at)
		           FROM chat_messages
		           WHERE conversation_id = c.conversation_id
		       ) AS last_message_at
		FROM chat_conversations c
		JOIN chat_conversation_members m ON m.conversation_id = c.conversation_id
		WHERE m.user_id = ? AND m.status = 'active'
		ORDER BY COALESCE(last_message_at, c.updated_at) DESC
	`);
	return stmt.all(userId) as UserConversationSummary[];
}
