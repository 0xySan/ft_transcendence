import { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";

import { healthRoute } from "../../routes/health.route.js";

export default async function swaggerPlugin(app: FastifyInstance) {
	const SERVER_PORT = Number(process.env.PORT || 3000);
	const HOST = process.env.HOST || "0.0.0.0";

	await app.register(swagger, {
		openapi: {
			info: {
				title: "ft_transcendence API",
				description: "API documentation (Fastify + Swagger)",
				version: "1.0.0",
			},
			servers: [
				{
					url: `https://pong.moutig.sh/api`, // Will be put in .env later
					description: "Production server",
				},
			],
		},
	});

	await app.register(swaggerUI, {
		routePrefix: "/api/docs",
		uiConfig: {
			docExpansion: "full",
			deepLinking: false,
		},
		staticCSP: true,
	});

	await healthRoute(app);
}
