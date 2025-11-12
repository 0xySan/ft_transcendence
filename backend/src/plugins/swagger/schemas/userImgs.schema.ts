export const userImgsSchema = {
	summary: "Get user images",
	description: "Retrieves a user profile picture by its name.",
	tags: ["Users: Data"],
	params: {
		type: "object",
		required: ["fileName"],
		properties: {
			fileName: {
				type: "string",
				description: "The name of the user image file",
				example: "avatar_1.png",
			},
		},
	},
	response: {
		200: {
			description: "User image retrieved successfully",
			type: "string",
			format: "binary",
		},
		400: {
			description: "File name is required or is directory",
			type: "object",
			properties: {
				error: { type: "string", example: "File name is required" },
			},
		},
		404: {
			description: "User image not found",
			type: "object",
			properties: {
				error: { type: "string", example: "File not found" },
			},
		},
		500: {
			description: "Server error while retrieving user image",
			type: "object",
			properties: {
				error: { type: "string", example: "Failed to retrieve image" },
			},
		},
	},
};