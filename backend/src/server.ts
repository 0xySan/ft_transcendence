import Fastify from "fastify";
import cookie from '@fastify/cookie';
import swaggerPlugin from "./plugins/swagger/index.js";
import { WebSocketServer } from 'ws';
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { parse } from './sockets/socketParsing.js'
import { getProfileByUserId, UserProfile } from './db/wrappers/main/users/userProfiles.js';

// Initialize db
import { db } from "./db/index.js";
db; // ensure db is initialized

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

if (process.env.NODE_ENV !== 'test' && (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64)) {
	console.error('FATAL: ENCRYPTION_KEY is not set in environment variables.');
	process.exit(1);
}

import { clientToken, deletePlayerWithToken, getPlayerWithToken, getPlayerWithUserId } from "./routes/game.route.js";

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

/**
 * Create every thread for they games.
 * @param options - Option with a path of a worker (thread) and the number of CPU core.
 */
export async function createThread(options: { workerFile?: string, count?: number } = {}) {
	const workerFile = options.workerFile ?? null;
	const count = options.count ?? os.cpus().length;

	// This check is for the test with vitest.
	if (!workerFile && process.env.NODE_ENV === "test") return;

	// Get the file path.
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);
	const workerPath = workerFile ||
		path.resolve(__dirname, './game/gamesLogic.js');

	// Create the worker (thread).
	for (let i = 0; i < count; i++) {
		const worker = new Worker(workerPath);
		worker.on("message", (msg) => {
			if (msg.action == "finished") {
				const player = getPlayerWithUserId(msg.user_id);
				if (player && player.socket) player?.socket.close(1000, "game finished");
			} else if (msg.action == "send") {
				const player = getPlayerWithUserId(msg.user_id);
				// console.log("DEBUG: json = " + JSON.stringify(msg));
				if (player && player.socket) player.socket.send(JSON.stringify(msg));
			} else if (msg.action == "start") {
				const player = getPlayerWithUserId(msg.user_id);
				// console.log("DEBUG: token = " + player?.token + " | user_id = " + player?.player_id);
				if (player && player.socket) player.socket.send(JSON.stringify(msg));
			}
		});
	
		workers.push({
		worker: worker,
		players: []
		});
	}
}

async function start() {
	try{
		const app = await buildServer();
		await app.ready();

		const server = app.server;

		const wss = new WebSocketServer({ server });

		createThread();

		wss.on('connection', (ws, request) => {
			const params = new URLSearchParams(request.url?.split('?')[1]);
			const token = params.get('token'); 

			console.log(`DEBUG: User connected`);

			if (!token)
			{
				ws.close(1008, 'token or user_id not defined');
				console.log('WebSocket rejected: token not defined', token);
				return;
			}

			const player = getPlayerWithToken(token);
			if (player == null) {
				return;
			}

			player.setSocket(ws);
			console.log("\n\n\n\n\n\nDEBUG: token list = " + clientToken.length);
			for (const client of clientToken) {
				console.log("- uuid = " + client.player_id + " | username = " + getProfileByUserId(client.player_id)?.display_name);
			}
			if (player.token !== token)
			{
				ws.close(1008, 'Invalid token or user_id');
				console.log('WebSocket rejected: invalid token/user_id', player.token, token);
				return;
			}
			else
			{
				ws.send(JSON.stringify({ event: 'welcome' }));
				console.log('WebSocket authenticated');
				ws.on('message', (msg) => { 
					ws.send(`echo: ${msg}`);
					let str =  msg.toString();
					let data;
					try {
						data = JSON.parse(str);
						parse(data, player);
					}
					catch (err) {
						console.log("Invalid JSON");
					}
				});
			}				
			ws.on('close', () => {
				console.log('WebSocket disconnected');
				// deletePlayerWithToken(token);
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