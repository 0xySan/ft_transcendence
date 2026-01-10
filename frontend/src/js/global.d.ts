export {};

declare global {
	type NotificationType =
		| "info"
		| "success"
		| "warning"
		| "error";

	type NotifOptions = {
		type?: NotificationType;
		duration?: number;
	};

	interface Window {
		notify: (message: string, options?: NotifOptions) => void;
	}

	function notify(
		message: string,
		options?: NotifOptions
	): void;
}

/* -------------------------------------------------------------------------- */
/*  							Global   User                                 */
/* -------------------------------------------------------------------------- */

/** ### User Country
 * - type for user's country information
 * - Contains:
 * 		- **id**: number - country ID
 * 		- **name**: string - country name
 * 		- **code**: string - country code
 * 		- **flag**: string | null - SVG path or null for flag
 */
export interface UserCountry {
	id: number;
	name: string;
	code: string;
	flag: string | null; // SVG path or null
}

/** ### User Profile
 * - type for user's profile information
 * - Contains:
 * 		- **username**: string | null - username
 * 		- **displayName**: string | null - display name
 * 		- **profilePicture**: string | null - profile picture URL
 * 		- **bio**: string | null - user bio
 * 		- **country**: UserCountry | null - country information
 */
export interface UserProfile {
	username: string | null;
	displayName: string | null;
	profilePicture: string | null;
	bio: string | null;
	country: UserCountry | null;
}

/** ### User
 * - type for user information
 * - Contains:
 * 		- **id**: number - user ID
 * 		- **email**: string - user email
 * 		- **createdAt**: string - ISO date string of creation date
 * 		- **profile**: UserProfile | null - user profile information
 */
export interface UserData {
	id: number;
	email: string;
	createdAt: string; // ISO date string
	profile: UserProfile | null;
}