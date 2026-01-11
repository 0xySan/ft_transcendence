/**
 * @file utils.ts
 * @description Utility functions for game routes, including parsing and game player management.
 */

import { activeGames } from "../../globals.js";
import * as game from "../../game/workers/game/game.types.js";
import * as worker from '../../game/workers/worker.types.js';

/**
 * Checks if a user is already in an active game.
 * @param userId - The unique identifier of the user.
 */
export function isUserInGame(userId: string): boolean {
	for (const g of activeGames.values()) {
		if (g.players.has(userId)) return true;
	}
	return false;
}

/**
 * Adds a user to a game's player list.
 * @param userId - The unique identifier of the user.
 * @param gameId - The unique identifier of the game.
 * @param code - Optional 4-character game code.
 */
export function addUserToGame(userId: string, gameId: string, code?: string): void {
	const g = activeGames.get(gameId);
	if (g) g.players.set(userId, null);
	else activeGames.set(gameId, {
		worker_id: -1,
		visibility: true,
		code: code || '',
		players: new Map([[userId, null]]),
		ownerId: userId
	});
}

/**
 * Retrieves a game ID by its 4-character code.
 * @param code - The 4-character game code.
 * @returns The game ID if found, otherwise null.
 */
export function getGameByCode(code: string) {
	console.log("Looking for game with code:", code);
	console.log("Active games:", Array.from(activeGames.entries()).map(([id, g]) => ({ id, code: g.code })));
	for (const [gameId, g] of activeGames.entries()) {
		if (g.code === code) return gameId;
	}
	return null;
}



/**
 * Retrieves a public game.
 * @returns list of game is public.
 */
export function getPublicGame(): worker.activeGame[] {
	const games: worker.activeGame[] = [];
	for (const [id, g] of activeGames.entries()) {
		if (g.visibility === true)
			games.push(g);
	}
	return (games);
}

/* ----------------------------- Type Guards ----------------------------- */

function isNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function isBoolean(value: unknown): value is boolean {
	return typeof value === "boolean";
}

function isMode(value: unknown): value is game.mode {
	return value === "online" || value === "local" || value === "tournament";
}

/* ----------------------------- Generic parser ----------------------------- */

type Parser<T> = (raw: any) => [boolean, T | string];

/**
 * Generic function to parse an object according to a schema.
 * schema is an array of [key, typeChecker, optional min/max?]
 * 
 * @param raw - the raw object to parse
 * @param schema - the schema to validate against
 * @returns [boolean, T | string] - success flag and parsed object or error message
 */
function parseObject<T>(
	raw: any,
	schema: [keyof T, (v: any) => boolean, { min?: number; max?: number; required?: boolean }?][]
): [boolean, T | string] {
	if (typeof raw !== "object" || raw === null) return [false, "Invalid object"];
	const result: Partial<T> = {};
	for (const [key, check, opts] of schema) {
		const val = raw[key];
		if (val === undefined) {
			if (opts?.required) return [false, `Missing ${String(key)}`];
			continue;
		}
		if (!check(val)) return [false, `Invalid ${String(key)}`];
		if (opts?.min !== undefined && isNumber(val) && val < opts.min) return [false, `Invalid ${String(key)}`];
		if (opts?.max !== undefined && isNumber(val) && val > opts.max) return [false, `Invalid ${String(key)}`];
		result[key] = val;
	}
	return [true, result as T];
}


/* ----------------------------- Section parsers ----------------------------- */

const parseGameSettings: Parser<game.GameSettings> = raw =>
	parseObject<game.GameSettings>(raw, [
		["mode", isMode, { required: true }],
		["maxPlayers", isNumber],
		["spectatorsAllowed", isBoolean],
		["code", (v): v is string => typeof v === "string" && /^[A-Za-z0-9]{4}$/.test(v)]
	]);

const parseWorldSettings: Parser<game.WorldSettings> = raw =>
	parseObject<game.WorldSettings>(raw, [
		["width", isNumber, { min: 10 }],
		["height", isNumber, { min: 10 }]
	]);

const parseFieldSettings: Parser<game.FieldSettings> = raw =>
	parseObject<game.FieldSettings>(raw, [
		["wallBounce", isBoolean],
		["wallThickness", isNumber, { min: 0 }]
	]);

const parseBallSettings: Parser<game.BallSettings> = raw =>
	parseObject<game.BallSettings>(raw, [
		["radius", isNumber, { min: 0 }],
		["initialSpeed", isNumber, { min: 0 }],
		["maxSpeed", isNumber, { min: 0 }],
		["speedIncrement", isNumber, { min: 0 }],
		["initialAngleRange", isNumber],
		["maxBounceAngle", isNumber],
		["allowSpin", isBoolean],
		["spinFactor", isNumber],
		["resetOnScore", isBoolean]
	]);

const parsePaddleSettings: Parser<game.PaddleSettings> = raw =>
	parseObject<game.PaddleSettings>(raw, [
		["width", isNumber, { min: 1 }],
		["height", isNumber, { min: 1 }],
		["margin", isNumber, { min: 0 }],
		["maxSpeed", isNumber, { min: 0 }],
		["acceleration", isNumber, { min: 0 }],
		["friction", isNumber, { min: 0 }]
	]);

const parseScoringSettings: Parser<game.ScoringSettings> = raw =>
	parseObject<game.ScoringSettings>(raw, [
		["firstTo", isNumber, { min: 1, required: true }],
		["winBy", isNumber, { min: 1 }]
	]);

/* ----------------------------- Main parser ----------------------------- */

/**
 * Parses and validates a game configuration object.
 * @param raw - The raw configuration object to parse.
 * @returns [boolean, Partial<game.config> | string] - success flag and parsed config or error message
 */
export function parseGameConfig(raw: unknown | null): [boolean, Partial<game.config> | string] {
	if (raw === null)
		return [true, getDefaultGameConfig()];

	if (typeof raw !== "object") return [false, "Invalid JSON body"];
	const data = raw as Record<string, any>;
	const result: Partial<game.config> = {};

	const sections: [keyof game.config, Parser<any>][] = [
		["game", parseGameSettings],
		["world", parseWorldSettings],
		["field", parseFieldSettings],
		["ball", parseBallSettings],
		["paddles", parsePaddleSettings],
		["scoring", parseScoringSettings]
	];

	for (const [key, parser] of sections) {
		if (data[key] !== undefined) {
			const [ok, parsed] = parser(data[key]);
			if (!ok) return [false, parsed]; // parsed is error message
			result[key] = parsed;
		}
	}

	return [true, result];
}

function getDefaultGameConfig(): Partial<game.config> {
  return {
    game: {
      mode: "online",  // Par défaut mode "online"
      maxPlayers: 2,  // Nombre maximum de joueurs
      spectatorsAllowed: false,  // Spectateurs autorisés par défaut
      code: Math.random().toString(36).substring(2, 6).toUpperCase(),
	  visibility: false
    },
    world: {
      width: 800,  // Largeur par défaut du monde
      height: 600  // Hauteur par défaut du monde
    },
    field: {
      wallBounce: true,  // Par défaut les murs rebondissent
      wallThickness: 10  // Epaisseur par défaut des murs
    },
    ball: {
      radius: 10,  // Rayon par défaut de la balle
      initialSpeed: 400,  // Vitesse initiale de la balle
      maxSpeed: 800,  // Vitesse maximale de la balle
      speedIncrement: 20,  // Incrément de vitesse de la balle
      initialAngleRange: 20,  // Plage d'angle initial de la balle
      maxBounceAngle: 60,  // Angle maximal de rebond de la balle
      allowSpin: true,  // Par défaut la balle peut tourner
      spinFactor: 0.5,  // Facteur de spin par défaut
      resetOnScore: true  // La balle se réinitialise après un score
    },
    paddles: {
      width: 10,  // Largeur par défaut de la palette
      height: 80,  // Hauteur par défaut de la palette
      margin: 20,  // Marge par défaut de la palette
      maxSpeed: 400,  // Vitesse maximale de la palette
      acceleration: 1000,  // Accélération par défaut de la palette
      friction: 0.9  // Frottement par défaut de la palette
    },
    scoring: {
      firstTo: 5,  // Par défaut, c'est un match en "first to 5"
      winBy: 0  // Par défaut, aucune condition de victoire supplémentaire
    }
  };
}