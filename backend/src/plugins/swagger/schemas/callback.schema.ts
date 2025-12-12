export const oauthCallbackSchema = {
	summary: "Handle OAuth callback",
	description:
		"Handles the OAuth provider callback, exchanges the authorization code for an access token, " +
		"retrieves user info, creates or links the user account, and creates a session. " +
		"Supports both logged-in users linking their OAuth account and new users signing up.",
	tags: ["OAuth"],
	params: {
		type: "object",
		required: ["provider"],
		properties: {
			provider: {
				type: "string",
				description: "OAuth provider name (e.g., 'google', 'github')"
			}
		}
	},
	query: {
		type: "object",
		required: ["code"],
		properties: {
			code: {
				type: "string",
				description: "Authorization code returned by the OAuth provider"
			}
		}
	},
	response: {
		200: {
			description: "Login successful.",
			type: "object",
			properties: {
				message: { type: "string" }
			}
		},
		202: {
			description: "2FA required for the user.",
			type: "object",
			properties: {
				message: { type: "string" },
				twoFactorRequired: { type: "boolean" },
				twoFactorMethods: {
					type: "array",
					items: {
						type: "object",
						properties: {
							method_type: { type: "string" },
							label: { type: "string" },
							is_primary: { type: "boolean" }
						}
					}
				}
			}
		},
		400: {
			description: "Bad request — missing code or invalid parameters",
			type: "object",
			properties: { message: { type: "string" } }
		},
		401: {
			description: "Unauthorized — invalid or expired session when linking accounts",
			type: "object",
			properties: { message: { type: "string" } }
		},
		404: {
			description: "OAuth provider not found",
			type: "object",
			properties: { message: { type: "string" } }
		},
		409: {
			description: "User exists — OAuth account must be linked manually",
			type: "object",
			properties: { message: { type: "string" } }
		},
		500: {
			description: "Internal server error — failed to create user, OAuth account, or session",
			type: "object",
			properties: { message: { type: "string" } }
		}
	}
};
