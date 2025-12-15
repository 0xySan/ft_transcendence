/**
 * @file loop.ts
 * @description Global game loop worker handling all games with start/pause/resume/abort.
 */

import { parentPort } from "worker_threads";
import { Game } from "./game.class.js";
import type * as msg from "../../sockets/socket.types.js";
import { createHandler, inputsHandler, playerHandler, settingsHandler } from "./handlers.js";

const games: Map<string, Game> = new Map();
const gameStates: Map<string, "playing" | "paused" | "stopped"> = new Map();

let lastTime = Date.now();
let running = true;

// -----------------------------------
// Main loop
// -----------------------------------
function gameLoop() {
	const now = Date.now();
	const deltaTime = (now - lastTime) / 1000; // in seconds
	lastTime = now;

	if (running) {
		games.forEach((game, id) => {
			const state = gameStates.get(id);
			if (state === "playing") {
				// call your game update logic
				updateGame(game, deltaTime);
			}
		});
	}

	setImmediate(gameLoop);
}

// Start the loop
gameLoop();

// -----------------------------------
// Game update logic
// -----------------------------------
function updateGame(game: Game, deltaTime: number) {
	// Example: move balls, update paddles, check collisions...
	// This should be your existing game tick logic

	// After updating, broadcast new state if needed
	game.broadcast("game", { action: "update", deltaTime } as any);
}

// -----------------------------------
// Message handler
// -----------------------------------
parentPort!.on("message", (msg: msg.message<msg.payload>) => {
	switch (msg.type) {
		case "create":
			createHandler(msg as msg.message<msg.createPayload>, games);
			break;

		case "player":
			playerHandler(msg as msg.message<msg.playerPayload>, games);
			break;

		case "settings":
			settingsHandler(msg as msg.message<msg.settingsPayload>, games);
			break;

		case "input":
			inputsHandler(msg as msg.message<msg.workerInputPayload>, games);
			break;

		case "game": {
			const payload = msg.payload as msg.workerGamePayload;
			const gameId = payload.gameId; // make sure gameId is in payload
			const game = games.get(gameId);
			if (!game) return;

			switch (payload.action) {
				case "start":
					gameStates.set(gameId, "playing");
					break;
				case "pause":
					gameStates.set(gameId, "paused");
					break;
				case "resume":
					gameStates.set(gameId, "playing");
					break;
				case "abort":
					gameStates.set(gameId, "stopped");
					break;
			}
			break;
		}

		default:
			console.warn(`Unknown message type received in game loop: ${msg.type}`);
	}
});
