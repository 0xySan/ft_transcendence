export const oauthSchema = {
	summary: 'OAuth login',
	description: 'Redirects the user to the OAuth provider login page.',
	tags: ['OAuth'],
	params: {
		type: 'object',
		required: ['provider'],
		properties: {
			provider: {
				type: 'string',
				description: 'OAuth provider to use',
				enum: ['discord', 'forty-two', 'github', 'google'],
				example: 'discord',
			},
		},
	},
	response: {
		302: {
			description: 'Redirect to the OAuth provider login page',
		},
		404: {
			description: 'OAuth provider not found',
			type: 'object',
			properties: {
				error: { type: 'string', example: 'OAuth provider not found' },
			},
		},
		500: {
			description: 'Server error or missing OAuth configuration',
			type: 'object',
			properties: {
				error: { type: 'string', example: 'OAuth configuration missing' },
			},
		},
	},
};

export const oauthListSchema = {
	summary: 'List linked OAuth accounts',
	description: 'Returns all OAuth accounts linked to the authenticated user.',
	tags: ['OAuth'],
	response: {
		200: {
			description: 'List of OAuth accounts',
			type: 'object',
			properties: {
				oauth: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							provider: { type: 'string', example: 'discord' },
							linkedAt: { type: 'integer', example: 1765380705242 },
							profile: {
								type: 'object',
								description: 'Raw profile info from the OAuth provider',
								example: {
									id: '123456789',
									username: 'JohnDoe',
									email: 'johndoe@example.com',
									avatar: 'https://cdn.example.com/avatar.png'
								}
							}
						}
					}
				}
			}
		},
		400: {
			description: 'Invalid request or user not authenticated',
			type: 'object',
			properties: {
				error: { type: 'string', example: 'You cannot access this resource' }
			}
		},
		401: {
			description: 'Unauthorized',
			type: 'object',
			properties: {
				error: { type: 'string', example: 'Unauthorized' }
			}
		}
	}
};
