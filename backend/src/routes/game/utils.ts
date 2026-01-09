/**
 * @file utils.ts
 * @description Utility functions for game routes, including parsing and game player management.
 */

import { activeGames, activeTournaments, TournamentMatch } from "../../globals.js";
import * as game from "../../game/workers/game/game.types.js";
import * as worker from '../../game/workers/worker.types.js';
import { gameGetSettingsByGameId } from '../../game/workers/init.js';

/* ======================== TOURNAMENT CLEANUP ======================== */

// Clean up old tournaments every 5 minutes
// Remove completed tournaments after 1 hour
// Remove abandoned waiting tournaments after 30 minutes
setInterval(() => {
	const now = Date.now();
	for (const [tournamentId, tournament] of activeTournaments.entries()) {
		// Remove completed tournaments after 1 hour
		if (tournament.status === 'completed' && tournament.completedAt && (now - tournament.completedAt) > 60 * 60 * 1000) {
			activeTournaments.delete(tournamentId);
			console.log(`Cleaned up completed tournament: ${tournamentId}`);
		}
		// Remove waiting tournaments that haven't started after 30 minutes
		else if (tournament.status === 'waiting' && (now - tournament.createdAt) > 30 * 60 * 1000) {
			activeTournaments.delete(tournamentId);
			console.log(`Cleaned up abandoned tournament: ${tournamentId}`);
		}
	}
}, 5 * 60 * 1000);

/* ======================== TOURNAMENT UTILITIES ======================== */

/**
 * Generates a single elimination bracket for a tournament.
 * @param players - Array of player IDs
 * @param round - Current round number (default 0)
 * @returns Array of TournamentMatch objects
 */
export function generateBracket(players: string[], round: number = 0): TournamentMatch[] {
	const bracket: TournamentMatch[] = [];
	
	// Shuffle players for random pairings
	const shuffled = [...players].sort(() => Math.random() - 0.5);
	
	for (let i = 0; i < shuffled.length; i += 2) {
		bracket.push({
			matchId: `match_${round}_${i / 2}`,
			gameId: null,
			player1Id: shuffled[i] || null,
			player2Id: shuffled[i + 1] || null,
			player1Ready: false,
			player2Ready: false,
			winner: null,
			round: round
		});
	}
	
	return bracket;
}

/**
 * Validates if a tournament can have a specific number of players.
 * Valid sizes: 2, 4, 8, 16, 32, 64, 128, etc. (power of 2)
 * @param count - Number of players
 * @returns true if valid tournament size, false otherwise
 */
export function isValidTournamentSize(count: number): boolean {
	return count >= 2 && (count & (count - 1)) === 0; // Check if power of 2
}

/**
 * Gets the next round matches after current round is completed.
 * @param completedMatches - Matches from current round with winners set
 * @param currentRound - Current round number
 * @returns Array of matches for next round
 */
export function getNextRoundMatches(completedMatches: TournamentMatch[], currentRound: number): TournamentMatch[] {
	const nextMatches: TournamentMatch[] = [];
	
	for (let i = 0; i < completedMatches.length; i += 2) {
		const winner1 = completedMatches[i]?.winner;
		const winner2 = completedMatches[i + 1]?.winner;
		
		if (winner1 || winner2) {
			nextMatches.push({
				matchId: `match_${currentRound + 1}_${nextMatches.length}`,
				gameId: null,
				player1Id: winner1 || null,
				player2Id: winner2 || null,
				player1Ready: false,
				player2Ready: false,
				winner: null,
				round: currentRound + 1
			});
		}
	}
	
	return nextMatches;
}

/**
 * Checks if a player is in a tournament.
 * @param userId - The unique identifier of the user.
 * @param tournamentId - The unique identifier of the tournament.
 * @returns true if player is in tournament, false otherwise
 */
export function isPlayerInTournament(userId: string, tournamentId: string): boolean {
	const tournament = activeTournaments.get(tournamentId);
	return tournament ? tournament.players.has(userId) : false;
}

/**
 * Checks if a user is already in an active tournament.
 * @param userId - The unique identifier of the user.
 * @returns true if user is in any tournament, false otherwise
 */
export function isUserInTournament(userId: string): boolean {
	for (const tournament of activeTournaments.values()) {
		if (tournament.players.has(userId)) return true;
	}
	return false;
}

/**
 * Gets tournament by code.
 * @param code - The tournament code
 * @returns Tournament ID if found, null otherwise
 */
export function getTournamentByCode(code: string): string | null {
	for (const [tournamentId, tournament] of activeTournaments.entries()) {
		if (tournament.code === code) return tournamentId;
	}
	return null;
}

/**
 * Marks a player as ready for their match.
 * @param tournamentId - The tournament ID
 * @param matchId - The match ID
 * @param userId - The user ID
 * @returns true if successful, error message otherwise
 */
export function markPlayerReady(tournamentId: string, matchId: string, userId: string): boolean | string {
	const tournament = activeTournaments.get(tournamentId);
	if (!tournament) return "Tournament not found";
	
	const match = tournament.bracket.find(m => m.matchId === matchId);
	if (!match) return "Match not found";
	
	if (match.player1Id === userId) {
		match.player1Ready = true;
	} else if (match.player2Id === userId) {
		match.player2Ready = true;
	} else {
		return "Player not in this match";
	}
	
	return true;
}

/**
 * Checks if both players in a match are ready.
 * @param tournamentId - The tournament ID
 * @param matchId - The match ID
 * @returns true if both players are ready, false otherwise
 */
export function areBothPlayersReady(tournamentId: string, matchId: string): boolean {
	const tournament = activeTournaments.get(tournamentId);
	if (!tournament) return false;
	
	const match = tournament.bracket.find(m => m.matchId === matchId);
	if (!match) return false;
	
	return match.player1Ready && match.player2Ready && match.player1Id !== null && match.player2Id !== null;
}

/**
 * Records a match winner.
 * @param tournamentId - The tournament ID
 * @param matchId - The match ID
 * @param winnerId - The winning player ID
 * @returns true if successful, error message otherwise
 */
export function recordMatchWinner(tournamentId: string, matchId: string, winnerId: string): boolean | string {
	const tournament = activeTournaments.get(tournamentId);
	if (!tournament) return "Tournament not found";
	
	const match = tournament.bracket.find(m => m.matchId === matchId);
	if (!match) return "Match not found";
	
	if (match.player1Id !== winnerId && match.player2Id !== winnerId) {
		return "Winner not in this match";
	}
	
	match.winner = winnerId;
	return true;
}

/**
 * Checks if current round is completed.
 * @param tournamentId - The tournament ID
 * @returns true if all matches in current round have winners, false otherwise
 */
export function isCurrentRoundCompleted(tournamentId: string): boolean {
	const tournament = activeTournaments.get(tournamentId);
	if (!tournament) return false;
	
	const currentRoundMatches = tournament.bracket.filter(m => m.round === tournament.currentRound);
	return currentRoundMatches.length > 0 && currentRoundMatches.every(m => m.winner !== null);
}

/**
 * Advances tournament to next round.
 * @param tournamentId - The tournament ID
 * @returns true if advanced, error message if tournament ended
 */
export function advanceToNextRound(tournamentId: string): boolean | string {
	const tournament = activeTournaments.get(tournamentId);
	if (!tournament) return "Tournament not found";
	
	const currentRoundMatches = tournament.bracket.filter(m => m.round === tournament.currentRound);
	
	if (!isCurrentRoundCompleted(tournamentId)) {
		return "Current round not completed";
	}
	
	// Check if tournament is finished (only 1 match and has winner)
	if (currentRoundMatches.length === 1 && currentRoundMatches[0].winner) {
		tournament.status = "completed";
		tournament.completedAt = Date.now();
		return "Tournament completed";
	}
	
	const nextMatches = getNextRoundMatches(currentRoundMatches, tournament.currentRound);
	tournament.bracket.push(...nextMatches);
	tournament.currentRound++;
	
	return true;
}

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
	for (const [gameId, g] of activeGames.entries()) {
		if (g.code === code) return gameId;
	}
	return null;
}



/**
 * Retrieves a public game.
 * @returns list of game is public.
 */
export function getPublicGame(): any[] {
	const games: any[] = [];
	for (const [id, g] of activeGames.entries()) {
		if (g.visibility === true) {
			// attempt to fetch authoritative settings (may be undefined)
			const settings = gameGetSettingsByGameId(id);
			const maxPlayers = settings?.newSettings?.game?.maxPlayers;
			games.push({
				id,
				code: g.code,
				ownerId: g.ownerId,
				visibility: g.visibility,
				// serialize players map to array of player ids
				players: Array.from(g.players.keys()),
				// include maxPlayers when available to avoid extra client fetch
				maxPlayers: typeof maxPlayers === 'number' ? maxPlayers : undefined
			});
		}
	}
	return games;
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
      mode: "online",
      maxPlayers: 2,
      spectatorsAllowed: false,
      code: Math.random().toString(36).substring(2, 6).toUpperCase(),
	  visibility: false
    },
    world: {
      width: 800,
      height: 600
    },
    field: {
      wallBounce: true,
      wallThickness: 10
    },
    ball: {
      radius: 10,
      initialSpeed: 400,
      maxSpeed: 800,
      speedIncrement: 20,
      initialAngleRange: 20,
      maxBounceAngle: 60,
      allowSpin: true,
      spinFactor: 0.5,
      resetOnScore: true
    },
    paddles: {
      width: 10,
      height: 80,
      margin: 20,
      maxSpeed: 400,
      acceleration: 1000,
      friction: 0.9
    },
    scoring: {
      firstTo: 5,
      winBy: 0
    }
  };
}