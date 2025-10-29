import { FastifyInstance } from "fastify";
import { healthSchema } from "../plugins/swagger/schemas/health.schema.js";

export async function healthRoute(app: FastifyInstance) {
	app.get("/api/health", { schema: healthSchema }, async () => {
		try {
			const uptime = process.uptime();
			return {
				status: "ok",
				uptime,
				timestamp: new Date().toISOString(),
			};
		} catch (err) {
			return {
				status: "error",
				error: "Unable to get health status",
			};
		}
	});
}
