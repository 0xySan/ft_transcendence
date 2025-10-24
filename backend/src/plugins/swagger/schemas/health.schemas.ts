export const healthSchema = {
	description: "Health check endpoint to verify server status",
	summary: "Server health check",
	tags: ["Health"],
	response: {
		200: {
			description: "Server is healthy",
			type: "object",
			properties: {
				status: { type: "string", example: "ok" },
				uptime: { type: "number", example: 123.45, description: "Server uptime in seconds" },
				timestamp: { type: "string", example: new Date().toISOString() },
			},
		},
		500: {
			description: "Server is unhealthy",
			type: "object",
			properties: {
				status: { type: "string", example: "error" },
				error: { type: "string", example: "Database unreachable" },
			},
		},
	},
};
