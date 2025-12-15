/**
 * @file player.class.ts
 * @description This file contains the Player class which represents a player in the game.
 */

/**
 * Player class representing a player in the game.
 */
export class Player {
	/** Player unique identifier */
	id: string;
	/** Player display name */
	name: string;
	/** Player score */
	score: number;

	/**
	 * Constructor to initialize a Player instance.
	 * @param id - The unique identifier for the player
	 * @param name - The display name of the player
	 */
	constructor(id: string, name: string) {
		this.id = id;
		this.name = name;
		this.score = 0;
	}

	addScore(points: number) {
		this.score += points;
	}
}