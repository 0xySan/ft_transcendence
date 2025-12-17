import Fastify from "fastify";
import cookie from '@fastify/cookie';
import swaggerPlugin from "./plugins/swagger/index.js";

// Initialize db
import { db } from "./db/index.js";
db; // ensure db is initialized

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

if (process.env.NODE_ENV !== 'test' && (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64)) {
  console.error('FATAL: ENCRYPTION_KEY is not set in environment variables.');
  process.exit(1);
}

if (process.env.DOMAIN_NAME === undefined || process.env.DOMAIN_NAME.length === 0) {
	process.env.DOMAIN_NAME = 'localhost';
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
		secret: process.env.COOKIE_SECRET, // for signing cookies
	});

	await app.register(swaggerPlugin);

	return app;
}

async function start() {
	const app = await buildServer();

	try {
		await app.listen({ port: SERVER_PORT, host: HOST });
		app.log.info(`Backend listening on http://${HOST}:${SERVER_PORT}`);
	} catch (err) {
		app.log.error(err);
		process.exit(1);
	}
}

// Graceful shutdown on signals
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
