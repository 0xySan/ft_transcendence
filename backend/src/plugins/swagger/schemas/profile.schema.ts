export const profileSchema = {
	summary: "Retrieve user profile information",
	description: "Fetches the profile details of a user by their unique ID.",
	tags: ["Users: Profile"],
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

export const updateProfileSchema = {
    summary: "Update authenticated user's profile",
    description: "Update the authenticated user's profile fields (display name, profile picture, country, bio). Username cannot be changed here.",
    tags: ["Users: Profile"],
    body: {
        type: "object",
        additionalProperties: false,
        properties: {
            display_name: { type: "string", maxLength: 50, description: "Display name (optional, ≤50 chars)" },
            profile_picture: { type: "string", maxLength: 255, description: "Profile picture filename or URL (optional, ≤255 chars)" },
            country_id: { type: "number", description: "Country ID (optional)"},
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
                        profile_id: { type: "number", example: 1 },
                        user_id: { type: "string", example: "01F..." },
                        username: { type: "string", example: "user123" },
                        display_name: { type: "string", nullable: true, example: "User OneTwoThree" },
                        profile_picture: { type: "string", nullable: true, example: "avatar_1.png" },
                        country_id: { type: "number", nullable: true, example: 42 },
                        bio: { type: "string", nullable: true, example: "This is my bio." },
                    },
                    nullable: true,
                },
            },
        },
        400: {
            description: "Bad request - validation error",
            type: "object",
            properties: { error: { type: "string", example: "Invalid display_name (must be string, ≤50 chars)" } }
        },
        401: {
            description: "Unauthorized - missing or invalid session",
            type: "object",
            properties: { message: { type: "string", example: "Unauthorized: No session token" } }
        },
        404: {
            description: "Profile not found",
            type: "object",
            properties: { error: { type: "string", example: "Profile not found" } }
        },
        500: {
            description: "Internal server error",
            type: "object",
            properties: { error: { type: "string", example: "Internal server error" } }
        },
    },
};