/**
 * @file loop.ts
 * @description This file contains the main game loop worker that handles game messages.
 */

import { parentPort } from "worker_threads";
import { Game } from "./game.class.js";
import type * as msg from "../../sockets/socket.types.js";
import { createHandler, playerHandler, settingsHandler } from "./handlers.js";

const games: Map<string, Game> = new Map();

parentPort!.on("message", (msg: msg.message<msg.payload>) => {
	switch (msg.type) {
		case "create": {
			createHandler(msg as msg.message<msg.createPayload>, games);
			break;
		}
		case "player": {
			playerHandler(msg as msg.message<msg.playerPayload>, games);
			break;
		}
		case "settings": {
			settingsHandler(msg as msg.message<msg.settingsPayload>, games);
			break;
		}
		default:
			console.warn(`Unknown message type received in game loop: ${msg.type}`);
	}
});