// Routes for /api/users
// - GET  /        -> returns an array of users
// - POST /        -> creates a new user (expects JSON { username: string })

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

interface CreateUserBody {
  username: string;
}

export default async function usersRoutes(app: FastifyInstance) {
  // Return a list of users
  app.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const rows = app.db.prepare("SELECT id, username FROM users ORDER BY id ASC").all();
      return reply.send(rows);
    } catch (err) {
      app.log.error("Error fetching users: " + (err as Error).message);
      return reply.status(500).send({ error: "Failed to fetch users" });
    }
  });

  // Create a new user
  app.post("/", async (request: FastifyRequest<{ Body: CreateUserBody }>, reply: FastifyReply) => {
    const body = request.body;

    // Basic validation
    if (!body || typeof body.username !== "string" || body.username.trim().length === 0) {
      return reply.status(400).send({ error: "username is required" });
    }

    const username = body.username.trim();

    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;

	if (!usernameRegex.test(username)) {
	  return reply.status(400).send({
	    error: "Invalid username. Allowed: a–z, A–Z, 0–9, _ (3–20 chars)"
	  });
	}

    try {
      const stmt = app.db.prepare("INSERT INTO users (username) VALUES (?)");
      const info = stmt.run(username);
      // info.lastInsertRowid is the inserted id
      return reply.status(201).send({ id: info.lastInsertRowid, username });
    } catch (err) {
      // handle constraint errors (e.g., UNIQUE)
      const message = (err as Error).message;
      app.log.warn("Create user failed: " + message);
      return reply.status(400).send({ error: "Could not create user", details: message });
    }
  });
}
