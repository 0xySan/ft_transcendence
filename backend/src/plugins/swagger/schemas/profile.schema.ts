export const profileSchema = {
	summary: "Retrieve user profile information",
	description: "Fetches the profile details of a user by their unique ID.",
	tags: ["Users"],
	querystring: {
		type: "object",
		properties: {
			id: {
				type: "string",
				description: "Unique identifier of the user",
			},
		},
		required: ["id"],
	},
	response: {
		200: {
			description: "User profile retrieved successfully",
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						user_id: { type: "string", example: 1 },
						email: { type: "string", format: "email", example: "example@domain.com" },
						role: {
							type: "object",
							properties: {
								role_id: { type: "number", example: 2 },
								role_name: { type: "string", example: "User" },
							}
						},
						created_at: { type: "string", format: "date-time" },
						last_login: { type: "string", format: "date-time", nullable: true },
					},
				},
				profile: {
					type: "object",
					properties: {
						username: { type: "string", example: "user123" },
						display_name: { type: "string", example: "User OneTwoThree", nullable: true },
						profile_picture: { type: "string", example: "avatar_1.png", nullable: true },
						country_id: { type: "number", example: 42, nullable: true },
						bio: { type: "string", example: "This is my bio.", nullable: true },
					},
					nullable: true,
				},
			},
		},
		400: {
			description: "Bad request - missing or invalid user ID",
			type: "object",
			properties: {
				error: { type: "string", example: "Missing user ID in query" },
			},
		},
		404: {
			description: "User not found",
			type: "object",
			properties: {
				error: { type: "string", example: "User not found" },
			},
		},
		500: {
			description: "Internal server error",
			type: "object",
			properties: {
				error: { type: "string", example: "Internal server error" },
			},
		},
	},
};