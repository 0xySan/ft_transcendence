export const discordCallbackSchema = {
	summary: 'Discord OAuth2 callback endpoint',
	description: `Handles the OAuth2 callback from Discord. Exchanges authorization code for access token, retrieves user info,
	and redirects based on account linking or registration state.`,
	tags: ['OAuth'],
	querystring: {
		type: 'object',
		properties: {
			code: { type: 'string', description: 'OAuth2 authorization code returned by Discord' },
			state: { type: 'string', description: 'Optional state parameter for CSRF protection', nullable: true }
		},
		required: ['code']
	},
	response: {
		302: {
			description: 'Redirect to success, account linking, or registration page',
			type: 'null'
		},
		400: {
			description: 'Missing or invalid code parameter',
			type: 'object',
			properties: {
				error: { type: 'string' }
			},
			example: { error: 'Missing code' }
		},
		404: {
			description: 'OAuth provider not found in database',
			type: 'object',
			properties: {
				error: { type: 'string' }
			},
			example: { error: 'OAuth provider not found' }
		},
		500: {
			description: 'Internal error during OAuth2 process (token exchange or user info)',
			type: 'object',
			properties: {
				error: { type: 'string' }
			},
			example: { error: 'No access token returned' }
		}
	}
};