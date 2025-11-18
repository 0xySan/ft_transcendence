import Fastify from "fastify";
import cookie from '@fastify/cookie';
import swaggerPlugin from "./plugins/swagger/index.js";
import { WebSocketServer } from 'ws';
import http from 'http';

// Initialize db
import { db } from "./db/index.js";
db; // ensure db is initialized

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

if (process.env.NODE_ENV !== 'test' && (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64)) {
	console.error('FATAL: ENCRYPTION_KEY is not set in environment variables.');
	process.exit(1);
}

const SERVER_PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

async function buildServer() {
	const app = Fastify({
		logger: true,
		trustProxy: true,
	});

	// Register cookie plugin
	app.register(cookie, {
		secret: process.env.COOKIE_SECRET,
	});

	await app.register(swaggerPlugin);

	return app;
}

async function start() {
	try{
		const app = await buildServer();

		const server = http.createServer(app as any);

		const wss = new WebSocketServer({ server });

		wss.on('connection', (ws) => {
			console.log('WebSocket connected');

			ws.on('message', (msg) => {
				console.log('Received message:', msg.toString());
				ws.send(`echo: ${msg}`);
			});

			ws.on('close', () => {
				console.log('WebSocket disconnected');
			});
		});

		server.listen(SERVER_PORT, HOST, () => {
			console.log(`Server listening on http://${HOST}:${SERVER_PORT}`);
		});
	} catch (err) {
		console.error('Error starting server:', err);
		process.exit(1);
	}
}

process.on("SIGINT", async () => {
	console.log("SIGINT received, shutting down");
	try {
		const app = await buildServer();
		await app.close();
		process.exit(0);
	} catch {
		process.exit(1);
	}
});

start();

export default buildServer;