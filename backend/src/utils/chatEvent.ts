import { FastifyReply } from "fastify";
import { getConversationMember } from "../db/wrappers/chat/chatConversationMembers.js";
import { isBlockedBy } from "../db/wrappers/chat/chatUserBlocks.js";

export type Session = { userId: string; user_id: string; [key: string]: any };

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CONNECTIONS_PER_USER = 3;
const MAX_TOTAL_CONNECTIONS = 200;

type Client = { userId: string; reply: FastifyReply; heartbeat: NodeJS.Timeout; timeout: NodeJS.Timeout };
const clients = new Map<string, Set<Client>>();

function getTotalConnections(): number {
	let total = 0;
	for (const set of clients.values()) {
		total += set.size;
	}
	return total;
}

function safeWrite(reply: FastifyReply, chunk: string): boolean {
	try {
		return reply.raw.write(chunk);
	} catch (err) {
		console.error('Write failed:', err);
		return false;
	}
}

export function addClient(userId: string, reply: FastifyReply, session: Session): Client {
	// Verify the request is from the actual user
	if (session.userId !== userId && session.user_id !== userId) {
		throw new Error('Unauthorized');
	}

	const set = clients.get(userId) || new Set<Client>();
	
	// Check connection limits to prevent DoS
	if (set.size >= MAX_CONNECTIONS_PER_USER) {
		throw new Error('Too many connections from this user');
	}
	if (getTotalConnections() >= MAX_TOTAL_CONNECTIONS) {
		throw new Error('Server at connection capacity');
	}
	
	clients.set(userId, set);

	reply.raw.writeHead(200, {
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache",
		Connection: "keep-alive",
	});
	reply.raw.write("\n");

	let cleaned = false;
	const client: Client = {
		userId,
		reply,
		heartbeat: setInterval(() => safeWrite(reply, `event: ping\ndata: {}\n\n`), 25000),
		timeout: null as unknown as NodeJS.Timeout,
	};

	const cleanup = () => {
		if (cleaned) return;
		cleaned = true;
		clearInterval(client.heartbeat);
		clearTimeout(client.timeout);
		set.delete(client);
		if (set.size === 0) clients.delete(userId);
	};

	client.timeout = setTimeout(() => {
		cleanup();
		if (!reply.raw.closed) {
			reply.raw.end();
		}
	}, TIMEOUT_MS);
	
	set.add(client);

	reply.raw.on("close", cleanup);

	return client;
}

export function closeAll() {
	for (const set of clients.values()) {
		for (const client of set) {
			clearInterval(client.heartbeat);
			clearTimeout(client.timeout);
			try {
				client.reply.raw.end();
			} catch (err) {
				console.error('Error closing client:', err);
			}
		}
	}
	clients.clear();
}

export function broadcastTo(userId: string, event: string, payload: any) {
	const set = clients.get(userId);
	if (!set) return;
	const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
	for (const c of set) safeWrite(c.reply, data);
}

export function broadcastMessageToParticipants(
	senderId: string,
	recipients: string[],
	payload: { conversationId: number; message: any })
{
	try {
		const senderMember = getConversationMember(payload.conversationId, senderId);
		if (!senderMember)
			throw new Error('Unauthorized: Sender is not a member of this conversation');

		for (const recipientId of recipients) {
			const recipientMember = getConversationMember(payload.conversationId, recipientId);
			if (!recipientMember)
				throw new Error(`Unauthorized: Recipient ${recipientId} is not a member of this conversation`);
			if (isBlockedBy(senderId, recipientId))
				throw new Error(`Unauthorized: Sender is blocked by recipient ${recipientId}`);
		}
		
		broadcastTo(senderId, "message", payload);
		for (const r of recipients) broadcastTo(r, "message", payload);
	} catch (err) {
		if (err instanceof Error)
			throw err;
		throw new Error('Unauthorized: Membership or block verification failed');
	}
}