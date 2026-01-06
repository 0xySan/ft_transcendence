import { FastifyInstance } from "fastify";
import { requirePartialAuth } from "../../middleware/auth.middleware.js";
import { getProfileByUserId } from "../../db/wrappers/main/users/userProfiles.js";
import {
  listConversationsForUser,
  type UserConversationSummary,
} from "../../db/wrappers/chat/chatConversations.js";
import {
	getConversationMember,
	listConversationMembers,
	addConversationMember,
	setConversationMemberStatus,
	type ChatConversationMember,
} from "../../db/wrappers/chat/chatConversationMembers.js";
import { addMessage, listMessages, updateInviteState, type ChatMessage } from "../../db/wrappers/chat/chatMessages.js";
import { listBlockedUsers, isBlockedBy, type ChatUserBlock } from "../../db/wrappers/chat/chatUserBlocks.js";
import { broadcastMessageToParticipants, broadcastTo } from "../../utils/chatEvent.js";

interface MemberPayload {
	userId: string;
	username: string | null;
	displayName: string | null;
	profilePicture: string | null;
}

function mapMember(userId: string): MemberPayload {
	const profile = getProfileByUserId(userId);
	return {
		userId,
		username: profile?.username ?? null,
		displayName: profile?.display_name ?? null,
		profilePicture: profile?.profile_picture ?? null,
	};
}

export async function chatConversationRoutes(fastify: FastifyInstance)
{
	fastify.get(
		"/conversations",
		{ preHandler: requirePartialAuth },
		async (request, reply) => {
			const session = (request as any).session;
			const userId = session?.user_id;
			if (!userId) return reply.status(401).send({ message: "Unauthorized" });

			const conversations: UserConversationSummary[] = listConversationsForUser(userId);

			const payload = conversations.map((conv: UserConversationSummary) => {
				const members = listConversationMembers(conv.conversation_id).map((m: ChatConversationMember) => mapMember(m.user_id));
				return {
					id: conv.conversation_id,
					type: conv.conversation_type,
					title: conv.title,
					createdBy: conv.created_by,
					updatedAt: conv.updated_at,
					members,
					lastMessageAt: conv.last_message_at,
				};
			});

			const blocked = listBlockedUsers(userId).map((b: ChatUserBlock) => b.blocked_id);
			return reply.send({ conversations: payload, currentUserId: userId, blocked });
		}
	);

	fastify.get(
		"/conversations/:id",
		{ preHandler: requirePartialAuth },
		async (request, reply) => {
			const session = (request as any).session;
			const userId = session?.user_id;
			if (!userId) return reply.status(401).send({ message: "Unauthorized" });

			const conversationId = Number((request.params as any).id);
			if (!Number.isFinite(conversationId)) return reply.status(400).send({ message: "Invalid conversation id" });

			const member = getConversationMember(conversationId, userId);
			if (!member) return reply.status(403).send({ message: "Not a member of this conversation" });

			const conversations: UserConversationSummary[] = listConversationsForUser(userId);
			const conv = conversations.find((c: UserConversationSummary) => c.conversation_id === conversationId);
			if (!conv) return reply.status(404).send({ message: "Conversation not found" });

			const members = listConversationMembers(conv.conversation_id).map((m: ChatConversationMember) => mapMember(m.user_id));
			const payload = {
				id: conv.conversation_id,
				type: conv.conversation_type,
				title: conv.title,
				createdBy: conv.created_by,
				updatedAt: conv.updated_at,
				members,
				lastMessageAt: conv.last_message_at,
			};

			return reply.send({ conversation: payload, currentUserId: userId });
		}
	);

	fastify.get(
		"/conversations/:id/messages",
		{ preHandler: requirePartialAuth },
		async (request, reply) => {
			const session = (request as any).session;
			const userId = session?.user_id;
			if (!userId) return reply.status(401).send({ message: "Unauthorized" });

			const conversationId = Number((request.params as any).id);
			if (!Number.isFinite(conversationId)) return reply.status(400).send({ message: "Invalid conversation id" });

			const member = getConversationMember(conversationId, userId);
			if (!member) return reply.status(403).send({ message: "Not a member of this conversation" });

			const { limit, offset, ascending } = request.query as {
				limit?: string;
				offset?: string;
				ascending?: string;
			};

			const msgs: ChatMessage[] = listMessages(conversationId, {
				limit: limit ? Number(limit) : 100,
				offset: offset ? Number(offset) : 0,
				ascending: ascending === "true" || ascending === "1",
			});

			return reply.send({ messages: msgs });
		}
	);

	fastify.post(
		"/conversations/:id/messages",
		{ preHandler: requirePartialAuth },
		async (request, reply) => {
			const session = (request as any).session;
			const userId = session?.user_id;
			if (!userId) return reply.status(401).send({ message: "Unauthorized" });

			const conversationId = Number((request.params as any).id);
			if (!Number.isFinite(conversationId)) return reply.status(400).send({ message: "Invalid conversation id" });

			const member = getConversationMember(conversationId, userId);
			if (!member) return reply.status(403).send({ message: "Not a member of this conversation" });

			// Check if sender is blocked by any member (even those who left) and gather active recipients
			const allMembers = listConversationMembers(conversationId);
			for (const m of allMembers.filter(m => m.user_id !== userId)) {
				if (isBlockedBy(userId, m.user_id)) {
					return reply.status(403).send({ message: "You cannot send messages to this user" });
				}
			}

			const body = request.body as { content?: string; messageType?: string; inviteState?: string | null };
			const content = body?.content?.trim();
			if (!content) return reply.status(400).send({ message: "Content is required" });
			
			if (content.length > 4000) {
				return reply.status(400).send({ 
					message: "Message must be 4000 characters or less" 
				});
			}

			const messageType = (body.messageType || "text") as "text" | "invite" | "system";
			const inviteState = (body.inviteState ?? null) as "pending" | "accepted" | "declined" | "cancelled" | null;

			const message = addMessage(conversationId, userId, content, messageType, inviteState);
			if (!message) return reply.status(500).send({ message: "Failed to create message" });

			// Enrich message with sender profile so clients can add new conversations without reload
			const senderProfile = getProfileByUserId(userId);
			const messageWithSender = {
				...message,
				sender_username: senderProfile?.username ?? null,
				sender_display_name: senderProfile?.display_name ?? null,
				sender_profile_picture: senderProfile?.profile_picture ?? null,
			};

			// Reactivate participants who haven't blocked the sender
			const recipients: string[] = [];
			for (const m of allMembers) {
				if (m.user_id === userId) continue;
				
				// Don't reactivate users who have blocked the sender
				if (isBlockedBy(userId, m.user_id)) continue;
				
				const existing = getConversationMember(conversationId, m.user_id);
				if (!existing) {
					addConversationMember(conversationId, m.user_id, "member", "active");
					recipients.push(m.user_id);
				} else {
					if (existing.status !== "active") setConversationMemberStatus(conversationId, m.user_id, "active");
					recipients.push(m.user_id);
				}
			}

			try {
				broadcastMessageToParticipants(userId, recipients, {
					conversationId,
					message: messageWithSender,
				});
			} catch (error) {
				console.error('Failed to broadcast message:', error);
				return reply.status(500).send({ message: "Failed to broadcast message" });
			}

			return reply.status(201).send({ message });
		}
	);

	fastify.patch(
		"/messages/:id/invite",
		{ preHandler: requirePartialAuth },
		async (request, reply) => {
			const session = (request as any).session;
			const userId = session?.user_id;
			if (!userId) return reply.status(401).send({ message: "Unauthorized" });

			const messageId = Number((request.params as any).id);
			if (!Number.isFinite(messageId)) return reply.status(400).send({ message: "Invalid message id" });

			const body = request.body as { state?: string; conversationId?: number };
			const state = body?.state as "accepted" | "declined" | "cancelled" | undefined;
			if (!state) return reply.status(400).send({ message: "State is required" });

			const conversationId = Number(body?.conversationId);
			if (!Number.isFinite(conversationId)) return reply.status(400).send({ message: "conversationId is required" });

			const member = getConversationMember(conversationId, userId);
			if (!member) return reply.status(403).send({ message: "Not a member of this conversation" });

			const ok = updateInviteState(messageId, state);
			if (!ok) return reply.status(500).send({ message: "Failed to update invite state" });

			const members = listConversationMembers(conversationId)
				.filter(m => m.status === "active")
				.map(m => m.user_id);

			const payload = { conversationId, messageId, state };
			for (const memberId of members) broadcastTo(memberId, "inviteState", payload);

			return reply.send({ success: true });
		}
	);

	fastify.delete(
		"/conversations/:id",
		{ preHandler: requirePartialAuth },
		async (request, reply) => {
			const session = (request as any).session;
			const userId = session?.user_id;
			if (!userId) return reply.status(401).send({ message: "Unauthorized" });

			const conversationId = Number((request.params as any).id);
			if (!Number.isFinite(conversationId)) return reply.status(400).send({ message: "Invalid conversation id" });

			const member = getConversationMember(conversationId, userId);
			if (!member) return reply.status(403).send({ message: "Not a member of this conversation" });

			// Set user status to "left" to remove them from the conversation
			const ok = setConversationMemberStatus(conversationId, userId, "left");
			if (!ok) return reply.status(500).send({ message: "Failed to leave conversation" });

			return reply.send({ success: true });
		}
	);
}