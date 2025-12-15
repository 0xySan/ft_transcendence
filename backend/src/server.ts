import Fastify from "fastify";
import cookie from '@fastify/cookie';
import swaggerPlugin from "./plugins/swagger/index.js";
import { WebSocketServer } from 'ws';
import { Worker } from 'worker_threads';

// Initialize db
import { db } from "./db/index.js";
db; // ensure db is initialized

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

if (process.env.NODE_ENV !== 'test' && (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64)) {
	console.error('FATAL: ENCRYPTION_KEY is not set in environment variables.');
	process.exit(1);
}

import { setupWebSocketServer } from "./game/sockets/index.js";

/**
 * This interface with a worker (thread) and a list of players in this.
 */
export interface worker {
	/* This is the worker (thread) with 'parties_per_core' */
	worker: Worker;
	/* This is a list with every user_id in game in this worker (thread). */
	players: string[];
}

const SERVER_PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

/**
 * Stock every worker (thread) here.
 * Stock the number of parties here, "base: 8"
 */
export const workers: worker[] = [];
export const parties_per_core = 8;

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
		await app.ready();

		const server = app.server;

		const wss = new WebSocketServer({ server });
		setupWebSocketServer(wss);

		
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