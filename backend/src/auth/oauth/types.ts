/**
 * @file OAuth types and constants
 * Contains types and URIs for OAuth providers.
 */

/**
 * OAuth token response
 */
export interface Token {
	access_token:		string;
	token_type:			string;
	expires_in?:		number;
	refresh_token?:		string;
	scope?:				string;
	id_token?:			string;	// Google only
	[extra: string]:	any;	// Provider-specific fields
}

/**
 * Supported OAuth provider names
 */
export const ProvidersUri = {
	google:			'https://oauth2.googleapis.com/token',
	github:			'https://github.com/login/oauth/access_token',
	discord:		'https://discord.com/api/oauth2/token',
	'forty-two':	'https://api.intra.42.fr/oauth/token'
} as const;

export type ProviderName = keyof typeof ProvidersUri;

/**
 * API URIs to fetch user info
 */
export const ProvidersApiUri = {
	google:			'https://www.googleapis.com/oauth2/v2/userinfo',
	github:			'https://api.github.com/user',
	discord:		'https://discord.com/api/users/@me',
	'forty-two':	'https://api.intra.42.fr/v2/me'
} as const;

interface UserInfoBase {
	id:			string;
	email:		string;
}

interface GUserInfo extends UserInfoBase {
	verified_email?:	boolean;
	name:				string;
}

/**
 * Google OAuth user info
 */
export interface GoogleUserInfo extends GUserInfo {
	picture?:			string;
}

/**
 * GitHub OAuth user info
 */
export interface GithubUserInfo extends GUserInfo {
	avatar_url?:string;
}

/**
 * Discord OAuth user info
 */
export interface DiscordUserInfo extends UserInfoBase {
	username:	string;
	avatar?:	string;
}

/**
 * 42 OAuth user info
 */
export interface FortyTwoUserInfo extends UserInfoBase {
	login: string;
	usual_first_name: string;
	usual_full_name: string;
	first_name: string;
	last_name: string;
	displayname: string;
	image: {
		link: string;
	};
}

export type UserInfo =
	| GoogleUserInfo
	| GithubUserInfo
	| DiscordUserInfo
	| FortyTwoUserInfo;

/**
 * Normalized user info across providers
 * Used to standardize user data from different OAuth providers.
 * @contains :
 * - id: Provider-specific user ID
 * - email: User's email address
 * - username: User's display name
 * - avatar: (optional) URL to user's avatar image
 */
export interface NormalizedUserInfo {
	/** The provider-specific user ID */
	id: string;
	/** The user's email address */
	email: string;
	/** The user's display name */
	username: string;
	/** URL to the user's avatar image (optional) */
	avatar?: string;
}

/**
 * Normalizes user info from various OAuth providers into a standard format.
 * @param user - Raw user info from the OAuth provider
 * @param provider - Name of the OAuth provider
 * @returns Normalized user info
 * @throws Error if required fields are missing or provider is unknown
 */
export function normalizeUserInfo(user: UserInfo, provider: ProviderName): NormalizedUserInfo {
	if (!user || !user.id) throw new Error('User info is missing id');
	if (!user.email) throw new Error('User info is missing email');

	switch (provider) {
		case 'google': {
			const googleUser = user as GoogleUserInfo;
			if (!googleUser.name) throw new Error('Google user info missing name');
			return {
				id: googleUser.id,
				email: googleUser.email,
				username: googleUser.name,
				avatar: googleUser.picture
			};
		}
		case 'github': {
			const githubUser = user as GithubUserInfo;
			if (!githubUser.name) throw new Error('GitHub user info missing name');
			return {
				id: githubUser.id,
				email: githubUser.email,
				username: githubUser.name,
				avatar: githubUser.avatar_url
			};
		}
		case 'discord': {
			const discordUser = user as DiscordUserInfo;
			if (!discordUser.username) throw new Error('Discord user info missing username');
			const avatarUrl = discordUser.avatar
				? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${discordUser.avatar.startsWith('a_') ? 'gif' : 'png'}`
				: `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(discordUser.id) % 5n)}.png`;
			return {
				id: discordUser.id,
				email: discordUser.email,
				username: discordUser.username,
				avatar: avatarUrl
			};
		}
		case 'forty-two': {
			const ftUser = user as FortyTwoUserInfo;
			if (!ftUser.login) throw new Error('42 user info missing login');
			return {
				id: ftUser.id,
				email: ftUser.email,
				username: ftUser.usual_first_name || ftUser.first_name || ftUser.login,
				avatar: ftUser.image?.link
			};
		}
		default:
			throw new Error(`Unknown OAuth provider: ${provider}`);
	}
}