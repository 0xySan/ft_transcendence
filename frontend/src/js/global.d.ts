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

/** ### Ball Settings
 * - settings related to the ball
 * - Contains:
 * 		- **radius**: number - ball radius
 * 		- **initialSpeed**: number - initial speed
 * 		- **maxSpeed**: number - maximum speed
 * 		- **speedIncrement**: number - speed increment on hit
 * 		- **initialAngleRange**: number - initial angle range
 * 		- **maxBounceAngle**: number - maximum bounce angle
 * 		- **allowSpin**: boolean - is spin allowed
 * 		- **spinFactor**: number - spin factor
 * 		- **resetOnScore**: boolean - reset ball on score
 */
export interface BallSettings {
	radius: number;
	initialSpeed: number;
	maxSpeed: number;
	speedIncrement: number;
	initialAngleRange: number;
	maxBounceAngle: number;
	allowSpin: boolean;
	spinFactor: number;
	resetOnScore: boolean;
}

/** ### Paddle Settings
 * - settings related to paddles
 * - Contains:
 * 		- **width**: number - paddle width
 * 		- **height**: number - paddle height
 * 		- **margin**: number - distance from wall
 * 		- **maxSpeed**: number - maximum speed
 * 		- **acceleration**: number - acceleration rate
 * 		- **friction**: number - friction factor
 */
export interface PaddleSettings {
	width: number;
	height: number;
	margin: number;
	maxSpeed: number;
	acceleration: number;
	friction: number;
}

/** ### Field Settings
 * - settings related to the game field
 * - Contains:
 * 		- **wallThickness**: number - thickness of the walls
 */
export interface FieldSettings {
	wallThickness: number;
}

/** ### World Settings
 * - settings related to the game world dimensions
 * - Contains:
 * 		- **width**: number - world width
 * 		- **height**: number - world height
 */
export interface WorldSettings {
	width: number;
	height: number;
}

/** ### Game Settings
 * - settings related to game mode and spectators
 * - Contains:
 * 		- **mode**: string - game mode
 * 		- **spectatorsAllowed**: boolean - are spectators allowed
 */
export interface GameSettings {
	mode: string;
	spectatorsAllowed: boolean;
	maxPlayers: 2 | 4;
	code?: string;
	visibility: boolean;
}

/** ### Scoring Settings
 * - settings related to scoring
 * - Contains:
 * 		- **firstTo**: number - points to win
 * 		- **winBy**: number - points difference to win
 */
export interface ScoringSettings {
	firstTo: number;
	winBy: number;
}

/** ### Settings
 * - comprehensive settings interface
 * - Contains:
 * 		- **game**: GameSettings
 * 		- **scoring**: ScoringSettings
 * 		- **ball**: BallSettings
 * 		- **paddles**: PaddleSettings
 * 		- **field**: FieldSettings
 * 		- **world**: WorldSettings
 */
export interface Settings {
	game: GameSettings;
	scoring: ScoringSettings;
	ball: BallSettings;
	paddles: PaddleSettings;
	field: FieldSettings;
	world: WorldSettings;
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


/** ### Player Payload
 * - type for player join/leave events
 * - Contains:
 * 		- **playerId**: string - player ID
 * 		- **displayName**: string - player display name
 * 		- **status**: "player" | "spectator" - player status
 * 		- **action**: "join" | "leave" - action performed
 */
export type PlayerPayload = {
	playerId: string;
	displayName: string;
	status: "player" | "spectator";
	action: "join" | "leave";
};