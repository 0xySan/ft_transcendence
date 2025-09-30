import Fastify from "fastify";
import dbPlugin from "./plugins/db.js";

const SERVER_PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

async function buildServer() {
  const app = Fastify({
    logger: true,
  });

  // Register the SQLite plugin first so routes can use app.db
  await app.register(dbPlugin);

  // Register users routes under /api/users

  // A simple health-check endpoint
  app.get("/health", async () => {
    return { status: "ok" };
  });

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

// Export for tests or programmatic usage
export default buildServer;
