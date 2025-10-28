import { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";

import { registerRoutes } from "../../routes/index.js";

export default async function swaggerPlugin(app: FastifyInstance) {
	const SERVER_PORT = Number(process.env.PORT || 3000);
	const HOST = process.env.HOST || "0.0.0.0";

	await app.register(swagger, {
		openapi: {
			info: {
				title: "ft_transcendence API",
				description: "Full API documentation for users, OAuth, and gameplay endpoints",
				version: "1.0.0",
			},
			servers: [
				{
					url: "https://pong.moutig.sh/api",
					description: "Production server",
				},
			],
			tags: [
				{ name: "Users", description: "User-related endpoints (profiles, images...)" },
				{ name: "Accounts", description: "Account management endpoints (registration, login...)" },
				{ name: "Auth", description: "Authentication endpoints" },
				{ name: "Game", description: "Gameplay and match tracking endpoints" },
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

	await registerRoutes(app);
}
