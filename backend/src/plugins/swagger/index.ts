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
					url: "http://localhost:3000/api",
					description: "Production server",
				},
			],
			tags: [
				{ name: "Users", description: "User-related endpoints (profiles, images...)" },
				{ name: "Users: Accounts", description: "Account management endpoints (registration, login...)" },
				{ name: "OAuth", description: "OAuth provider integration endpoints" },
				{ name: "Game", description: "Gameplay and match tracking endpoints" },
			],
		},
	});

	await app.register(swaggerUI, {
	  routePrefix: "/api/docs",
	  theme: {
	    css: [
	      {
	        filename: "swagger-macchiato.css",
	        content: `
:root {
	/* Accent colors */
	--mauve: 203, 166, 247;
	--peach: 250, 179, 135;

	/* Text colors */
	--text: 202, 211, 245;
	--subtext1: 184, 192, 224;
	--subtext0: 165, 173, 203;

	/* Overlay / Borders */
	--overlay2: 147, 154, 183;
	--overlay0: 110, 115, 141;

	/* Surface / Backgrounds */
	--surface2: 91, 96, 120;
	--surface1: 73, 77, 100;
	--surface0: 54, 58, 79;
	--base: 36, 39, 58;
	--mantle: 30, 32, 48;
	--crust: 24, 25, 38;
}

body {
	background: rgb(var(--base));
}

.scheme-container {
	background: rgb(var(--mantle)) !important;
	box-shadow: 0 1px 2px rgba(var(--overlay0), 0.15) !important;
}

p,
h3,
h4,
h5,
.swagger-ui,
.title,
.opblock-tag,
.col_header,
[class^="parameter__"] {
	color: rgb(var(--text)) !important;
}

.response-col_status {
	color: rgb(var(--peach)) !important;
}

.parameter__in,
.tab li,
.response-col_links {
	color: rgb(var(--subtext0)) !important;
}

svg.arrow path {
	fill: rgb(var(--mauve));
}

.opblock-tag {
	border-bottom-color: rgb(var(--overlay0)) !important;
}

.opblock-summary-operation-id,
.opblock-summary-path,
.opblock-summary-description {
	color: rgb(var(--subtext1)) !important;
}

.topbar {
	background-color: rgb(var(--crust)) !important;
}

.opblock-section-header {
	background-color: rgb(var(--base)) !important;
}

textarea {
	background-color: rgb(var(--mantle)) !important;
	color: rgb(var(--text)) !important;
}

.swagger-ui input[type="text"] {
	background-color: rgb(var(--surface0));
	color: rgb(var(--text));
	border: 2px solid rgb(var(--overlay2)) !important;
}

.swagger-ui input[type="text"]::placeholder {
	color: rgb(var(--subtext1));
	opacity: 1;
}

.swagger-ui input[type="text"]:focus {
	outline: none;
	border-color: rgb(var(--mauve)) !important;
	background-color: rgb(var(--surface2));
	color: rgb(var(--text));
}

.swagger-ui select {
	background-color: rgb(var(--surface1));
	color: rgb(var(--text));
	border: 2px solid rgb(var(--overlay0));
}

.swagger-ui select:focus {
	outline: none;
	border-color: rgb(var(--mauve));
	background-color: rgb(var(--surface2));
	color: rgb(var(--text));
}

.swagger-ui .btn {
	border-color: rgb(var(--overlay2));
	color: rgb(var(--text));
}
	        `,
	      },
	    ],
	  },
	  uiConfig: {
	    docExpansion: "list",
	    deepLinking: true,
	    defaultModelsExpandDepth: 1,
	    defaultModelExpandDepth: 1,
	    displayRequestDuration: true,
	    filter: true,
	    operationsSorter: "alpha",
	    tagsSorter: "alpha",
	    syntaxHighlight: { theme: "monokai" },
	    tryItOutEnabled: true,
	    persistAuthorization: true,
	    displayOperationId: true,
	  },
	  staticCSP: true,
	});



	await registerRoutes(app);
}
