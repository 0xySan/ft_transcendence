/**
 * @file player.class.ts
 * @description This file contains the Player class which represents a player in the game.
 */

import * as socket from '../../sockets/socket.types.js';

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
	/** Player's vertical position */
	y: number;
	/** Player's horizontal position */
	x: number;

	/**
	 * Buffer to store input frames for the player.
	 * This can be used to handle input latency and ensure smooth gameplay.
	 * Each entry in the buffer corresponds to a frame of input data.
	 */
	inputBuffer: socket.inputFrame[];

	/**
	 * Constructor to initialize a Player instance.
	 * @param id - The unique identifier for the player
	 * @param name - The display name of the player
	 */
	constructor(id: string, name: string) {
		this.id = id;
		this.name = name;
		this.score = 0;
		this.inputBuffer = [];
		this.x = 0;
		this.y = 0;
	}

	/**
	 * Adds points to the player's score.
	 * @param points - The number of points to add
	 */
	addScore(points: number) {
		this.score += points;
	}

	/**
	 * Adds input frames to the player's input buffer.
	 * @param frames - Array of input frames to be added
	 */
	addInputs(frames: socket.inputFrame[]) {
		for (const newFrame of frames) {
			const existingFrame = this.inputBuffer.find(f => f.frameId === newFrame.frameId);
			if (existingFrame) // Merge inputs if frame already exists
				existingFrame.inputs.push(...newFrame.inputs);
			else
				this.inputBuffer.push({ ...newFrame });
		}
		// Sort the buffer by frameId to maintain order
		this.inputBuffer.sort((a, b) => a.frameId - b.frameId);
	}

	/**
	 * Stores input frame data into the player's input buffer.
	 * @param frameId - The frame identifier
	 * @param inputs - The array of game inputs for the frame
	 */
	getInputsForFrame(frameId: number): socket.gameInput[] {
		const frameIndex = this.inputBuffer.findIndex(f => f.frameId === frameId);
		if (frameIndex === -1) return [];
		const frame = this.inputBuffer[frameIndex];
		// Remove the frame from the buffer after retrieving inputs
		this.inputBuffer.splice(frameIndex, 1);
		return frame.inputs;
	}
}