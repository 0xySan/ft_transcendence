/**
 * @file game.types.ts
 * @description This file contains type definitions for game configurations.
 */


/**
 * Configuration settings for the game.
 * - **game**: General game settings.
 * - **world**: Settings related to the game world dimensions.
 * - **field**: Settings for the playing field.
 * - **ball**: Settings for the ball behavior.
 * - **paddles**: Settings for the paddles.
 * - **scoring**: Scoring rules and settings.
 * - **timing**: Timing-related settings.
 * - **network**: Network-related settings.
 */
export interface config {
	game:		GameSettings;
	world:		WorldSettings;
	field:		FieldSettings;
	ball:		BallSettings;
	paddles:	PaddleSettings;
	scoring:	ScoringSettings;
	timing:		TimingSettings;
	network:	NetworkSettings;
}

/**
 * Game modes available.
 * - **online**: Standard online multiplayer mode.
 * - **local**: Local multiplayer mode.
 * - **tournament**: Competitive tournament mode.
 */
export type mode = "online" | "local" | "tournament";

export type state = "waiting" | "playing" | "ended";

/**
 * General game settings.
 * - **mode**: The mode of the game.
 * - **code**: The unique code for the game room.
 * - **maxPlayers**: Maximum number of players allowed in the game.
 * - **spectatorsAllowed**: Whether spectators are allowed in the game.
 */
export interface GameSettings {
	/** The mode of the game. */
	mode:				mode;
	/** The unique code for the game room. */
	code:				string;
	/** The maximum number of players allowed in the game. */
	maxPlayers:			number;
	/** Whether spectators are allowed in the game. */
	spectatorsAllowed:	boolean;
}

/**
 * World dimensions settings.
 * - **width**: Width of the game world.
 * - **height**: Height of the game world.
 */
export interface WorldSettings {
	/** Width of the game world. */
	width:	number;
	/** Height of the game world. */
	height:	number;
}

/**
 * Field settings.
 * - **wallBounce**: Whether the ball bounces off the walls.
 * - **wallThickness**: Thickness of the walls.
 */
export interface FieldSettings {
	/** Whether the ball bounces off the walls. */
	wallBounce:		boolean;
	/** Thickness of the walls. */
	wallThickness:	number;
}

/**
 * Ball settings.
 * - **radius**: Radius of the ball.
 * - **initialSpeed**: Initial speed of the ball.
 * - **maxSpeed**: Maximum speed the ball can reach.
 * - **speedIncrement**: Speed increment after each hit.
 * - **initialAngleRange**: Range of initial angles for ball serve.
 * - **maxBounceAngle**: Maximum angle for ball bounce off paddles.
 * - **allowSpin**: Whether spin effects are enabled.
 * - **spinFactor**: Factor determining the effect of spin on ball trajectory.
 * - **resetOnScore**: Whether the ball resets to initial position on scoring.
 */
export interface BallSettings {
	/** Radius of the ball. */
	radius:				number;

	/** Initial speed of the ball. */
	initialSpeed:		number;
	/** The maximum speed the ball can reach. */
	maxSpeed:			number;
	/** Speed increment after each hit. */
	speedIncrement:		number;

	/** The range of initial angles for ball serve. */
	initialAngleRange:	number;
	/** Maximum angle for ball bounce off paddles. */
	maxBounceAngle:		number;

	/** Whether spin effects are enabled. */
	allowSpin:			boolean;
	/** Factor determining the effect of spin on ball trajectory. */
	spinFactor:			number;

	/** Whether the ball resets to initial position on scoring. */
	resetOnScore:		boolean;
}

/**
 * Paddle settings.
 * - **width**: Width of the paddle.
 * - **height**: Height of the paddle.
 * - **margin**: Margin from the edge of the field.
 * - **maxSpeed**: Maximum speed of paddle movement.
 * - **acceleration**: Acceleration rate of the paddle.
 * - **friction**: Friction applied to paddle movement.
 */
export interface PaddleSettings {
	/** Width of the paddle. */
	width:			number;
	/** Height of the paddle. */
	height:			number;

	/** Margin from the edge of the field. */
	margin:			number;

	/** Maximum speed of paddle movement. */
	maxSpeed:		number;
	/** Acceleration rate of the paddle. */
	acceleration:	number;
	/** Friction applied to paddle movement. */
	friction:		number;
}

/**
 * Scoring settings.
 * - **firstTo**: Number of points to win the game.
 * - **winBy**: Minimum point difference required to win.
 */
export interface ScoringSettings {
	/** Number of points to win the game. */
	firstTo:	number;
	/** Minimum point difference required to win. */
	winBy:		number;
}

/** Timing settings.
 * - **tickRate**: Number of game ticks per second.
 * - **serveDelayMs**: Delay in milliseconds before serving the ball.
 */
export interface TimingSettings {
	/** Number of game ticks per second. */
	tickRate:		number;
	/** Delay in milliseconds before serving the ball. */
	serveDelayMs:	number;
}

/** Network settings.
 * - **inputDelayFrames**: Number of frames to delay input for synchronization.
 * - **stateSyncRate**: Rate at which the game state is synchronized over the network.
 */
export interface NetworkSettings {
	/** Number of frames to delay input for synchronization. */
	inputDelayFrames:	number;
	/** Rate at which the game state is synchronized over the network. */
	stateSyncRate:		number;
}
