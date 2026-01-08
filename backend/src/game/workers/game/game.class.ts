/**
 * @file game.class.ts
 * @description This file contains the Game class which manages game state and players.
 */

import * as socket from "../../sockets/socket.types.js";
import type * as worker from "../worker.types.js";
import { Player } from "./player.class.js";
import {
	config,
	state
} from "./game.types.js";
import { parentPort } from "worker_threads";
import { parseArgs } from "util";

export interface userStatsInterface {
	userId:			string;
	earnPoints:		number;
	score:			number;
	state:			"lose" | "win" | "null";
}

/**
 * Game class representing a game instance.
 */
export class Game {
	/** Game unique identifier */
	id: string;
	/** Game is private or no */
	visibility: boolean;
	/** Owner ID of the game */
	ownerId: string;
	/** List of players in the game */
	players: Player[];
	/** List of spectators in the game */
	spectators: Player[];
	/** Current state of the game */
	state: state;
	/** Flag indicating if the game is finished */
	isFinished: boolean;
	/** Configuration of this game */
	config: config;
	/** Id of the current frame */
	currentFrameId: number;
	/** Ball state */
	ball: {
		x: number;
		y: number;
		vx: number;
		vy: number;
	};

	/**
	 * Creates a new Game instance.
	 * @param id - unique game ID
	 * @param ownerId - owner user ID
	 * @param configOverrides - optional configuration overrides
	 */
	constructor(id: string,  ownerId: string, configOverrides?: Partial<config>) {
		this.id = id;
		this.visibility = false;
		this.ownerId = ownerId;
		this.players = [];
		this.spectators = [];
		this.state = "waiting";
		this.isFinished = false;
		this.currentFrameId = 0;

		this.ball = {
			x: 0,
			y: 0,
			vx: 0,
			vy: 0
		};

		this.config = {
			game: {
				mode: "online",
				visibility: this.visibility,
				maxPlayers: 2,
				code: "",
				spectatorsAllowed: false,
				...(configOverrides?.game ?? {}),
			},
			world: {
				width: 800,
				height: 600,
				...(configOverrides?.world ?? {}),
			},
			field: {
				wallBounce: true,
				wallThickness: 10,
				...(configOverrides?.field ?? {}),
			},
			ball: {
				radius: 8,
				initialSpeed: 400,
				maxSpeed: 800,
				speedIncrement: 20,
				initialAngleRange: 45,
				maxBounceAngle: 75,
				allowSpin: false,
				spinFactor: 0.1,
				resetOnScore: true,
				...(configOverrides?.ball ?? {}),
			},
			paddles: {
				width: 10,
				height: 100,
				margin: 20,
				maxSpeed: 400,
				acceleration: 1000,
				friction: 0.9,
				...(configOverrides?.paddles ?? {}),
			},
			scoring: {
				firstTo: 5,
				winBy: 2,
				...(configOverrides?.scoring ?? {}),
			},
			timing: {
				tickRate: 60,
				serveDelayMs: 1000,
				...(configOverrides?.timing ?? {}),
			},
			network: {
				inputDelayFrames: 2,
				stateSyncRate: 12,
				...(configOverrides?.network ?? {}),
			}
		};
	}

	endGame(stats: userStatsInterface[], startTime: number | undefined, scoreLimit: number, gameId: string) {
		let time: number = 0;
		if (startTime) time = Date.now() - startTime;

		const message: worker.workerMessage = {
			type: "db",
			payload: {
				users: stats,
				timeGame: time,
				scoreLimit: scoreLimit,
				gameId: gameId
			},
			userIds: this.players.map(p => p.id)
		};

		parentPort!.postMessage(message);
	}

	/**
	 * Adds a player to the game and initializes their side and position.
	 * @param player - The Player object representing the player.
	 * @returns True if added successfully, false otherwise.
	 */
	addPlayer(player: Player) {
		if (this.players.length >= this.config.game.maxPlayers) return false;
		this.players.push(player);

		// assign sides and initial coordinates like the front
		this.assignSidesAndPositions();

		// notify player of the current player list
		const message: worker.workerMessage = {
			type: "playerSync",
			payload: {
				players: this.players.map(p => ({
					playerId: p.id,
					displayName: p.name,
					side: (p as any).side,
					x: (p as any).x,
					y: (p as any).y
				}))
			},
			userIds: player.id ? [player.id] : []
		};
		parentPort!.postMessage(message);
		return true;
	}

	/**
	 * Adds a spectator to the game.
	 * @param spectator - The Player object representing the spectator.
	 * @returns True if added successfully, false otherwise.
	 */
	addSpectator(spectator: Player) {
		if (!this.config.game.spectatorsAllowed) return false;
		this.spectators.push(spectator);
		return true;
	}

	/**
	 * Assigns sides and initial coordinates for all players
	 * like the front: left/right for 2 players, corners for 4 players.
	 */
	private assignSidesAndPositions() {
		const padCfg = this.config.paddles;
		const world = this.config.world;
		const field = this.config.field;

		const numPlayers = this.players.length;
		const sides: string[] = [];

		if (numPlayers === 2) sides.push("left", "right");
		else if (numPlayers === 4) sides.push("top-left", "top-right", "bottom-left", "bottom-right");
		else for (let i = 0; i < numPlayers; i++) sides.push("left"); // fallback

		this.players.forEach((player, index) => {
			const p = player as any;
			const side = sides[index];
			p.side = side;

			if (side === "left" || side === "top-left" || side === "bottom-left") p.x = field.wallThickness + padCfg.margin;
			else p.x = world.width - field.wallThickness - padCfg.margin - padCfg.width;

			if (side === "top-left" || side === "top-right") p.y = field.wallThickness + padCfg.margin;
			else if (side === "bottom-left" || side === "bottom-right") p.y = world.height - field.wallThickness - padCfg.margin - padCfg.height;
			else p.y = (world.height - padCfg.height) / 2;

			p.vy = 0;
		});
	}

	/**
	 * Removes a player or spectator from the game.
	 * @param playerId - The ID of the player or spectator to remove.
	 */
	removePlayer(playerId: string) {
		this.players = this.players.filter(p => p.id !== playerId);
		this.spectators = this.spectators.filter(s => s.id !== playerId);
	}

	/**
	 * Updates the game settings.
	 * @param newSettings - Partial configuration to update.
	 */
	updateSettings(newSettings: Partial<config>, userId: string) {
		if (this.ownerId !== userId) {
			console.warn(`User ${userId} is not the owner of the game ${this.id} and cannot update settings.`);
			return;
		}
		this.config = {
			game: { ...this.config.game, ...(newSettings.game ?? {}) },
			world: { ...this.config.world, ...(newSettings.world ?? {}) },
			field: { ...this.config.field, ...(newSettings.field ?? {}) },
			ball: { ...this.config.ball, ...(newSettings.ball ?? {}) },
			paddles: { ...this.config.paddles, ...(newSettings.paddles ?? {}) },
			scoring: { ...this.config.scoring, ...(newSettings.scoring ?? {}) },
			timing: { ...this.config.timing, ...(newSettings.timing ?? {}) },
			network: { ...this.config.network, ...(newSettings.network ?? {}) }
		};
	}

	/**
	 * Broadcasts a message to all players in the game.
	 * @param type - message type
	 * @param payload - message payload
	 */
	broadcast(type: socket.msgType, payload: socket.payload) {
		const message: worker.workerMessage = {
			type: type,
			payload: payload,
			userIds: this.players.map(p => p.id)
		};
		parentPort!.postMessage(message);
	}

	/**
	 * Retrieves a player or spectator by their ID.
	 * @param playerId - The ID of the player or spectator to retrieve.
	 * @returns The Player object if found, otherwise null.
	 */
	getPlayerById(playerId: string): Player | null {
		const player = this.players.find(p => p.id === playerId);
		if (player) return player;
		const spectator = this.spectators.find(s => s.id === playerId);
		return spectator || null;
	}

	/**
	 * Checks if a user is the owner of the game.
	 * @param userId - The ID of the user to check.
	 * @returns True if the user is the owner, false otherwise.
	 */
	isOwner(userId: string): boolean {
		return this.ownerId === userId;
	}

	/**
	 * Returns a map of playerId -> side for the front.
	 */
	getPlayerSidesMap(): socket.PlayerSideMap {
		const map: socket.PlayerSideMap = {};
		this.players.forEach(p => {
			map[p.id] = (p as any).side;
		});
		return map;
	}

	resetGame() {
		this.ball = {
			x: 0,
			y: 0,
			vx: 0,
			vy: 0
		};
		this.state = "waiting";
		this.isFinished = false;
		this.currentFrameId = 0;

		for (const target of this.players) target.resetPlayer();

		this.assignSidesAndPositions();
	}
}
