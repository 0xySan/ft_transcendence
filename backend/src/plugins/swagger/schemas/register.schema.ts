export const registerAccountSchema = {
	summary: "Create a new user account",
	description:
		"Registers a new user account using email, username, and password. Creates a user profile and sends a verification email.",
	tags: ["Users: Accounts"],
	body: {
		type: "object",
		required: ["email", "username", "password"],
		properties: {
			email: {
				type: "string",
				format: "email",
				description: "User email address",
			},
			password: {
				type: "string",
				description: "User password (8-64 chars)",
			},
			username: {
				type: "string",
				description: "Unique username (3-20 chars, letters, numbers, underscores)",
			},
			display_name: {
				type: "string",
				description: "Public display name (optional, 1-50 chars)",
			}
		}
	},
	response: {
		202: {
			description: "Registration accepted (verification email sent).",
			type: "object",
			properties: {
				message: { type: "string" },
			},
		},
		400: {
			description: "Bad request — missing or invalid fields",
			type: "object",
			properties: { message: { type: "string" } },
		},
		429: {
			description: "Too many registration attempts",
			type: "object",
			properties: { message: { type: "string" } },
		},
		500: {
			description: "Internal server error",
			type: "object",
			properties: { message: { type: "string" } },
		},
	},
};
