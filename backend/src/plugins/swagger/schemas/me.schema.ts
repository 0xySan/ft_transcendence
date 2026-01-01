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

export const updateMeSchema = {
	summary: "Update authenticated user's profile",
	description: "Update the authenticated user's profile fields (displayName, profilePicture, country, bio). Username cannot be changed here.",
	tags: ["Users: Me"],
	body: {
		type: "object",
		additionalProperties: false,
		properties: {
			displayName: { type: "string", maxLength: 50, description: "Display name (optional, ≤50 chars)" },
			profilePicture: { type: "string", maxLength: 255, description: "Profile picture filename or URL (optional, ≤255 chars)" },
			country: { type: "number", description: "Country ID (optional)"},
			bio: { type: "string", maxLength: 500, description: "User biography (optional, ≤500 chars)" }
		},
		// no required properties — partial updates allowed
	},
	response: {
		200: {
			description: "Profile updated successfully",
			type: "object",
			properties: {
				success: { type: "boolean", example: true },
				profile: {
					type: "object",
					properties: {
						username: { type: "string", example: "user123" },
						displayName: { type: "string", nullable: true, example: "User OneTwoThree" },
						profilePicture: { type: "string", nullable: true, example: "avatar_1.png" },
						bio: { type: "string", nullable: true, example: "This is my bio." },
						country: {
							type: "object",
							properties: {
								id: { type: "number", example: 42 },
								name: { type: "string", example: "France" },
								code: { type: "string", example: "FR" },
								flag: { type: "string", example: "<svg></svg>" },
							},
							nullable: true,
						},
					},
					nullable: true,
				},
			},
		},
		400: {
			description: "Bad request - validation error",
			type: "object",
			properties: { message: { type: "string", example: "Invalid displayName (must be string, ≤50 chars)" } }
		},
		401: {
			description: "Unauthorized - missing or invalid session",
			type: "object",
			properties: { message: { type: "string", example: "Unauthorized: No session token" } }
		},
		404: {
			description: "Profile not found",
			type: "object",
			properties: { message: { type: "string", example: "Profile not found" } }
		},
		500: {
			description: "Internal server error",
			type: "object",
			properties: { message: { type: "string", example: "Internal server error" } }
		},
	},
};