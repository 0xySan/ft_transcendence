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