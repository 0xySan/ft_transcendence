export const meSchema = {
	summary: "Retrieve authenticated user information",
	description: "Fetches the authenticated user's details and profile based on the session.",
	tags: ["Users: Me"],
	response: {
		200: {
			description: "Authenticated user information retrieved successfully",
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						id: { type: "string", example: "user-123" },
						email: { type: "string", format: "email", example: "example@domain.com" },
						createdAt: { type: "string", format: "date-time", example: "2025-12-08T12:34:56Z" },
						profile: {
							type: "object",
							properties: {
								username: { type: "string", example: "tester" },
								displayName: { type: "string", example: "Tester", nullable: true },
								profilePicture: { type: "string", example: "pic.jpg", nullable: true },
								bio: { type: "string", example: "Hello world", nullable: true },
								country: {
									type: "object",
									properties: {
										id: { type: "number", example: 1 },
										name: { type: "string", example: "Testland" },
										code: { type: "string", example: "TL" },
										flag: { type: "string", example: "<svg></svg>" },
									},
									nullable: true,
								},
							},
							nullable: true,
						},
					},
				},
			},
		},
		401: {
			description: "Unauthorized - no session",
			type: "object",
			properties: {
				message: { type: "string", example: "Unauthorized" },
			},
		},
		404: {
			description: "User not found",
			type: "object",
			properties: {
				message: { type: "string", example: "User not found" },
			},
		},
		500: {
			description: "Internal server error",
			type: "object",
			properties: {
				message: { type: "string", example: "Internal Server Error" },
			},
		},
	},
};
