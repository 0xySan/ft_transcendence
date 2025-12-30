/**
 * @file loop.ts
 * @description Global game loop worker handling all games with start/pause/resume/abort.
 */

import { parentPort } from "worker_threads";
import { Game } from "./game.class.js";
import type * as msg from "../../sockets/socket.types.js";
import {
	createHandler,
	inputsHandler,
	playerHandler,
	settingsHandler
} from "./handlers.js";

/* -------------------------------------------------------------------------- */
/*                                   STATE                                    */
/* -------------------------------------------------------------------------- */

const games: Map<string, Game> = new Map();
const gameStates: Map<string, "playing" | "paused" | "stopped"> = new Map();
const accumulators: Map<string, number> = new Map();

const FIXED_DT = 1 / 60;
const MAX_DELTA = 0.2;

let lastTime = Date.now();

/* -------------------------------------------------------------------------- */
/*                                GAME LOOP                                   */
/* -------------------------------------------------------------------------- */

function gameLoop(): void {
	const now = Date.now();
	let deltaTime = (now - lastTime) / 1000;
	lastTime = now;

	if (deltaTime > MAX_DELTA)
		deltaTime = MAX_DELTA;

	games.forEach((game, gameId) => {
		if (gameStates.get(gameId) !== "playing")
			return;

		let accumulator = accumulators.get(gameId) ?? 0;
		accumulator += deltaTime;

		while (accumulator >= FIXED_DT) {
			stepGame(game, FIXED_DT);
			accumulator -= FIXED_DT;
		}

		accumulators.set(gameId, accumulator);
	});

	setImmediate(gameLoop);
}

gameLoop();

/* -------------------------------------------------------------------------- */
/*                               GAME STEP                                    */
/* -------------------------------------------------------------------------- */

function stepGame(game: Game, dt: number): void {
	game.currentFrameId += 1;
	const frameId = game.currentFrameId;

	const inputDelay = game.config.network.inputDelayFrames;
	const targetFrame = frameId - inputDelay;

	/* ---------------------------- INPUTS ----------------------------------- */

	game.players.forEach(player => {
		const frames = player.getInputsForFrame(targetFrame);
		if (frames && frames.length > 0)
			player.applyPersistentInputs(frames);

		if ((player as any).vy === undefined)
			(player as any).vy = 0;
	});

	/* ---------------------------- PADDLES ---------------------------------- */

	const padCfg = game.config.paddles;
	const world = game.config.world;
	const field = game.config.field;

	const orderedPlayers = [...game.players].sort((a, b) =>
		a.id.localeCompare(b.id)
	);

	orderedPlayers.forEach((player, index) => {
		const p = player as any;

		const leftX = field.wallThickness + padCfg.margin;
		const rightX =
			world.width
			- field.wallThickness
			- padCfg.margin
			- padCfg.width;

		p.x = index === 0 ? leftX : rightX;

		if (p.y === undefined)
			p.y = (world.height - padCfg.height) / 2;

		if (p.vy === undefined)
			p.vy = 0;

		const inputUp = p.activeInputs?.up ?? false;
		const inputDown = p.activeInputs?.down ?? false;

		if (inputUp && !inputDown)
			p.vy -= padCfg.acceleration * dt;
		else if (inputDown && !inputUp)
			p.vy += padCfg.acceleration * dt;
		else
			p.vy *= Math.pow(padCfg.friction, dt * 60);

		if (p.vy > padCfg.maxSpeed)
			p.vy = padCfg.maxSpeed;
		if (p.vy < -padCfg.maxSpeed)
			p.vy = -padCfg.maxSpeed;

		p.y += p.vy * dt;

		const top = field.wallThickness;
		const bottom = world.height - field.wallThickness - padCfg.height;

		if (p.y < top) {
			p.y = top;
			p.vy = 0;
		}
		if (p.y > bottom) {
			p.y = bottom;
			p.vy = 0;
		}
	});

	/* ------------------------------ BALL ----------------------------------- */

	if (!game.ball || game.ball.vx === 0) {
		const dir = Math.random() < 0.5 ? -1 : 1;

		game.ball = {
			x: world.width / 2,
			y: world.height / 2,
			vx: game.config.ball.initialSpeed * dir,
			vy: 0
		};
	}

	const ball = game.ball;

	ball.x += ball.vx * dt;
	ball.y += ball.vy * dt;

	if (ball.y - game.config.ball.radius <= field.wallThickness) {
		ball.y = field.wallThickness + game.config.ball.radius;
		ball.vy = Math.abs(ball.vy);
	}
	else if (ball.y + game.config.ball.radius >= world.height - field.wallThickness) {
		ball.y = world.height - field.wallThickness - game.config.ball.radius;
		ball.vy = -Math.abs(ball.vy);
	}

	for (const player of orderedPlayers) {
		const p = player as any;

		if (
			ball.x + game.config.ball.radius >= p.x &&
			ball.x - game.config.ball.radius <= p.x + padCfg.width &&
			ball.y >= p.y &&
			ball.y <= p.y + padCfg.height
		) {
			ball.vx = -ball.vx;

			const rel =
				(ball.y - p.y) / padCfg.height - 0.5;
			ball.vy += rel * game.config.ball.speedIncrement;
			break;
		}
	}

	if (ball.x < 0 || ball.x > world.width) {
		const scorer =
			ball.x < 0 ? orderedPlayers[1] : orderedPlayers[0];

		if (scorer)
			scorer.score = (scorer.score ?? 0) + 1;

		ball.x = world.width / 2;
		ball.y = world.height / 2;
		ball.vx =
			(ball.x < world.width / 2 ? 1 : -1)
			* game.config.ball.initialSpeed;
		ball.vy = 0;
	}

	/* ---------------------------- BROADCAST -------------------------------- */

	const syncRate = game.config.network.stateSyncRate;

	if (frameId % syncRate === 0) {
		const payload: msg.gameStatePayload = {
			frameId,
			ball: {
				position: { x: ball.x, y: ball.y },
				velocity: { x: ball.vx, y: ball.vy },
				radius: game.config.ball.radius
			},
			paddles: orderedPlayers.map(p => ({
				playerId: p.id,
				position: {
					x: (p as any).x,
					y: (p as any).y
				},
				width: padCfg.width,
				height: padCfg.height
			})),
			scores: orderedPlayers.map(p => ({
				playerId: p.id,
				score: p.score
			})),
			state: game.state
		};

		game.broadcast("game", payload);
	}
}

/* -------------------------------------------------------------------------- */
/*                              WORKER MESSAGES                               */
/* -------------------------------------------------------------------------- */

parentPort!.on("message", (message: msg.message<msg.payload>) => {
	switch (message.type) {
		case "create":
			createHandler(message as msg.message<msg.createPayload>, games);
			break;
		case "player":
			playerHandler(message as msg.message<msg.playerPayload>, games, gameStates);
			break;
		case "settings":
			settingsHandler(message as msg.message<msg.settingsPayload>, games);
			break;
		case "input":
			inputsHandler(message as msg.message<msg.workerInputPayload>, games);
			break;
		case "game": {
			const payload = message.payload as msg.workerGamePayload;
			const game = games.get(payload.gameId);
			if (!game)
				return;

			if (payload.userId && !game.isOwner(payload.userId))
				return;

			if (payload.action === "start") {
				if (game.players.length < 2)
					return;
				gameStates.set(payload.gameId, "playing");
				accumulators.set(payload.gameId, 0);
				game.broadcast("game", {
					action: "start",
					playerSides: game.getPlayerSidesMap(),
					startTime: Date.now() + 3000
				} as msg.gameStartAckPayload);
				return;
			}
			else if (payload.action === "pause")
				gameStates.set(payload.gameId, "paused");
			else if (payload.action === "resume")
				gameStates.set(payload.gameId, "playing");
			else if (payload.action === "abort") {
				gameStates.set(payload.gameId, "stopped");
				accumulators.delete(payload.gameId);
			}

			game.broadcast("game", { action: payload.action });
			break;
		}
	}
});
