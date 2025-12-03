export const registerAccountSchema = {
	summary: "Create a new user account",
	description:
		"Registers a new user account with either email/password or OAuth credentials. Creates a user profile, saves avatar, and sends a verification email.",
	tags: ["Users: Accounts"],
	body: {
		type: "object",
		required: ["email", "username"],
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
			},
			pfp: {
				type: "string",
				description: "Optional avatar URL or path (max 255 chars)",
			},
			oauth: {
				type: "object",
				description: "Optional OAuth account data (external provider sign-up)",
				properties: {
					provider_name: { type: "string", description: "OAuth provider name" },
					provider_user_id: { type: "string", description: "Unique provider user ID" },
					profile_json: { type: "string", description: "Raw OAuth profile JSON (optional)" },
					id_token_hash: { type: "string", description: "Hashed ID token (optional)" },
				},
			},
		},
		anyOf: [
			{
				required: ["password"],
				description: "Password-based registration"
			},
			{
				required: ["oauth"],
				description: "OAuth-based registration"
			},
		],
	},
	response: {
		202: {
			description: "Registration accepted (verification email sent if valid).",
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
