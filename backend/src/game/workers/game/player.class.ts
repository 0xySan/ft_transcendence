// player.class.ts
import * as socket from '../../sockets/socket.types.js';

/**
 * Class representing a player in the game.
 */
export class Player {
	/** Player unique identifier */
	id: string;
	/** Player display name */
	name: string;
	/** Player score */
	score: number;
	/** Player position */
	y: number;
	/** Player position */
	x: number;
	/** Input buffer mapped by server frame id */
	inputBuffer: Map<number, socket.gameInput[]>;
	/** Frame offset for input synchronization */
	frameOffset?: number;
	/** Current active inputs state */
	activeInputs: { up: boolean; down: boolean };

	/**
	 * Create a new Player instance.
	 * @param id - Player unique identifier
	 * @param name - Player display name
	 */
	constructor(id: string, name: string) {
		this.id = id;
		this.name = name;
		this.score = 0;
		this.inputBuffer = new Map();
		this.x = 0;
		this.y = 0;
		this.activeInputs = { up: false, down: false };
	}

	/**
	 * Add inputs mapped to server frame ids.
	 * Merges with existing inputs if present.
	 * @param serverFrameId - The server frame id.
	 * @param inputs - The array of inputs to add.
	 */
	addInputsForServerFrame(serverFrameId: number, inputs: socket.gameInput[]) {
		if (!Number.isFinite(serverFrameId)) return;
		const existing = this.inputBuffer.get(serverFrameId);
		if (existing) {
			for (const inp of inputs) {
				const idx = existing.findIndex(e => e.key === inp.key);
				if (idx >= 0) existing[idx] = inp;
				else existing.push(inp);
			}
			this.inputBuffer.set(serverFrameId, existing);
		} else {
			this.inputBuffer.set(serverFrameId, inputs.slice());
		}
		// safety cap
		const MAX_BUFFER = 300;
		if (this.inputBuffer.size > MAX_BUFFER) {
			const keys = Array.from(this.inputBuffer.keys()).sort((a, b) => a - b);
			while (this.inputBuffer.size > MAX_BUFFER) {
				this.inputBuffer.delete(keys.shift()!);
			}
		}
	}

	/**
	 * Retrieve inputs for a server frame and remove them (consumed).
	 * @param frameId - The server frame id.
	 * @returns The array of inputs for the frame.
	 */
	getInputsForFrame(frameId: number): socket.gameInput[] {
		const inputs = this.inputBuffer.get(frameId);
		if (!inputs) return [];
		this.inputBuffer.delete(frameId);
		return inputs;
	}

	/**
	 * Apply persistent input state from an array of inputs.
	 * pressed true/false will set the activeInputs state.
	 * @param inputs - The array of inputs to apply.
	 */
	applyPersistentInputs(inputs: socket.gameInput[]) {
		for (const i of inputs) {
			if (i.key === 'up') this.activeInputs.up = i.pressed;
			else if (i.key === 'down') this.activeInputs.down = i.pressed;
		}
	}

	resetPlayer() {
		this.inputBuffer = new Map();
	}
}
