import { FastifyInstance } from "fastify";
import { requirePartialAuth } from "../../middleware/auth.middleware.js";
import { getProfileByUserId } from "../../db/wrappers/main/users/userProfiles.js";
import {
  ensureDirectConversation,
  listConversationsForUser,
  type UserConversationSummary,
} from "../../db/wrappers/chat/chatConversations.js";
import {
  addConversationMember,
  getConversationMember,
  listConversationMembers,
  type ChatConversationMember,
} from "../../db/wrappers/chat/chatConversationMembers.js";
import { addMessage, listMessages, updateInviteState, type ChatMessage } from "../../db/wrappers/chat/chatMessages.js";
import { blockUser, unblockUser, listBlockedUsers, isBlockedBy, type ChatUserBlock } from "../../db/wrappers/chat/chatUserBlocks.js";
import { addClient, broadcastMessageToParticipants, broadcastTo } from "../../utils/chatEvent.js";

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

export async function chatRoutes(fastify: FastifyInstance) {
	// Server-Sent Events: per-user stream
	fastify.get(
		"/api/chat/stream",
		{ preHandler: requirePartialAuth },
		async (request, reply) => {
			const session = (request as any).session;
			const userId = session?.user_id;
			if (!userId) return reply.status(401).send({ message: "Unauthorized" });
			addClient(userId, reply);
			return reply; // keep the connection open
		}
	);

	fastify.get(
		"/api/chat/conversations",
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
		"/api/chat/conversations/:id/messages",
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
		"/api/chat/conversations/:id/messages",
		{ preHandler: requirePartialAuth },
		async (request, reply) => {
			const session = (request as any).session;
			const userId = session?.user_id;
			if (!userId) return reply.status(401).send({ message: "Unauthorized" });

			const conversationId = Number((request.params as any).id);
			if (!Number.isFinite(conversationId)) return reply.status(400).send({ message: "Invalid conversation id" });

			const member = getConversationMember(conversationId, userId);
			if (!member) return reply.status(403).send({ message: "Not a member of this conversation" });

			// Check if sender is blocked by any other member
			const members = listConversationMembers(conversationId)
				.filter(m => m.status === "active" && m.user_id !== userId);
			
			for (const m of members) {
				if (isBlockedBy(userId, m.user_id)) {
					return reply.status(403).send({ message: "You cannot send messages to this user" });
				}
			}

			const body = request.body as { content?: string; messageType?: string; inviteState?: string | null };
			const content = body?.content?.trim();
			if (!content) return reply.status(400).send({ message: "Content is required" });

			const messageType = (body.messageType || "text") as "text" | "invite" | "system";
			const inviteState = (body.inviteState ?? null) as "pending" | "accepted" | "declined" | "cancelled" | null;

			const message = addMessage(conversationId, userId, content, messageType, inviteState);
			if (!message) return reply.status(500).send({ message: "Failed to create message" });

			// Broadcast to sender and all active members (except blocks are handled client-side)
			broadcastMessageToParticipants(userId, members.map(m => m.user_id), {
				conversationId,
				message
			});

			return reply.status(201).send({ message });
		}
	);

	fastify.patch(
		"/api/chat/messages/:id/invite",
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

	fastify.post(
		"/api/chat/direct",
		{ preHandler: requirePartialAuth },
		async (request, reply) => {
			const session = (request as any).session;
			const userId = session?.user_id;
			if (!userId) return reply.status(401).send({ message: "Unauthorized" });

			const body = request.body as { targetUserId?: string };
			const targetUserId = body?.targetUserId;
			if (!targetUserId || typeof targetUserId !== "string") {
				return reply.status(400).send({ message: "targetUserId is required" });
			}
			if (targetUserId === userId) return reply.status(400).send({ message: "Cannot create direct conversation with yourself" });

			const conversation = ensureDirectConversation(userId, targetUserId, userId);
			if (!conversation) return reply.status(500).send({ message: "Failed to create conversation" });

			addConversationMember(conversation.conversation_id, userId, "admin", "active");
			addConversationMember(conversation.conversation_id, targetUserId, "member", "active");

			return reply.status(201).send({ conversationId: conversation.conversation_id });
		}
	);

	fastify.get(
		"/api/chat/blocks",
		{ preHandler: requirePartialAuth },
		async (request, reply) => {
			const session = (request as any).session;
			const userId = session?.user_id;
			if (!userId) return reply.status(401).send({ message: "Unauthorized" });

			const blocked = listBlockedUsers(userId).map((b: ChatUserBlock) => b.blocked_id);
			return reply.send({ blocked });
		}
	);

	fastify.post(
		"/api/chat/blocks/:targetId",
		{ preHandler: requirePartialAuth },
		async (request, reply) => {
			const session = (request as any).session;
			const userId = session?.user_id;
			if (!userId) return reply.status(401).send({ message: "Unauthorized" });

			const targetId = (request.params as any).targetId as string;
			if (!targetId) return reply.status(400).send({ message: "targetId is required" });
			if (targetId === userId) return reply.status(400).send({ message: "Cannot block yourself" });

			const ok = blockUser(userId, targetId);
			return reply.send({ blocked: ok });
		}
	);

	fastify.delete(
		"/api/chat/blocks/:targetId",
		{ preHandler: requirePartialAuth },
		async (request, reply) => {
			const session = (request as any).session;
			const userId = session?.user_id;
			if (!userId) return reply.status(401).send({ message: "Unauthorized" });

			const targetId = (request.params as any).targetId as string;
			if (!targetId) return reply.status(400).send({ message: "targetId is required" });

			const ok = unblockUser(userId, targetId);
			return reply.send({ unblocked: ok });
		}
	);
}
