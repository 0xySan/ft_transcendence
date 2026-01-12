/**
 * @file parseMessage.ts
 * @description This file contains utility functions to parse incoming WebSocket messages.
 */

import * as socket from "../socket.types.js";
import { 
	parseConnectPayload,
	parseInputPayload,
	parseGamePayload
} from "../handlers/index.js";

/**
 * General message parser
 * @brief Parses a raw JSON string into a typed message object.
 * @param raw - raw JSON string
 * @returns parsed message or null if invalid
 */
export function parseMessage(raw: string): socket.message<socket.payload> | null {
	try {
		const parsed = JSON.parse(raw);

		if (typeof parsed !== "object" || !parsed.type || !("payload" in parsed)) return null;

		const validTypes: socket.msgType[] = ["connect", "send", "game", "input"];
		if (!validTypes.includes(parsed.type as socket.msgType)) return null;

		const type = parsed.type as socket.msgType;
		const payload = parsePayload(type, parsed.payload);
		if (!payload) return null;

		return { type, payload };
	} catch {
		return null;
	}
}

/**
 * Payload parser based on message type
 * @param type - message type
 * @param payload - raw payload
 * @returns - parsed payload or null
 */
function parsePayload(type: socket.msgType, payload: any): socket.payload | null {
	switch (type) {
		case "connect": return parseConnectPayload(payload);
		case "game": return parseGamePayload(payload);
		case "input": return parseInputPayload(payload);
		default: return null;
	}
}
