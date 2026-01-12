export const getGameSchema = {
	summary: "Create a session token for a user",
	description: "Generates a temporary game token for a given user_id. Does not create or join a game.",
	tags: ["Game"],
	body: {
		type: "object",
		properties: {
			user_id: { type: "string", description: "UUID of the user" }
		},
		required: ["user_id"]
	},
	response: {
		202: {
			description: "Token successfully created",
			type: "object",
			properties: {
				token: { type: "string" }
			},
			example: {
				token: "eyf6d7f6sd78f6sd7f6sd78fsd"
			}
		},
		401: {
			description: "User ID is empty or missing",
			type: "object",
			properties: {
				error: { type: "string" }
			},
			example: { error: "user_is is empty" }
		}
	}
};

export const postGameSchema = {
	summary: "Create or join a game",
	description: `
Creates a game when code is null.
Joins an existing game when code is provided.
Requires a valid session or authorization token.`,
	tags: ["Game"],
	body: {
		type: "object",
		properties: {
			code: { type: "string", nullable: true, description: "Game code (null for creation)" }
		}
	},
	response: {
		202: {
			description: "Game created or joined successfully",
			type: "object",
			properties: {
				token: { type: "string" }
			},
			example: {
				token: "game_session_token_here"
			}
		},
		401: {
			description: "Authentication or game code error",
			type: "object",
			properties: {
				error: { type: "string" }
			},
			examples: [
				{ error: "user_is is empty" },
				{ error: "Code doesn't exist" }
			]
		},
		501: {
			description: "Server overloaded or game full",
			type: "object",
			properties: {
				error: { type: "string" }
			},
			examples: [
				{ error: "Every server is full" },
				{ error: "Game is full" }
			]
		}
	}
};

export const patchGameSchema = {
	summary: "Update game state/settings",
	description: `
Updates time, score, ball positions, paddle positions and velocity.
Requires the player to belong to an existing game.`,
	tags: ["Game"],
	body: {
		type: "object",
		properties: {
			user_id: { type: "string", description: "UUID of the user" },
			time: { type: "number", description: "Remaining game time" },
			score: {
				type: "object",
				description: "Score of each player",
				additionalProperties: { type: "number" }
			},
			position_ball: {
				type: "object",
				properties: {
					pos_x: { type: "number" },
					pos_y: { type: "number" }
				}
			},
			velocity_ball: {
				type: "object",
				properties: {
					pos_x: { type: "number" },
					pos_y: { type: "number" }
				}
			},
			position_paddle: {
				type: "object",
				description: "Paddle position for each player",
				additionalProperties: {
					type: "object",
					properties: {
						pos_x: { type: "number" },
						pos_y: { type: "number" }
					}
				}
			}
		},
		required: [
			"user_id",
			"time",
			"score",
			"position_ball",
			"velocity_ball",
			"position_paddle"
		]
	},
	response: {
		202: {
			description: "Settings updated successfully",
			type: "object",
			properties: {
				sucess: { type: "string" }
			},
			example: { sucess: "settings updated" }
		},
		401: {
			description: "Some required settings are missing",
			type: "object",
			properties: {
				error: { type: "string" }
			},
			examples: [
				{ error: "Setting 'time' is not set" },
				{ error: "Setting 'score' is not set" },
				{ error: "Setting 'position_ball' is not set" },
				{ error: "Setting 'velocity_ball' is not set" },
				{ error: "Setting 'position_paddle' is not set" }
			]
		},
		501: {
			description: "Game not found or internal error",
			type: "object",
			properties: {
				error: { type: "string" }
			},
			examples: [
				{ error: "Game doesn't exist" },
				{ error: "Game not find" }
			]
		}
	}
};
