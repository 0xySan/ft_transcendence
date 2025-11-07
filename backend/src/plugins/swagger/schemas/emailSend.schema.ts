export const emailSendSchema = {
	summary: "Send a verification email",
	description:
		"Sends a 2fa verification email to the user.",
	tags: ["Email", "2FA"],
	body: {
		type: "object",
		required: ["email"],
		properties: {
			email: {
				type: "string",
				format: "email",
				description: "User email address"
			},
		},
	},
	response: {
		202: {
			description: "Email sent successfully",
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
