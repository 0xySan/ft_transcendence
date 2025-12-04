import Fastify from "fastify";
import cookie from '@fastify/cookie';
import swaggerPlugin from "./plugins/swagger/index.js";
import { WebSocketServer } from 'ws';
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { parse } from './sockets/socketParsing.js'
import WebSocket from 'ws';

// Initialize db
import { db } from "./db/index.js";
db; // ensure db is initialized

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

if (process.env.NODE_ENV !== 'test' && (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64)) {
	console.error('FATAL: ENCRYPTION_KEY is not set in environment variables.');
	process.exit(1);
}

import { clientToken, getPlayerWithToken, getPlayerWithUserId } from "./routes/game.route.js";
import { Player } from "./sockets/player.class.js";

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
			console.log("DEBUG: msg = " + msg.action);
			if (msg.action == "finished") {
				const player = getPlayerWithUserId(msg.user_id);
                console.log("DEBUG: user_id = " + msg.user_id + " | token = " + player?.token);
				player?.socket.close(1000, "game finished");
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
			console.log("DEBUG: websocket start here !");

			const params = new URLSearchParams(request.url?.split('?')[1]);
			const user_id = params.get('user_id'); 
			const token = params.get('token'); 

			console.log(`User connected: ${user_id}`);
    		ws.send(JSON.stringify({ event: 'welcome', user_id }));

			if (!user_id || !token)
			{
				ws.close(1008, 'token or user_id not defined'); // 1008 = Policy Violation
				console.log('WebSocket rejected: token or user_id not defined', token, user_id);
				return;
			}

			const player = getPlayerWithToken(token);
			if (player == null) {
				return;
			}

			player.setSocket(ws);
			if (player.token !== token)
			{
				ws.close(1008, 'Invalid token or user_id'); // 1008 = Policy Violation
				console.log('WebSocket rejected: invalid token/user_id', player.token, token);
				return;
			}
			else
			{
				// 🔥 AUTH OK → maintenant seulement envoyer le welcome
				ws.send(JSON.stringify({ event: 'welcome', user_id }));
				console.log('WebSocket authenticated:', user_id);
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
				clientToken.splice(clientToken.indexOf(player), 1);
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