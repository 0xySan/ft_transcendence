// reorganized-pong.ts
import type { Settings } from "../global";
import type { gameStartAckPayload } from "./lobbySocket";

/* -------------------------------------------------------------------------- */
/*                               GLOBAL DECLARATIONS                           */
/* -------------------------------------------------------------------------- */

declare global {
	interface Window {
		socket?: WebSocket;
		localPlayerId?: string;
		pendingGameStart?: gameStartAckPayload;
		lobbySettings?: Settings;
	}
}

export {};

/** ### addListener
 * - Adds an event listener to the specified target.
 * - The function is preferable to enable the dynamicLoading to remove listeners on page unload.
 * @param target - the EventTarget to attach the listener to
 * @param event - the event type to listen for
 * @param handler - the event handler function
 */
declare function addListener(
	target: EventTarget | null,
	event: string,
	handler: any,
): void;

/** ### loadPage
 * - Loads a new page by URL.
 * - Use the dynamic page loader to ensure proper cleanup.
 * @param url - The URL of the page to load.
 */
declare function loadPage(url: string): void;


/* -------------------------------------------------------------------------- */
/*                                   GLOBAL TYPES                              */
/* -------------------------------------------------------------------------- */

/** ### KeyName
 * - **up**  : move paddle up
 * - **down**: move paddle down
 */
export type KeyName = "up" | "down";

/** ### GameInput
 * - **key**: which control
 * - **pressed**: true = down, false = up
 */
export interface GameInput {
	key: KeyName;
	pressed: boolean;
}

/** ### InputFrame
 * - **frameId**: frame number to apply inputs at
 * - **inputs**: snapshot of GameInput for that frame
 */
export interface InputFrame {
	frameId: number;
	inputs: GameInput[];
}

/** ### ClientInputPayload
 * - **userId**: who sent the inputs
 * - **inputs**: frames array
 */
interface ClientInputPayload {
	userId: string;
	inputs: InputFrame[];
}

/* -------------------------------------------------------------------------- */
/*                                     SANITY CHECKS                           */
/* -------------------------------------------------------------------------- */

/** ### assertElement
 * Assert that an HTMLElement exists and return it typed.
 * Throws a user-facing error if not found.
 */
function assertElement<T extends HTMLElement>(element: HTMLElement | null, message?: string): T {
	if (!element) {
		notify(message || "Element not found", { type: "error" });
		throw new Error(message || "Element not found");
	}
	return (element as T);
}

/**
 * The main pong board container.
 */
const board = assertElement<HTMLDivElement>(document.getElementById("pong-board"), "Pong board not found");

/** ### cancelLoading
 * - display error message on board and notify user
 * @param message - The error message to display.
 * @throws An error to halt further execution.
 */
function cancelLoading(message: string): void {
	board.innerHTML = `<div class="loading-error">${message}</div>`;
	notify(message, { type: "error" });
	throw new Error(message);
}

// check required globals for game operation
if (!window.lobbySettings) cancelLoading("Lobby settings are not available.");
if (!window.socket || window.socket.readyState !== WebSocket.OPEN) cancelLoading("WebSocket connection is not established.");
if (!window.localPlayerId) cancelLoading("Local player ID is not set.");
if (!window.pendingGameStart) cancelLoading("No pending game start information found.");

/* -------------------------------------------------------------------------- */
/*                                  RENDERING                                 */
/* -------------------------------------------------------------------------- */

/** ### PongBoardCanvas
 * - creates and manages a canvas sized to the game world
 * - scales with container while keeping internal resolution
 */
class PongBoardCanvas {
	/** The **HTMLCanvasElement** used for rendering the pong board. */
	canvas: HTMLCanvasElement;
	/** The **CanvasRenderingContext2D** for drawing on the canvas. */
	context: CanvasRenderingContext2D;
	/** The width of the game world in pixels. */
	private worldWidth: number;
	/** The height of the game world in pixels. */
	private worldHeight: number;

	/**
	 * Constructor for PongBoardCanvas.
	 * @param container - The HTMLDivElement to which the canvas will be appended.
	 */
	constructor(container: HTMLDivElement) {
		this.canvas = document.createElement("canvas");
		this.context = this.canvas.getContext("2d") as CanvasRenderingContext2D;
		this.canvas.id = "pong-canvas";

		const settings = window.lobbySettings!;
		this.worldWidth = settings.world.width;
		this.worldHeight = settings.world.height;

		this.canvas.width = this.worldWidth;
		this.canvas.height = this.worldHeight;

		container.appendChild(this.canvas);

		this.resize();
		window.addEventListener("resize", () => this.resize());
	}

	/** ### resize
	 * - Resizes the canvas to fit its container while maintaining aspect ratio.
	 */
	private resize() {
		const parent = this.canvas.parentElement!;
		const availW = parent.clientWidth;
		const availH = parent.clientHeight;
		const scale = Math.min(availW / this.worldWidth, availH / this.worldHeight);
		// use CSS scaling to keep canvas internal resolution intact
		this.canvas.style.width = `${this.worldWidth * scale}px`;
		this.canvas.style.height = `${this.worldHeight * scale}px`;
	}
}

/* -------------------------------------------------------------------------- */
/*                                 INPUT BUFFER                                */
/* -------------------------------------------------------------------------- */

/**
 * ### InputBuffer
 * - manages local input state and remote authoritative snapshots
 */
export class InputBuffer {
	/** current local hold-state for prediction */
	private currentHold = new Map<KeyName, boolean>();
	/** remote authoritative snapshots by frameId */
	private remoteFrames = new Map<number, GameInput[]>();

	/** ### constructor
	 * - initializes the InputBuffer
	 */
	constructor() {
		this.currentHold.set("up", false);
		this.currentHold.set("down", false);
	}

	/** ### getCurrentHoldState
	 * - return the current local hold-state
	 * @returns An object representing the current hold state for "up" and "down" keys.
	 */
	public getCurrentHoldState(): { up: boolean; down: boolean } {
		return {
			up: this.currentHold.get("up") === true,
			down: this.currentHold.get("down") === true,
		};
	}

	/** ### setKeyAndBuildFrame
	 * - update hold-state for a key and build an InputFrame if state changed
	 * @param key - The key to update ("up" or "down").
	 * @param pressed - The new state of the key (true for pressed, false for released).
	 * @param frameId - The frame ID to associate with the input frame.
	 * @returns An InputFrame if the state changed, otherwise null.
	 */
	public setKeyAndBuildFrame(
		key: KeyName,
		pressed: boolean,
		frameId: number,
	): InputFrame | null {
		const prev = this.currentHold.get(key) || false;
		if (prev === pressed) return null;

		this.currentHold.set(key, pressed);

		return {
			frameId,
			inputs: [{ key, pressed }],
		};
	}

	/* ---------------- remote handling ---------------- */

	/** ### pushRemoteFrames
	 * - store authoritative snapshots from server
	 * @param frames - Array of InputFrame to store.
	 */
	public pushRemoteFrames(frames: InputFrame[]): void {
		for (const f of frames) {
			// copy inputs to avoid accidental mutation
			this.remoteFrames.set(f.frameId, f.inputs.map(i => ({ ...i })));
		}
	}

	/** ### getRemoteInputsForFrame
	 * - retrieve authoritative snapshot for a specific frame
	 * @param frameId - The frame ID to retrieve inputs for.
	 * @returns An array of GameInput if found, otherwise undefined.
	 */
	public getRemoteInputsForFrame(frameId: number): GameInput[] | undefined {
		return this.remoteFrames.get(frameId);
	}

	/** ### getHoldStateForRemoteFrame
	 * - retrieve hold-state for a remote frame (fallback if no snapshot)
	 * @param frameId - The frame ID to retrieve hold state for.
	 * @returns An object representing the hold state for "up" and "down" keys.
	 */
	public getHoldStateForRemoteFrame(frameId: number): { up: boolean; down: boolean } {
		let cur = frameId;
		const limit = Math.max(frameId - 300, 0);

		while (cur >= limit) {
			const snap = this.remoteFrames.get(cur);
			if (snap) return this.inputsToHoldState(snap);
			cur -= 1;
		}
		return { up: false, down: false };
	}

	/** ### inputsToHoldState
	 * - convert an array of GameInput to a hold-state object
	 * @param inputs - Array of GameInput to convert.
	 * @returns An object representing the hold state for "up" and "down" keys.
	 */
	private inputsToHoldState(inputs: GameInput[]): { up: boolean; down: boolean } {
		let up = false;
		let down = false;
		for (const i of inputs) {
			if (i.key === "up") up = i.pressed;
			if (i.key === "down") down = i.pressed;
		}
		return { up, down };
	}
}

/* -------------------------------------------------------------------------- */
/*                                     PADDLE                                  */
/* -------------------------------------------------------------------------- */

/**
 * Paddle
 * - local visual & physics representation of a player**s paddle
 * - buffer: InputBuffer instance used both for local and remote data
 */
class Paddle {
	/** Position x of the paddle */
	private x: number;
	/** Position y of the paddle */
	private y: number;
	/** Width of the paddle */
	private width: number;
	/** Height of the paddle */
	private height: number;
	/** The CanvasRenderingContext2D for drawing the paddle. */
	private context: CanvasRenderingContext2D;
	/** Color of the paddle */
	private color = "white";
	/** InputBuffer instance for managing inputs */
	public buffer: InputBuffer;
	/** Up hold state */
	private up = false;
	/** Down hold state */
	private down = false;
	private vy = 0;

	/** ### constructor for Paddle
	 * @param x - position x
	 * @param y - position y
	 * @param width - width
	 * @param height - height
	 * @param context - CanvasRenderingContext2D for drawing
	 */
	constructor(x: number, y: number, width: number, height: number, context: CanvasRenderingContext2D) {
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
		this.context = context;
		this.buffer = new InputBuffer();
	}

	/** ### applyInputs
	 * - apply a set of inputs to the paddle (immediate effect)
	 * @param inputs - Array of GameInput to apply.
	 */
	applyInputs(inputs: GameInput[]) {
		for (const input of inputs) {
			if (input.key === "up") this.up = input.pressed;
			if (input.key === "down") this.down = input.pressed;
		}
	}

	/** ### setHoldState
	 * - set the hold-state for the paddle
	 * @param up - whether the up key is held
	 * @param down - whether the down key is held
	 */
	setHoldState(up: boolean, down: boolean) {
		this.up = up;
		this.down = down;
	}

	/** ### update
	 * - update paddle position based on hold-state and physics
	 * @param dt - delta time since last update
	 */
	update(dt: number) {
		const padCfg = window.lobbySettings!.paddles;

		if (this.up && !this.down) this.vy -= padCfg.acceleration * dt;
		else if (this.down && !this.up) this.vy += padCfg.acceleration * dt;
		else this.vy *= Math.pow(padCfg.friction, dt * 60);

		// clamp velocity
		if (this.vy > padCfg.maxSpeed) this.vy = padCfg.maxSpeed;
		if (this.vy < -padCfg.maxSpeed) this.vy = -padCfg.maxSpeed;

		this.y += this.vy * dt;

		// clamp to field
		const field = window.lobbySettings!.field;
		const top = field.wallThickness;
		const bottom = window.lobbySettings!.world.height - field.wallThickness - this.height;
		if (this.y < top) { this.y = top; this.vy = 0; }
		if (this.y > bottom) { this.y = bottom; this.vy = 0; }
	}

	/** ### draw
	 * - draw the paddle on the canvas
	 */
	draw() {
		this.context.fillStyle = this.color;
		this.context.fillRect(this.x, this.y, this.width, this.height);
	}
}

/* -------------------------------------------------------------------------- */
/*                                     BOARD                                   */
/* -------------------------------------------------------------------------- */

/**
 * ### PongBoard
 * - creates paddles for players and manages drawing / updates
 */
class PongBoard {
	/** The PongBoardCanvas used for rendering the pong board. */
	private canvas: PongBoardCanvas;
	/** Array of Paddle instances representing the players' paddles. */
	public paddles: Paddle[] = [];
	/** The Paddle instance representing the local player's paddle. */
	public playerPaddle: Paddle;
	/** Map of player IDs to their corresponding Paddle instances. */
	private paddleByPlayerId = new Map<string, Paddle>();

	/** ### constructor of PongBoard
	 * @param container - The HTMLDivElement to contain the pong board.
	 */
	constructor(container: HTMLDivElement) {
		this.canvas = new PongBoardCanvas(container);
		const context = this.canvas.context;

		const playerSides = window.pendingGameStart!.playerSides;

		for (const [playerId, side] of Object.entries(playerSides)) {
			let x: number, y: number;
			const padW = window.lobbySettings!.paddles.width;
			const padH = window.lobbySettings!.paddles.height;

			if (side === "top-left" || side === "bottom-left" || side === "left") x = 50;
			else x = this.canvas.canvas.width - 50 - padW;

			if (side === "top-left" || side === "top-right") y = 50;
			else if (side === "bottom-left" || side === "bottom-right") y = this.canvas.canvas.height - 50 - padH;
			else y = (this.canvas.canvas.height - padH) / 2;

			const paddle = new Paddle(x, y, padW, padH, context);
			this.paddles.push(paddle);
			this.paddleByPlayerId.set(playerId, paddle);
		}

		this.playerPaddle = this.paddleByPlayerId.get(window.localPlayerId!)!;
	}

	/** ### getPaddleByPlayerId
	 * - retrieve the Paddle instance for a given player ID
	 * @param playerId - The player ID to look up.
	 * @returns The Paddle instance if found, otherwise undefined.
	 */
	public getPaddleByPlayerId(playerId: string): Paddle | undefined {
		return this.paddleByPlayerId.get(playerId);
	}

	/** ### update
	 * - update all paddles on the board
	 * @param dt - delta time since last update
	 */
	public update(dt: number) {
		for (const p of this.paddles) p.update(dt);
	}

	/** ### draw
	 * - draw the pong board and all paddles
	 */
	public draw() {
		const ctx = (this.canvas as any).context as CanvasRenderingContext2D;
		ctx.fillStyle = "black";
		ctx.fillRect(0, 0, (this.canvas as any).canvas.width, (this.canvas as any).canvas.height);
		for (const p of this.paddles) p.draw();
	}
}

/* -------------------------------------------------------------------------- */
/*                                 SOCKET / MESSAGES                          */
/* -------------------------------------------------------------------------- */

addListener(window.socket!, "message", (event: MessageEvent) => {
	const msg = JSON.parse(event.data);
	if (msg.type !== "input") return;

	const payload = msg.payload as ClientInputPayload;
	const paddle = pongBoard.getPaddleByPlayerId(payload.userId);
	if (!paddle) return;

	// store authoritative frames
	paddle.buffer.pushRemoteFrames(payload.inputs);

	// apply the last snapshot immediately for visual responsiveness
	const last = payload.inputs[payload.inputs.length - 1];
	if (last) paddle.applyInputs(last.inputs);
});

addListener(window.socket!, "close", () => {
	notify("Connection lost.", { type: "warning" });
	setTimeout(() => { loadPage("lobby"); }, 3000);
});

/* -------------------------------------------------------------------------- */
/*                                 INPUT HANDLING                             */
/* -------------------------------------------------------------------------- */

addListener(window, "keydown", (event: KeyboardEvent) => handleKey(event, true));
addListener(window, "keyup", (event: KeyboardEvent) => handleKey(event, false));

/** ### handleKey
 * - process key events for paddle control
 * @param event - The keyboard event.
 * @param pressed - true if key is pressed, false if released
 */
function handleKey(event: KeyboardEvent, pressed: boolean) {
	let direction: KeyName | null = null;
	if (event.key === "ArrowUp" || event.key === "w") direction = "up";
	else if (event.key === "ArrowDown" || event.key === "s") direction = "down";
	if (!direction) return;

	// prevent page scroll on arrow keys
	event.preventDefault();

	const buffer = pongBoard.playerPaddle.buffer;

	// build a frame only on transition
	const frameId = pongGame.getCurrentFrame();
	const frame = buffer.setKeyAndBuildFrame(direction, pressed, frameId);
	if (!frame) return;

	// send with user id to let server attribute frames
	window.socket!.send(JSON.stringify({
		type: "input",
		payload: {
			userId: window.localPlayerId!,
			inputs: [frame],
		} as ClientInputPayload
	}));
}

/* -------------------------------------------------------------------------- */
/*                                  GAME LOOP                                  */
/* -------------------------------------------------------------------------- */

/*### PongGame
 * - manages the main game loop, including timing and local prediction
 */
class PongGame {
	/** The PongBoard instance representing the game board. */
	private board: PongBoard;
	/** Whether the game loop is currently running. */
	private running = false;
	/** The last timestamp recorded in the game loop. */
	private lastTime = 0;
	/** Accumulator for fixed-step timing. */
	private acc = 0;
	/** The current client frame number. */
	private clientFrame = 0;
	/** Fixed delta time for updates (1/60 seconds). */
	private readonly FIXED_DT = 1 / 60;

	/** ### constructor for PongGame
	 * @param board - The PongBoard instance to manage.
	 */
	constructor(board: PongBoard) {
		this.board = board;
	}

	/** ### startAt
	 * - starts the game loop at a specified server start time
	 * @param serverStartTime - The server start time in milliseconds.
	 */
	public startAt(serverStartTime: number) {
		// compute an initial frame that corresponds to elapsed time since server start
		const computeInitialFrame = (serverStart: number) => {
			const now = Date.now();
			const elapsedMs = Math.max(0, now - serverStart);
			const frame = Math.floor(elapsedMs / (1000 / 60));
			return frame;
		};

		this.clientFrame = computeInitialFrame(serverStartTime);

		const updateCountdown = () => {
			const now = Date.now();
			const remainingMs = serverStartTime - now;
			if (remainingMs <= 0) {
				countdownDiv.textContent = "";
				countdownDiv.style.display = "none";
				return;
			}
			countdownDiv.textContent = String(Math.ceil(remainingMs / 1000));
			requestAnimationFrame(updateCountdown);
		};
		updateCountdown();

		const delay = Math.max(0, serverStartTime - Date.now());
		setTimeout(() => this.startLoop(), delay);
	}

	/** ### getCurrentFrame
	 * - retrieves the current client frame number
	 * @returns The current client frame number.
	 */
	public getCurrentFrame(): number {
		return this.clientFrame;
	}

	/** ### startLoop
	 * - starts the main game loop with fixed-step updates and rendering
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

				// apply local prediction
				const localHold = this.board.playerPaddle.buffer.getCurrentHoldState();
				this.board.playerPaddle.setHoldState(localHold.up, localHold.down);

				// apply remote inputs for other paddles (snapshot or hold-state fallback)
				for (const paddle of this.board.paddles) {
					if (paddle === this.board.playerPaddle) continue;
					const snap = paddle.buffer.getRemoteInputsForFrame(this.clientFrame);
					if (snap) paddle.applyInputs(snap);
					else {
						const hold = paddle.buffer.getHoldStateForRemoteFrame(this.clientFrame);
						paddle.setHoldState(hold.up, hold.down);
					}
				}

				// step local simulation
				this.board.update(this.FIXED_DT);
			}

			// render
			this.board.draw();
			requestAnimationFrame(loop);
		};

		requestAnimationFrame(loop);
	}
}

/* -------------------------------------------------------------------------- */
/*                                   BOOTSTRAP                                 */
/* -------------------------------------------------------------------------- */

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

// start the game using the server-provided startTime
pongGame.startAt(window.pendingGameStart!.startTime);
