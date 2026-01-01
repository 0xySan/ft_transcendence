export const uploadAvatarUrlSchema = {
	summary: "Upload user avatar from URL",
	description: "Downloads and sets the user's avatar from a provided image URL (PNG, JPG, WEBP only).",
	tags: ["Users: Data"],
	body: {
		type: "object",
		required: ["url"],
		properties: {
			url: { type: "string", format: "uri", description: "Direct image URL (PNG, JPG, WEBP)" }
		}
	},
	response: {
		200: {
			description: "Avatar uploaded successfully",
			type: "object",
			properties: {
				success: { type: "boolean", example: true },
				fileName: { type: "string", example: "avatar_123.png" }
			}
		},
		400: {
			description: "Invalid input or image",
			type: "object",
			properties: { error: { type: "string", example: "Downloaded file is not a valid PNG/JPG/WEBP image" } }
		},
		401: {
			description: "Unauthorized",
			type: "object",
			properties: { error: { type: "string", example: "Unauthorized" } }
		}
	}
};

export const uploadAvatarFileSchema = {
	summary: "Upload user avatar from file",
	description: "Uploads and sets the user's avatar from a file (PNG, JPG, WEBP only, multipart/form-data).",
	tags: ["Users: Data"],
	consumes: ["multipart/form-data"],
	body: {
		type: "object",
		properties: {
			file: { type: "string", format: "binary", description: "Avatar image file (PNG, JPG, WEBP)" }
		},
		required: ["file"]
	},
	response: {
		200: {
			description: "Avatar uploaded successfully",
			type: "object",
			properties: {
				success: { type: "boolean", example: true },
				fileName: { type: "string", example: "avatar_123.png" }
			}
		},
		400: {
			description: "Invalid input or image",
			type: "object",
			properties: { error: { type: "string", example: "Uploaded file is not a valid PNG/JPG/WEBP image" } }
		},
		401: {
			description: "Unauthorized",
			type: "object",
			properties: { error: { type: "string", example: "Unauthorized" } }
		}
	}
};
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