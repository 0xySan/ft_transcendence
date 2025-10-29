export const ftCallbackSchema = {
	summary: "42 OAuth callback",
	description: "Handles the OAuth2 callback from the 42 API. Exchanges authorization code for access token, retrieves user info, and redirects based on account linking or registration state.",
	tags: ["Auth: OAuth"],
	querystring: {
		type: "object",
		required: ["code"],
		properties: {
			code: {
				type: "string",
				description: "Authorization code returned by 42 API"
			}
		}
	},
	response: {
		302: {
			description: "Redirect to next step depending on user state",
			headers: {
				Location: {
					type: "string",
					description: "Redirection target (success, link-account, or register)"
				}
			},
			type: "null"
		},
		400: {
			description: "Missing or invalid code parameter",
			type: "string",
			examples: ["Missing code"]
		},
		404: {
			description: "OAuth provider not found in database",
			type: "string",
			examples: ["OAuth provider not found"]
		},
		500: {
			description: "Internal error or failed token exchange",
			type: "object",
			properties: {
				error: { type: "string", example: "No access token returned" }
			}
		}
	}
};