import Fastify from "fastify";
import { db } from "./db/index.js";
import swaggerPlugin from "./plugins/swagger/index.js";

const SERVER_PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

async function buildServer() {
	const app = Fastify({
		logger: true,
	});

	// Register swagger plugin
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
