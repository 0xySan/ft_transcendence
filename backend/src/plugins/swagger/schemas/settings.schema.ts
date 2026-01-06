export const postSettingsSchema = {
	summary: "Submit game settings for processing",
	description: "Accepts partial game configuration and forwards it for processing by the game worker (owner-only changes applied immediately).",
	tags: ["Game"],
 	body: {
 		type: "object",
 		properties: {
 			settings: { type: "object" }
 		},
 		required: ["settings"]
 	},
 	response: {
 		202: {
 			description: "Settings accepted for processing",
 			type: "object",
 			properties: { message: { type: "string" } },
 			example: { message: "Settings accepted for processing." }
 		},
 		400: {
 			description: "Bad request or validation error",
 			type: "object",
 			properties: { error: { type: "string" } }
 		},
		401: {
 			description: "Not authenticated",
 			type: "object",
 			properties: { error: { type: "string" } }
 		},
		404: {
			description: "Game not found for the user",
			type: "object",
			properties: { error: { type: "string" } }
		},
		500: {
			description: "Internal server error",
			type: "object",
			properties: { error: { type: "string" } }
		}
 	}
};

export const getSettingsSchema = {
	summary: "Get current game settings for the user",
	description: "Returns the current `settingsPayload` for the game (includes `gameId`, `userId`, and `newSettings`).",
	tags: ["Game"],
 	querystring: {
 		type: 'object',
 		properties: {
 			gameId: { type: 'string' },
 			code: { type: 'string' }
 		}
 	},
 	response: {
 		200: {
 			description: "Current game settings payload",
 			type: "object",
 			properties: {
 				settings: {
 					type: "object",
 					properties: {
 						gameId: { type: "string" },
 						userId: { type: "string" },
						newSettings: { type: "object", additionalProperties: true }
 					}
 				}
 			},
 			example: {
 				settings: {
 					gameId: "some-game-id",
 					userId: "owner-user-id",
 					newSettings: {
 						game: { visibility: true, mode: "online", code: "ABCD", maxPlayers: 2, spectatorsAllowed: false }
 					}
 				}
 			}
 		},
 		400: {
 			description: "Bad request (missing user)",
 			type: "object",
 			properties: { error: { type: "string" } }
 		},
 		404: {
 			description: "Settings not found for the user",
 			type: "object",
 			properties: { error: { type: "string" } }
 		},
 		500: {
 			description: "Internal server error",
 			type: "object",
 			properties: { error: { type: "string" } }
 		}
 	}
};
