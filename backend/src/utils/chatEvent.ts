import { FastifyReply } from "fastify";

type Client = { userId: string; reply: FastifyReply; heartbeat: NodeJS.Timeout };
const clients = new Map<string, Set<Client>>();

function safeWrite(reply: FastifyReply, chunk: string) {
	try { reply.raw.write(chunk); } catch {}
}

export function addClient(userId: string, reply: FastifyReply): Client {
	const set = clients.get(userId) || new Set<Client>();
	clients.set(userId, set);

	reply.raw.writeHead(200, {
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache",
		Connection: "keep-alive",
	});
	reply.raw.write("\n");

	const client: Client = {
		userId,
		reply,
		heartbeat: setInterval(() => safeWrite(reply, `event: ping\ndata: {}\n\n`), 25000),
	};
	set.add(client);

	reply.raw.on("close", () => {
		clearInterval(client.heartbeat);
		set.delete(client);
		if (set.size === 0) clients.delete(userId);
	});

	return client;
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
  	broadcastTo(senderId, "message", payload);
  	for (const r of recipients) broadcastTo(r, "message", payload);
}