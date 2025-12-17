/**
 * @file socket.types.ts
 * @description This file contains type definitions for socket communication in the game server.
 */

import WebSocket from 'ws';
import * as game from '../workers/game/game.types.js';

/**
 * Extended WebSocket interface with additional properties.
 * - **id**: Unique identifier for the connected user.
 * - **gameId**: Current game ID the user is connected to.
 */
export interface gameSocket extends WebSocket {
	/** Unique identifier for the connected user */
	id:		string;
	/** Current game ID the user is connected to */
	gameId:	string;
}

// ===================================
// 			Pending Connections
// ===================================

/**
 * Represents a pending connection with user and game identifiers.
 * - **userId**: Unique identifier for the user.
 * - **gameId**: Unique identifier for the game.
 * - **expiresAt**: Timestamp indicating when the pending connection expires.
 */
export interface pendingConnection {
	userId:		string;
	gameId:		string;
	expiresAt:	number;
}

// ===================================
// 			Message Types
// ===================================

/**
 * Type of message being sent or received.
 * - **connect**: Client tries to connect with token. - `socket` only.
 * - **player**: Player join/leave notification. - `socket` and `worker`.
 * - **playerSync**: Synchronize player list. - `socket` and `worker`.
 * - **create**: Create a new game. - `worker` only.
 * - **send**: Generic send message.
 * - **settings**: Update game settings. - `socket` and `worker`.
 * - **game**: Game control message (start/pause/resume/abort). - `socket` and `worker`.
 * - **input**: Player input frames. - `socket` and `worker`.
 */
export type msgType = "connect" | "player" | "playerSync" | "create" | "send" | "settings" | "game" | "input";

/**
 * Generic message interface for socket communication.
 * - **type**: The type of message being sent or received.
 * - **payload**: The data associated with the message, of generic type `T`.
 */
export interface message<T> {
	type:		msgType;
	payload:	T;
}

// ===================================
// 			Payload Types
// ===================================

/**
 * Authentication token sent by the client at connection.
 */
export type AuthToken = string;

/**
 * Payload structure for "connect" message type.
 * - **token**: Authentication token for the user.
 */
export interface connectPayload {
	token:	AuthToken;
}

/**
 * Payload structure for "create" message type.
 * - **uuid**: Unique identifier for the game to be created.
 * - **ownerId**: Owner ID of the game.
 * - **gameConfig**: Configuration settings for the game to be created.
 */
export interface createPayload {
	uuid:		string;
	ownerId:	string;
	gameConfig:	game.config;
}

export type playerConnectAction = "join" | "leave";
export type playerStatus = "player" | "spectator";

/**
 * Payload structure used to announce a player joining or leaving.
 * - **playerId**: Unique identifier for the player.
 * - **displayName**: Display name of the player.
 * - **action**: Action indicating whether the player is joining or leaving.
 * 	- Possible values: **join**, **leave**.
 */
export interface playerPayload {
	playerId:		string;
	displayName:	string;
	status:			playerStatus;
	action:			playerConnectAction;
}

/**
 * Payload structure for synchronizing the list of players in a game.
 * - **ownerId**: Unique identifier for the owner of the game.
 * - **players**: Array of player objects:
 * 	- **playerId**: Unique identifier for the player.
 * 	- **displayName**: Display name of the player.
 * 	- **status**: Status of the player in the game.
 * 		- Possible values: **player**, **spectator**.
 */
export interface playerSyncPayload {
	ownerId:		string;
	players: Array<{
		playerId:		string;
		displayName:	string;
		status:			playerStatus;
	}>;
}

/**
 * Payload structure for worker thread to handle player actions with WebSocket.
 * - **playerId**: Unique identifier for the player.
 * - **displayName**: Display name of the player.
 * - **status**: Status of the player in the game.
 * 		- Possible values: **player**, **spectator**.
 * - **action**: Action indicating whether the player is joining or leaving.
 * 	- Possible values: **join**, **leave**.
 * - **gameId**: Unique identifier for the game.
 */
export interface workerPlayerPayload  extends playerPayload {
	gameId:		string;
}

/**
 * Payload structure for updating game settings.
 * - **gameId**: Unique identifier for the game.
 * - **userId**: Unique identifier for the user requesting the update.
 * - **newSettings**: Partial configuration settings to be updated.
 */
export interface settingsPayload {
	gameId:			string;
	userId:			string;
	newSettings:	Partial<game.config>;
}

/**
 * Possible actions that can be performed on a game.
 * - **start**: Start the game.
 * - **pause**: Pause the game.
 * - **resume**: Resume the game.
 * - **abort**: Abort the game.
 */
export type gameAction = "start" | "pause" | "resume" | "abort";

/**
 * Payload structure for game control messages.
 * - **action**: Action to be performed on the game.
 * 	- Possible values: **start**, **pause**, **resume**, **abort**.
 */
export interface gamePayload {
	action: gameAction;
}

/**
 * Payload structure for worker thread to handle game control messages.
 * - **gameId**: Unique identifier for the game.
 * - **action**: Action to be performed on the game.
 * 	- Possible values: **start**, **pause**, **resume**, **abort**.
 */
export interface workerGamePayload extends gamePayload {
	gameId: string;
}

/**
 * Structure representing a single game input.
 * - **key**: The key associated with the input.
 * - **pressed**: Boolean indicating whether the key is pressed (true) or released (false).
 */
export interface gameInput {
	key:		string;
	pressed:	boolean;
}

/**
 * Structure representing a frame of inputs.
 * - **frameId**: The unique identifier for the frame.
 * - **inputs**: Array of game inputs associated with the frame.
 */
export interface inputFrame {
	frameId:	number;
	inputs:		gameInput[];
}

/**
 * Payload structure for sending multiple frames of inputs.
 * - **inputs**: Array of input frames.
 */
export interface inputPayload {
	inputs: inputFrame[];
}

/**
 * Payload structure for worker thread to handle game inputs.
 * - **gameId**: Unique identifier for the game.
 * - **userId**: Unique identifier for the user sending the inputs.
 */
export interface workerInputPayload extends inputPayload {
	gameId: string;
	userId: string;
}

/**
 * Payload structure for a full game state update.
 * Sent from worker to sockets.
 */
export interface gameStatePayload {
	/** Current simulation frame */
	frameId:	number;

	/** Ball state */
	ball:		game.ballState;

	/** All paddles indexed by player */
	paddles:	game.paddleState[];

	/** Optional scores */
	scores?:	Array<{
		playerId:	string;
		score:		number;
	}>;

	/** Optional game state */
	state?:	game.state; // "waiting" | "playing" | "ended"
}



/**
 * Union type of all possible payloads.
 */
export type payload =
	| connectPayload
	| createPayload
	| playerPayload
	| workerPlayerPayload
	| playerSyncPayload
	| settingsPayload
	| gamePayload
	| workerGamePayload
	| inputPayload
	| workerInputPayload
	| gameStatePayload;