/**
 * @file connect.ts
 * @description This file contains the handler and parser for the "connect" WebSocket message.
 */

import { IncomingMessage } from "http";

import * as socket from "../socket.types.js";
import { activeGames, wsPendingConnections } from "../../../globals.js";

import { checkTokenValidity } from '../../../utils/session.js';
import { addOrRemovePlayerGameWorker } from "../../workers/init.js";
import { getProfileByUserId } from "../../../db/index.js";

/**
 * Specific parser for "connect" payload
 * @param payload - raw payload
 * @returns validated payload or null
 */
export function parseConnectPayload(payload: any): socket.payload | null {
	if (!payload) return null;
	if (typeof payload.token !== "string") return null;
	return {
		token: payload.token as socket.AuthToken, // ensure type
	};
}

/**
 * Get cookie from request
 * @param req - IncomingMessage
 * @param name - cookie name
 * @returns cookie value or null
 */
function getCookie(req: IncomingMessage, name: string): string | null {
	const cookieHeader = req.headers.cookie;
	if (!cookieHeader) return null;

	// cookieHeader = "key1=value1; key2=value2; ..."
	const cookies = cookieHeader.split(";").map(c => c.trim());
	for (const c of cookies) {
		const [key, value] = c.split("=");
		if (key === name) return decodeURIComponent(value);
	}
	return null;
}

/**
 * Handle "connect" message
 * @brief Validates the connection token and establishes the WebSocket connection if valid. 
 * @param ws - WebSocket connection
 * @param req - Incoming HTTP request
 * @param payload - connectPayload
 * @param onSuccess - callback on successful connection (to clear timeout)
 * @returns void
 */
export function handleConnectMessage(
	ws:			socket.gameSocket,
	req:		IncomingMessage,
	payload:	socket.connectPayload,
	onSuccess:	() => void
) {
	// Check if the token exists in the pending connections map
	const pending: socket.pendingConnection | undefined = wsPendingConnections.get(payload.token);
	if (!pending) {
		ws.send(JSON.stringify({ type: "error", payload: "Invalid token" }));
		return ws.close();
	}

	// Validate the token/session
	const cookieSession = getCookie(req, "session");
	if (!cookieSession) {
		ws.send(JSON.stringify({ type: "error", payload: "No session cookie found" }));
		return ws.close();
	}

	const sessionValid = checkTokenValidity(cookieSession);
	if (!sessionValid || !sessionValid.isValid) {
		ws.send(JSON.stringify({ type: "error", payload: "Session expired or invalid" }));
		return ws.close();
	}

	if (sessionValid.session?.user_id !== pending.userId) {
		ws.send(JSON.stringify({ type: "error", payload: "Token does not match user" }));
		return ws.close();
	}

	console.log(`Attemtping to connect user: ${pending.userId} to game: ${pending.gameId} with token: ${payload.token}`);

	// Token valid -> remove from map
	wsPendingConnections.delete(payload.token);
	onSuccess(); // clear timeout
	ws.id = pending.userId; // associate user ID with WebSocket
	const userProfile = getProfileByUserId(pending.userId);
	// Try to use display_name, fallback to username then "Guest"
	const username = userProfile ?
		userProfile.display_name ? 
			userProfile.display_name : 
			userProfile.username 
		: "Guest";
	const result = addOrRemovePlayerGameWorker(pending.userId, username, "join");

	if (!result) {
		ws.send(JSON.stringify({ type: "error", payload: "Failed to join game" }));
		return ws.close();
	}
	for (const [gameId, gameObj] of activeGames.entries()) {
		if (gameObj.players.has(pending.userId)) {
			gameObj.players.set(pending.userId, ws);
		}
	}
	// Send acknowledgment to client
	ws.send(JSON.stringify({ type: "connect", payload: "Connection established" }));
}
