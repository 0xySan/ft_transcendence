import { FastifyReply } from "fastify";
import { waitingUsers, leaveQueue } from "../routes/game/finding.route.js"
import { workerData } from "worker_threads";

export type Session = { userId: string; user_id: string; [key: string]: any };

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CONNECTIONS_PER_USER = 25;
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

		console.log("DEBUG: leaving nwkonwengw\n\n\n");

		leaveQueue(client.userId);

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

export function closeClientById(userId: string) {
	for (const set of clients.values()) {
		for (const client of set) {
			if (client.userId === userId) {
				clearInterval(client.heartbeat);
				clearTimeout(client.timeout);
				try {
					client.reply.raw.end();
				} catch (err) {
					console.error('Error closing client:', err);
				}
				return;
			}
		}
	}
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