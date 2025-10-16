import { describe, it, expect } from "vitest";
import buildServer from "../src/server.js";

describe("Fastify server", () => {
  it("should respond to /health", async () => {
    const app = await buildServer();
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    await app.close();
  });
});
