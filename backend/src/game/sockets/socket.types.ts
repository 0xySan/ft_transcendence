/**
 * @file socket.types.ts
 * @description This file contains type definitions for socket communication in the game server.
 */

import WebSocket from 'ws';
import * as game from '../workers/game/game.types.js';

export interface gameSocket extends WebSocket {
	id: string; // user ID associated with the WebSocket connection
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
 */
export type msgType = "connect" | "player" | "playerSync" | "create" | "send" | "settings";

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
 * - **players**: Array of player objects:
 * 	- **playerId**: Unique identifier for the player.
 * 	- **displayName**: Display name of the player.
 * 	- **status**: Status of the player in the game.
 * 		- Possible values: **player**, **spectator**.
 */
export interface playerSyncPayload {
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
 * - **newSettings**: Partial configuration settings to be updated.
 */
export interface settingsPayload {
	gameId:			string;
	newSettings:	Partial<game.config>;
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
	| settingsPayload;