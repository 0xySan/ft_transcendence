import { describe, it, expect } from "vitest";
import buildServer from "../src/server.js";

describe("Fastify server", () => {
  it("should respond to /api/health", async () => {
    const app = await buildServer();
    const response = await app.inject({ method: "GET", url: "api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty("status", "ok");
    await app.close();
  });
});
