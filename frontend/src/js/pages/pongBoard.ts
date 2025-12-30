import type { Settings } from "../global";
import type { gameStartAckPayload } from "./lobbySocket";

declare global {
	interface Window {
		socket?: WebSocket;
		localPlayerId?: string;
		pendingGameStart?: gameStartAckPayload;
		lobbySettings?: Settings;
	}
}

interface ClientInputPayload {
	userId: string;
	inputs: InputFrame[];
}


export {};

function assertElement<T extends HTMLElement>(element: HTMLElement | null, message?: string): T {
	if (!element) {
		notify(message || "Element not found", { type: "error" });
		throw new Error(message || "Element not found");
	}
	return element as T;
}

declare function addListener(
	target: EventTarget | null,
	event: string,
	handler: any,
): void;

/* -------------------------------------------------------------------------- */
/*                                     CHECKS                                 */
/* -------------------------------------------------------------------------- */

const board = assertElement<HTMLDivElement>(document.getElementById("pong-board"), "Pong board not found");

function cancelLoading(message: string): void {
	board.innerHTML = `<div class="loading-error">${message}</div>`;
	notify(message, { type: "error" });
	throw new Error(message);
}

if (!window.lobbySettings)
	cancelLoading("Lobby settings are not available.");
if (!window.socket || window.socket.readyState !== WebSocket.OPEN)
	cancelLoading("WebSocket connection is not established.");
if (!window.localPlayerId)
	cancelLoading("Local player ID is not set.");
if (!window.pendingGameStart)
	cancelLoading("No pending game start information found.");

/* -------------------------------------------------------------------------- */
/*                                 INITIALIZATION                             */
/* -------------------------------------------------------------------------- */

/**
 * Canvas for rendering the Pong game.
 */
class PongBoardCanvas {
	/** The HTML canvas element. */
	canvas: HTMLCanvasElement;
	/** The 2D rendering context for the canvas. */
	context: CanvasRenderingContext2D;
	/** The width of the game world. */
	private worldWidth: number;
	/** The height of the game world. */
	private worldHeight: number;

	/**
	 * Creates a PongBoardCanvas instance.
	 * @param container - The HTML container to append the canvas to.
	 */
	constructor(container: HTMLDivElement) {
		this.canvas = document.createElement("canvas");
		this.context = this.canvas.getContext("2d") as CanvasRenderingContext2D;
		this.canvas.id = "pong-canvas";

		const settings = window.lobbySettings!;
		this.worldWidth = settings.world.width;
		this.worldHeight = settings.world.height;

		// Set the canvas dimensions to match the game world
		this.canvas.width = this.worldWidth;
		this.canvas.height = this.worldHeight;

		container.appendChild(this.canvas);

		// Initial resize and setup resize listener
		this.resize();
		window.addEventListener("resize", () => this.resize());
	}

	/**
	 * Resizes the canvas to fit its container while maintaining aspect ratio.
	 */
	private resize() {
		const parent = this.canvas.parentElement!;
		const availW = parent.clientWidth;
		const availH = parent.clientHeight;

		const scale = Math.min(availW / this.worldWidth, availH / this.worldHeight);

		// We use CSS to scale the canvas while keeping its internal resolution
		this.canvas.style.width = `${this.worldWidth * scale}px`;
		this.canvas.style.height = `${this.worldHeight * scale}px`;
	}
}


class Paddle {
	private x: number;
	private y: number;
	private width: number;
	private height: number;
	private context: CanvasRenderingContext2D;
	private color: string = "white";
	public	buffer: InputBuffer;
	private up: boolean = false;
	private down: boolean = false;
	private speed: number = window.lobbySettings!.paddles.maxSpeed;
	private vy: number = 0;

	constructor(x: number, y: number, width: number, height: number, context: CanvasRenderingContext2D) {
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
		this.context = context;
		this.buffer = new InputBuffer();
	}

	/** Called by InputBuffer to apply a snapshot of inputs */
	applyInputs(inputs: GameInput[]) {
		// met à jour le hold-state
		for (const input of inputs) {
			if (input.key === "up") this.up = input.pressed;
			if (input.key === "down") this.down = input.pressed;
		}
	}

	/** optionnel: pour fallback, InputBuffer peut utiliser ceci */
	setHoldState(up: boolean, down: boolean) {
		this.up = up;
		this.down = down;
	}

	/** simulate paddle movement for a fixed dt (seconds) */
	update(dt: number) {
		const padCfg = window.lobbySettings!.paddles;

		if (this.up && !this.down)
			this.vy -= padCfg.acceleration * dt;
		else if (this.down && !this.up)
			this.vy += padCfg.acceleration * dt;
		else
			this.vy *= Math.pow(padCfg.friction, dt * 60);

		if (this.vy > padCfg.maxSpeed) this.vy = padCfg.maxSpeed;
		if (this.vy < -padCfg.maxSpeed) this.vy = -padCfg.maxSpeed;

		this.y += this.vy * dt;

		const field = window.lobbySettings!.field;
		const top = field.wallThickness;
		const bottom = window.lobbySettings!.world.height - field.wallThickness - this.height;
		if (this.y < top) { this.y = top; this.vy = 0; }
		if (this.y > bottom) { this.y = bottom; this.vy = 0; }
	}

	draw() {
		this.context.fillStyle = this.color;
		this.context.fillRect(this.x, this.y, this.width, this.height);
	}
}


class PongBoard {
	private canvas: PongBoardCanvas;
	public paddles: Paddle[] = [];
	public playerPaddle!: Paddle;
	private paddleByPlayerId = new Map<string, Paddle>();

	constructor(container: HTMLDivElement) {
		this.canvas = new PongBoardCanvas(container);
		const context = this.canvas.context;

		const playerSides = window.pendingGameStart!.playerSides;

		for (const [playerId, side] of Object.entries(playerSides)) {
			let x: number, y: number;
			const padW = window.lobbySettings!.paddles.width;
			const padH = window.lobbySettings!.paddles.height;

			if (side === "top-left" || side === "bottom-left" || side === "left")
				x = 50;
			else
				x = this.canvas.canvas.width - 50 - padW;

			if (side === "top-left" || side === "top-right")
				y = 50;
			else if (side === "bottom-left" || side === "bottom-right")
				y = this.canvas.canvas.height - 50 - padH;
			else
				y = (this.canvas.canvas.height - padH) / 2;

			const paddle = new Paddle(x, y, padW, padH, context);
			this.paddles.push(paddle);
			this.paddleByPlayerId.set(playerId, paddle);
		}

		this.playerPaddle = this.paddleByPlayerId.get(window.localPlayerId!)!;
	}

	getPaddleByPlayerId(playerId: string): Paddle | undefined {
		return this.paddleByPlayerId.get(playerId);
	}

	update(dt: number) {
		this.paddles.forEach(paddle => paddle.update(dt));
	}

	draw() {
		const context = this.canvas['context'];
		context.fillStyle = "black";
		context.fillRect(0, 0, this.canvas['canvas'].width, this.canvas['canvas'].height);
		this.paddles.forEach(paddle => paddle.draw());
	}
}

/* -------------------------------------------------------------------------- */
/*                                MESSAGE HANDLING                            */
/* -------------------------------------------------------------------------- */

addListener(window.socket!, "message", (event: MessageEvent) => {
	const msg = JSON.parse(event.data);
	console.log("Received message:", msg);
	if (msg.type === "input") {
		const payload = msg.payload as ClientInputPayload;
		const paddle = pongBoard.getPaddleByPlayerId(payload.userId);
		if (!paddle) return;

		// store authoritative frames
		paddle.buffer.pushRemoteFrames(payload.inputs);

		// apply last snapshot immediately (visual responsiveness)
		const lastFrame = payload.inputs[payload.inputs.length - 1];
		paddle.buffer.applyToPaddleForFrame(paddle, lastFrame.frameId);
	}
});


/* -------------------------------------------------------------------------- */
/*                                 INPUT HANDLING                             */
/* -------------------------------------------------------------------------- */

export type KeyName = "up" | "down";

export interface GameInput {
	key: KeyName;
	pressed: boolean;
}

export interface InputFrame {
	frameId: number;
	inputs: GameInput[];
}

/**
 * Client-side input buffer usable for local and remote players.
 * - Local usage:
 *    inputBuffer.setKey("up", true);
 *    const frame = inputBuffer.nextLocalFrame(); // send this to server
 * - Remote usage:
 *    inputBuffer.pushRemoteFrames(remoteFramesFromServer);
 *    inputBuffer.applyToPaddleForFrame(paddle, frameId);
 */
export class InputBuffer {
	private serverBaseFrame = 0;        // server frame base used to compute local frame ids
	private localCounter = 0;          // local frame counter since last sync
	private currentHold = new Map<KeyName, boolean>(); // current local hold-state (up/down)
	private localFrames: InputFrame[] = []; // history of local frames created (not acked yet)
	private remoteFrames = new Map<number, GameInput[]>(); // remote snapshots keyed by server frameId
	private lastRemoteSnapshotFrame = 0;

	constructor() {
		this.currentHold.set("up", false);
		this.currentHold.set("down", false);
	}

	/** Align local numbering to server authoritative frame */
	public syncToServerFrame(serverFrameId: number): void {
		this.serverBaseFrame = serverFrameId;
		this.localCounter = 0;
		this.localFrames.length = 0;
	}

	/** Set the current hold-state (called by keyboard/touch handlers) */
	public setKey(key: KeyName, pressed: boolean): void {
		this.currentHold.set(key, pressed);
	}

	/** Build next local frame (id = serverBaseFrame + ++localCounter), store it and return it */
	public nextLocalFrame(): InputFrame {
		this.localCounter += 1;
		const frameId = this.serverBaseFrame + this.localCounter;
		const inputs: GameInput[] = Array.from(this.currentHold.entries()).map(([k, v]) => ({ key: k, pressed: v }));
		const frame: InputFrame = { frameId, inputs };
		this.localFrames.push(frame);
		return frame;
	}

	/** Return local frames pending (for sending) */
	public getPendingLocalFrames(): InputFrame[] {
		return this.localFrames.slice();
	}

	/** Remove local frames up to given frameId (called when server ack arrives) */
	public ackLocalFramesUpTo(lastAcceptedServerFrame: number): void {
		this.localFrames = this.localFrames.filter(f => f.frameId > lastAcceptedServerFrame);
	}

	/** Push frames forwarded from server about some remote player */
	public pushRemoteFrames(frames: InputFrame[]): void {
		for (const f of frames) {
			// keep latest snapshot for a frameId (overwrite if duplicate)
			this.remoteFrames.set(f.frameId, f.inputs.map(i => ({ ...i })));
			if (f.frameId > this.lastRemoteSnapshotFrame) this.lastRemoteSnapshotFrame = f.frameId;
		}
	}

	/** Get exact remote inputs snapshot for a frameId (if available) */
	public getRemoteInputsForFrame(frameId: number): GameInput[] | undefined {
		return this.remoteFrames.get(frameId);
	}

	/**
	 * Compute hold-state for an arbitrary frameId for remote player:
	 * - if there's an exact snapshot for frameId -> use it
	 * - else use the latest snapshot <= frameId (fall back to false/false)
	 */
	public getHoldStateForRemoteFrame(frameId: number): { up: boolean; down: boolean } {
		// exact
		const exact = this.remoteFrames.get(frameId);
		if (exact) return this.inputsToHoldState(exact);

		// search backwards for latest snapshot <= frameId
		let cur = frameId;
		const limit = Math.max(frameId - 300, 0); // safety limit (don't scan infinitely)
		while (cur >= limit) {
			const snap = this.remoteFrames.get(cur);
			if (snap) return this.inputsToHoldState(snap);
			cur -= 1;
		}

		// fallback
		return { up: false, down: false };
	}

	/** Helper: apply inputs (snapshot) or best hold-state to a paddle for a given frame */
	public applyToPaddleForFrame(paddle: { applyInputs: (inputs: GameInput[]) => void; setHoldState?: (up: boolean, down: boolean) => void }, frameId: number): void {
		const snap = this.getRemoteInputsForFrame(frameId);
		if (snap) {
			paddle.applyInputs(snap);
		} else {
			const hold = this.getHoldStateForRemoteFrame(frameId);
			if (typeof paddle.setHoldState === "function") paddle.setHoldState(hold.up, hold.down);
			// if paddle doesn't have setHoldState, we rely on applyInputs being called periodically with snapshots
		}
	}

	/** Convert a snapshot array into a hold-state object */
	private inputsToHoldState(inputs: GameInput[]): { up: boolean; down: boolean } {
		let up = false;
		let down = false;
		for (const i of inputs) {
			if (i.key === "up") up = i.pressed;
			if (i.key === "down") down = i.pressed;
		}
		return { up, down };
	}

	/** Remove remote snapshots older than threshold to save memory */
	public cleanupRemoteBefore(frameId: number): void {
		for (const k of Array.from(this.remoteFrames.keys())) {
			if (k < frameId) this.remoteFrames.delete(k);
		}
		// keep lastRemoteSnapshotFrame consistent
		if (this.lastRemoteSnapshotFrame < frameId) this.lastRemoteSnapshotFrame = frameId;
	}

	/** Utility: get last remote snapshot frame known */
	public getLastRemoteSnapshotFrame(): number {
		return this.lastRemoteSnapshotFrame;
	}

	public getCurrentHoldState(): { up: boolean; down: boolean } {
		const up = !!this.currentHold.get("up");
		const down = !!this.currentHold.get("down");
		return { up, down };
	}

}

addListener(window, "keydown", (event: KeyboardEvent) => handleKey(event, true));
addListener(window, "keyup", (event: KeyboardEvent) => handleKey(event, false));

function handleKey(event: KeyboardEvent, pressed: boolean) {
	event.preventDefault();

	const key = event.key;
	let direction: KeyName | null = null;

	if (key === "ArrowUp" || key === "w") direction = "up";
	else if (key === "ArrowDown" || key === "s") direction = "down";
	if (!direction) return;

	const buffer = pongBoard.playerPaddle.buffer;

	buffer.setKey(direction, pressed);

	const frame = buffer.nextLocalFrame();

	window.socket!.send(JSON.stringify({
		type: "input",
		payload: {
			inputs: [
				{
					frameId: frame.frameId,
					inputs: frame.inputs
				}
			]
		}
	}));
}



/* -------------------------------------------------------------------------- */
/*                                  MAIN LOGIC                                */
/* -------------------------------------------------------------------------- */

/**
 * Class representing the Pong game logic and rendering loop.
 */
class PongGame {
	private board: PongBoard;
	private running = false;
	private lastTime = 0;
	private acc = 0;
	private clientFrame = 0;
	private readonly FIXED_DT = 1 / 60; // 60 FPS

	constructor(board: PongBoard) {
		this.board = board;
	}

	/**
	 * Starts the game loop at a specified server start time.
	 * @param serverStartTime - The server time at which to start the game.
	 */
	startAt(serverStartTime: number) {
	const updateCountdown = () => {
		const now = Date.now();
		const remainingMs = serverStartTime - now;

		if (remainingMs <= 0) {
			countdownDiv.textContent = "";
			countdownDiv.style.display = "none";
			return;
		}

		const seconds = Math.ceil(remainingMs / 1000);
		countdownDiv.textContent = seconds.toString();
		requestAnimationFrame(updateCountdown);
	};

	updateCountdown();

	const delay = Math.max(0, serverStartTime - Date.now());
	setTimeout(() => this.startLoop(), delay);
}

	syncToServerFrame(serverFrameId: number) {
		this.clientFrame = serverFrameId;

		for (const paddle of this.board.paddles) {
			paddle.buffer.syncToServerFrame(serverFrameId);
		}
	}

	/**
	 * Starts the game loop.
	 */
	private startLoop() {
		if (this.running) return;
		this.running = true;
		this.lastTime = performance.now();

		const loop = (timestamp: number) => {
			if (!this.running) return;

			let dt = (timestamp - this.lastTime) / 1000;
			this.lastTime = timestamp;

			if (dt > 0.25) dt = 0.25;

			this.acc += dt;

			while (this.acc >= this.FIXED_DT) {
				this.acc -= this.FIXED_DT;
				this.clientFrame += 1;

				// --- appliquer hold-state local (PRÉDIRE localement) ---
				if (this.board.playerPaddle) {
					const localHold = this.board.playerPaddle.buffer.getCurrentHoldState();
					this.board.playerPaddle.setHoldState(localHold.up, localHold.down);
				}

				// appliquer inputs distants aux autres paddles
				for (const paddle of this.board.paddles) {
					if (paddle === this.board.playerPaddle) continue;
					paddle.buffer.applyToPaddleForFrame(paddle, this.clientFrame);
				}

				// simulate physics tick
				this.board.update(this.FIXED_DT);
			}

			this.board.draw();

			requestAnimationFrame(loop);
		};

		requestAnimationFrame(loop);
	}
}



const pongBoard = new PongBoard(board);
const pongGame = new PongGame(pongBoard);

const countdownDiv = document.createElement("div");
countdownDiv.style.position = "absolute";
countdownDiv.style.inset = "0";
countdownDiv.style.display = "flex";
countdownDiv.style.alignItems = "center";
countdownDiv.style.justifyContent = "center";
countdownDiv.style.fontSize = "96px";
countdownDiv.style.color = "white";
countdownDiv.style.fontFamily = "monospace";
countdownDiv.style.background = "rgba(0,0,0,0.4)";
countdownDiv.style.pointerEvents = "none";
board.appendChild(countdownDiv);


pongGame.syncToServerFrame(0);
pongGame.startAt(window.pendingGameStart!.startTime);