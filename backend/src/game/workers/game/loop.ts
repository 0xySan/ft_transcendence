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

// per-game accumulators for fixed timestep
const accumulators: Map<string, number> = new Map();

// safety limits
const MAX_DELTA = 0.2; // clamp dt to 200ms to avoid spiral

let lastTime = Date.now();
let running = true;

function gameLoop() {
	const now = Date.now();
	let deltaTime = (now - lastTime) / 1000; // seconds
	lastTime = now;

	// clamp very large deltas (e.g. when paused / debugger)
	if (deltaTime > MAX_DELTA) deltaTime = MAX_DELTA;

	if (running) {
		games.forEach((game, id) => {
			const state = gameStates.get(id);
			if (state !== "playing") return;

			// ensure accumulator exists
			if (!accumulators.has(id)) accumulators.set(id, 0);
			const acc = (accumulators.get(id) ?? 0) + deltaTime;
			accumulators.set(id, acc);

			// fixed timestep based on game tickRate
			const tickRate = game.config?.timing?.tickRate ?? 60;
			const fixedDt = 1 / tickRate;

			// run zero or more fixed steps
			let accumulator = accumulators.get(id) ?? 0;
			while (accumulator >= fixedDt) {
				stepGame(game, fixedDt);
				accumulator -= fixedDt;
			}
			accumulators.set(id, accumulator);
		});
	}

	setImmediate(gameLoop);
}

// start
gameLoop();

/**
 * Perform one deterministic simulation step for a game using dt (seconds).
 */
function stepGame(game: Game, dt: number) {
	// ensure basic runtime fields exist on game
	if ((game as any).currentFrameId === undefined) (game as any).currentFrameId = 0;
	if ((game as any).ball === undefined) (game as any).ball = null;
	if ((game as any).lastScorer === undefined) (game as any).lastScorer = null;

	// increment frame counter (deterministic)
	(game as any).currentFrameId += 1;
	const frameId: number = (game as any).currentFrameId;

	// target frame to consume = frameId - inputDelayFrames
	const inputDelay = game.config.network.inputDelayFrames ?? 0;
	const targetFrame = frameId - inputDelay;

	// ---------- 1) process inputs for this targetFrame ----------
	// For each player: consume inputs for that frame and update input flags
	game.players.forEach(player => {
		// NOTE: Player must expose getInputsForFrame(frameId) that removes the frame from buffer
		const frames = player.getInputsForFrame(targetFrame); // returns gameInput[]
		// maintain simple input state flags on player (up/down)
		if ((player as any).inputUp === undefined) (player as any).inputUp = false;
		if ((player as any).inputDown === undefined) (player as any).inputDown = false;
		if ((player as any).vy === undefined) (player as any).vy = 0;

		for (const input of frames) {
			switch (input.key) {
				case "up":
					(player as any).inputUp = input.pressed;
					break;
				case "down":
					(player as any).inputDown = input.pressed;
					break;
				// add more keys as needed
			}
		}
	});

	// ---------- 2) update paddles using simple acceleration + friction ----------
	const accel = game.config.paddles.acceleration ?? 1000;
	const friction = game.config.paddles.friction ?? 0.9;
	const maxSpeed = game.config.paddles.maxSpeed ?? 400;

	game.players.forEach(player => {
		// ensure position/velocity exist on player
		if ((player as any).y === undefined) (player as any).y = (game.config.world.height - game.config.paddles.height) / 2;
		if ((player as any).x === undefined) (player as any).x = (player as any).x ?? (player === game.players[0] ? game.config.paddles.margin : (game.config.world.width - game.config.paddles.margin - game.config.paddles.width));
		if ((player as any).vy === undefined) (player as any).vy = 0;

		const inputUp = !!(player as any).inputUp;
		const inputDown = !!(player as any).inputDown;

		// simple control: accelerate towards direction while pressed; otherwise apply friction
		if (inputUp && !inputDown) {
			(player as any).vy -= accel * dt;
		} else if (inputDown && !inputUp) {
			(player as any).vy += accel * dt;
		} else {
			// friction / damping
			(player as any).vy *= Math.pow(friction, dt * 60); // frame-rate independent damping
		}

		// clamp speed
		if ((player as any).vy > maxSpeed) (player as any).vy = maxSpeed;
		if ((player as any).vy < -maxSpeed) (player as any).vy = -maxSpeed;

		// integrate
		(player as any).y += (player as any).vy * dt;

		// clamp to world bounds (consider wall thickness)
		const topBound = game.config.field.wallThickness;
		const bottomBound = game.config.world.height - game.config.field.wallThickness - game.config.paddles.height;
		if ((player as any).y < topBound) {
			(player as any).y = topBound;
			(player as any).vy = 0;
		}
		if ((player as any).y > bottomBound) {
			(player as any).y = bottomBound;
			(player as any).vy = 0;
		}
	});

	// ---------- 3) ensure ball exists ----------
	if (!(game as any).ball) {
		// initial serve: send to lastScorer opposite direction or random
		const sign = (game as any).lastScorer === game.players[0]?.id ? -1 : 1;
		(game as any).ball = {
			x: game.config.world.width / 2,
			y: game.config.world.height / 2,
			vx: (game.config.ball.initialSpeed ?? 400) * sign,
			vy: 0
		};
	}

	const ball = (game as any).ball;

	// ---------- 4) integrate ball ----------
	ball.x += ball.vx * dt;
	ball.y += ball.vy * dt;

	// top/bottom wall collisions
	if (ball.y - game.config.ball.radius <= 0) {
		ball.y = game.config.ball.radius;
		ball.vy = Math.abs(ball.vy);
	} else if (ball.y + game.config.ball.radius >= game.config.world.height) {
		ball.y = game.config.world.height - game.config.ball.radius;
		ball.vy = -Math.abs(ball.vy);
	}

	// ---------- 5) paddle collisions (single collision per step) ----------
	let collided = false;
	for (const player of game.players) {
		// paddle bounds
		const paddleLeft = (player as any).x;
		const paddleRight = (player as any).x + game.config.paddles.width;
		const paddleTop = (player as any).y;
		const paddleBottom = (player as any).y + game.config.paddles.height;

		// check AABB overlap
		const intersects =
			ball.x + game.config.ball.radius >= paddleLeft &&
			ball.x - game.config.ball.radius <= paddleRight &&
			ball.y >= paddleTop &&
			ball.y <= paddleBottom;

		if (intersects) {
			// reflect horizontally
			ball.vx = -ball.vx;

			// adjust vy based on hit position (center -> 0, edges -> +/-)
			const rel = (ball.y - paddleTop) / game.config.paddles.height; // [0..1]
			const hitPos = (rel - 0.5); // -0.5 .. 0.5
			ball.vy += hitPos * (game.config.ball.speedIncrement ?? 20);

			// optional: increase speed up to max
			const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
			const maxSpeed = game.config.ball.maxSpeed ?? 800;
			if (speed > maxSpeed) {
				const scale = maxSpeed / speed;
				ball.vx *= scale;
				ball.vy *= scale;
			}

			collided = true;
			break; // only one collision per step
		}
	}

	// ---------- 6) scoring (single check) ----------
	if (ball.x < 0) {
		// right player scores
		const right = game.players[1] ?? game.players.find(p => (p as any).x > game.config.world.width / 2);
		if (right) right.score = (right.score ?? 0) + 1;
		(game as any).lastScorer = right?.id ?? null;
		// reset ball to center, serve towards scorer's side
		ball.x = game.config.world.width / 2;
		ball.y = game.config.world.height / 2;
		ball.vx = Math.abs(game.config.ball.initialSpeed ?? 400);
		ball.vy = 0;
	}

	if (ball.x > game.config.world.width) {
		// left player scores
		const left = game.players[0] ?? game.players.find(p => (p as any).x <= game.config.world.width / 2);
		if (left) left.score = (left.score ?? 0) + 1;
		(game as any).lastScorer = left?.id ?? null;
		ball.x = game.config.world.width / 2;
		ball.y = game.config.world.height / 2;
		ball.vx = -Math.abs(game.config.ball.initialSpeed ?? 400);
		ball.vy = 0;
	}

	// ---------- 7) periodic state broadcast ----------
	const stateSyncRate = game.config.network.stateSyncRate ?? Math.max(1, Math.floor((game.config.timing.tickRate ?? 60) / 2));
	// broadcast only every N frames (avoid sending every step if configured)
	if (frameId % stateSyncRate === 0) {
		// build gameStatePayload
		const gameState: msg.gameStatePayload = {
			frameId: frameId,
			ball: {
				position: { x: ball.x, y: ball.y },
				velocity: { x: ball.vx, y: ball.vy },
				radius: game.config.ball.radius
			},
			paddles: game.players.map(p => ({
				playerId: p.id,
				position: { x: (p as any).x, y: (p as any).y },
				width: game.config.paddles.width,
				height: game.config.paddles.height
			})),
			scores: game.players.map(p => ({ playerId: p.id, score: p.score })),
			state: game.state
		};

		// use explicit "gameState" message type on broadcast
		game.broadcast("game", gameState);
	}
}

/* -----------------------------------
   Message handler (unchanged)
   ----------------------------------- */
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
			const gameId = payload.gameId;
			const game = games.get(gameId);
			if (!game) return;

			switch (payload.action) {
				case "start":
					if (game.players.length < 2) {
						console.warn(`Cannot start game ${gameId}: not enough players.`);
						return;
					}
					gameStates.set(gameId, "playing");
					// ensure accumulator exists
					if (!accumulators.has(gameId)) accumulators.set(gameId, 0);
					break;
				case "pause":
					gameStates.set(gameId, "paused");
					break;
				case "resume":
					gameStates.set(gameId, "playing");
					break;
				case "abort":
					gameStates.set(gameId, "stopped");
					accumulators.delete(gameId);
					break;
			}
			const message: msg.gamePayload = {
				action: payload.action
			};
			game.broadcast("game", message);
			break;
		}

		default:
			console.warn(`Unknown message type received in game loop: ${msg.type}`);
	}
});
