/**
 * @file loop.ts
 * @description Global game loop worker handling all games with start/pause/resume/abort.
 */

import { parentPort } from "worker_threads";
import { Game, pointsInterface } from "./game.class.js";
import type * as msg from "../../sockets/socket.types.js";
import {
	createHandler,
	inputsHandler,
	playerHandler,
	settingsHandler
} from "./handlers.js";

import { Player } from "./player.class.js";

/* -------------------------------------------------------------------------- */
/*                                   STATS                                    */
/* -------------------------------------------------------------------------- */

let		userStats: msg.statsPayload[] = [];
let		lastHit: string = "";
let		pointsTime: pointsInterface[] = [];
let		direction: boolean = false;

/* -------------------------------------------------------------------------- */
/*                                   STATE                                    */
/* -------------------------------------------------------------------------- */

const games: Map<string, Game> = new Map();
const gameStates: Map<string, "starting" | "playing" | "paused" | "stopped"> = new Map();
const gameStartTimes: Map<string, number> = new Map();
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
		const state = gameStates.get(gameId);

		if (state === "starting") {
			const startTime = gameStartTimes.get(gameId);
			if (startTime && Date.now() >= startTime) {
				game.currentFrameId = 0;
				accumulators.set(gameId, 0);
				gameStates.set(gameId, "playing");
				for (const targetPlayer of game.players) {
					userStats.push({ userId: targetPlayer.id, earnPoints: 0, state: "null", score: 0 });
				}
			}
			else {
				return;
			}
		}

		if (state === "stopped") {
			const winnerScore = game.players.reduce((max, player) => Math.max(max, player.score ?? 0), 0);

			const scores = game.players.map(p => p.score ?? 0);
			const equal = scores.some(score => score !== winnerScore);

			for (const statTarget of userStats) {
				const player = game.players.find(p => p.id === statTarget.userId);
				if (!player) continue;
				statTarget.score = player.score;

				if (equal) {
					statTarget.state = (player.score === winnerScore) ? "win" : "lose";
				} else {
					statTarget.state = "null";
				}
			}

			game.endGame(userStats, gameStartTimes.get(gameId), game.config.scoring.firstTo, gameId, pointsTime);
			userStats = [];
			pointsTime = [];
			direction = false;
			gameStates.delete(game.id);
			gameStartTimes.delete(game.id);
			accumulators.delete(game.id);
			return;
		} else if (state !== "playing")
			return;


		let accumulator = accumulators.get(gameId) ?? 0;
		accumulator += deltaTime;

		while (accumulator >= FIXED_DT) {
			stepGame(game, FIXED_DT);
			accumulator -= FIXED_DT;
		}

		accumulators.set(gameId, accumulator);
	});

	setTimeout(gameLoop, 1000 / 120); // Run at twice the frame rate for smoother timing
}

gameLoop();

/* -------------------------------------------------------------------------- */
/*                               GAME STEP                                    */
/* -------------------------------------------------------------------------- */

function stepGame(game: Game, dt: number): void {
	if (game.players.length < 2) {
		game.state = "waiting";
		return;
	}

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
		const p = player as Player;

		const leftX = field.wallThickness + padCfg.margin;
		const rightX =
			world.width
			- field.wallThickness
			- padCfg.margin
			- padCfg.width;
			
		const sides = game.getPlayerSidesMap();
		if( sides[player.id] === "left") (p as any).x = leftX;
		else if( sides[player.id] === "right") (p as any).x = rightX;
		if (p.vy === undefined) p.vy = 0;

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

	function resetBall() {

		let vx: number = game.config.ball.initialSpeed;
		if (!direction) { vx *= -1; direction = true; }
		else direction = false;

		game.ball = {
			starting: true,
			paddle: undefined,
			x: world.width / 2,
			y: world.height / 2,
			vx: vx,
			vy: 0
		};

		game.goalUpdate(500);
	}

	if (game.goal) return;
	if (!game.goal) {

	}
	if (!game.ball.starting) resetBall();

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
			ball.y <= p.y + padCfg.height && ball.paddle !== p
		) {
			ball.paddle = p;
			const paddleCenter = p.y + padCfg.height / 2;
			let rel = (ball.y - paddleCenter) / (padCfg.height / 2);

			rel = Math.max(-1, Math.min(1, rel));

			let speedBall = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
			speedBall = Math.min(
				speedBall + game.config.ball.speedIncrement,
				game.config.ball.maxSpeed
			);

			ball.vy = rel * speedBall;

			const vxSign = ball.vx > 0 ? -1 : 1;
			ball.vx = vxSign * Math.sqrt(
				Math.max(0, speedBall * speedBall - ball.vy * ball.vy)
			);
			lastHit = player.id;
			break;
		}
	}

	if (ball.x < 0 || ball.x > world.width) {
		const scorer =
			ball.x < 0 ? orderedPlayers[1] : orderedPlayers[0];

		if (scorer) {
			resetBall();
			scorer.score = (scorer.score ?? 0) + 1;
			const startTime = gameStartTimes.get(game.id);
			if (startTime !== undefined) pointsTime.push({ time: Date.now() - startTime, who: lastHit });
			if (lastHit != "") {
				for (const statsTarget of userStats) {
					if (statsTarget.userId == lastHit) {
						statsTarget.earnPoints += 1;
						break;
					}
				}	
			}
			lastHit = "";
		}
		// Check win conditions: firstTo score + winBy margin
		const winBy = game.config.scoring.winBy;
		const scoreDiff = Math.abs(orderedPlayers[0].score - orderedPlayers[1].score);
	
		if (scorer.score >= game.config.scoring.firstTo && scoreDiff >= winBy) {
			gameStates.set(game.id, "stopped");

			const message: msg.gamePayload = {
				action: "stopped"
			};
			game.broadcast("game", message);
		}

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
			inputsHandler(message as msg.message<msg.workerInputPayload>, games, gameStates);
			break;
		case "game": {
			const payload = message.payload as msg.workerGamePayload;
			const game = games.get(payload.gameId);
			if (!game) {
				console.log("CANT START GAME: game not found");
				return;
			}

			if (payload.userId && !game.isOwner(payload.userId) && !payload.noOwnerCheck)
			{
				console.log("CANT START GAME: User is not owner");
				return;
			}

			if (gameStates.has(payload.gameId))
			{
				console.log("CANT START GAME: game already in game state");
				return;
			}

			if (payload.action === "start") {
				if (game.players.length === game.config.game.maxPlayers && (game.players.length == 2 || game.players.length === 4)) 
				{
					console.log("CANT START GAME: Not enough player");
					return;
				}
				game.resetGame();
				const startTime = Date.now() + 3000;

				gameStates.set(payload.gameId, "starting");
				gameStartTimes.set(payload.gameId, startTime);
				accumulators.set(payload.gameId, 0);

				game.broadcast("game", {
					action: "start",
					playerSides: game.getPlayerSidesMap(),
					startTime
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
