import Fastify from "fastify";
import cookie from '@fastify/cookie';
import swaggerPlugin from "./plugins/swagger/index.js";
import { WebSocketServer } from 'ws';
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

// Initialize db
import { db } from "./db/index.js";
db; // ensure db is initialized

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

if (process.env.NODE_ENV !== 'test' && (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64)) {
	console.error('FATAL: ENCRYPTION_KEY is not set in environment variables.');
	process.exit(1);
}

export interface worker {
	worker: Worker;
	players: number;
}

const SERVER_PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
export const workers: worker[] = [];
export const parties_per_core = 2;

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

export async function createThread(options: { workerFile?: string, count?: number } = {}) {
  const workerFile = options.workerFile ?? null;
  const count = options.count ?? os.cpus().length;

  if (!workerFile && process.env.NODE_ENV === "test") return;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const workerPath = workerFile ||
    path.resolve(__dirname, './game/gamesLogic.js');

  for (let i = 0; i < count; i++) {
    workers.push({
      worker: new Worker(workerPath),
      players: 0
    });
  }
}


// async function createThread() {
// 	const core = os.cpus().length;

// 	// --- Résoudre le chemin de base avec import.meta.url ---
// 	const __filename = fileURLToPath(import.meta.url);
// 	const __dirname = path.dirname(__filename);

// 	// --- Créer le chemin absolu vers test.js ---
// 	const workerPath = path.resolve(__dirname, './game/gamesLogic.js');
	
// 	// --- Créer le worker avec le chemin absolu ---
// 	for (let i = 0; i < core; i++) {
// 		workers.push({
// 			worker: new Worker(workerPath),
// 			players: 0
// 		});
// 	}
// }

async function start() {
	try{
		const app = await buildServer();
		await app.ready();

		const server = app.server;

		const wss = new WebSocketServer({ server });

		createThread();

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