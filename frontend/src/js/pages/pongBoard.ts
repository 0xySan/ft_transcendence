// reorganized-pong.ts
import type { BallSettings, PlayerPayload, Settings } from "../global";
import type { gameStartAckPayload, PlayerSide, PlayerSideMap } from "./lobbySocket";

/* -------------------------------------------------------------------------- */
/*                               GLOBAL DECLARATIONS                          */
/* -------------------------------------------------------------------------- */

declare global {
	interface Window {
		socket?: WebSocket;
		localPlayerId?: string;
		pendingGameStart?: gameStartAckPayload;
		lobbySettings?: Settings;
		playerNames?: Record<string, string>;
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
/*                                   GLOBAL TYPES                             */
/* -------------------------------------------------------------------------- */

/** ### KeyName
 * - **up**	: move paddle up
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
/*                                     SANITY CHECKS                          */
/* -------------------------------------------------------------------------- */

/** ### assertElement
 * Assert that an HTMLElement exists and return it typed.
 * Throws a user-facing error if not found.
 */
function assertElement<T extends HTMLElement | SVGElement>(element: HTMLElement | null, message?: string): T {
	if (!element) {
		window.notify(message || "Element not found", { type: "error" });
		throw new Error(message || "Element not found");
	}
	return (element as T);
}

/**
 * The main pong board container.
 */
const board = assertElement<HTMLDivElement>(document.getElementById("pong-board"), "Pong board not found");
/**
 * The countdown overlay element.
 */
const countdownDiv = assertElement<HTMLDivElement>(document.querySelector(".countdown-overlay"), "Countdown overlay not found");

/** ### cancelLoading
 * - display error message on board and notify user
 * @param message - The error message to display.
 * @throws An error to halt further execution.
 */
function cancelLoading(message: string): void {
	board.innerHTML = `<div class="loading-error">${message}</div>`;
	window.notify(message, { type: "error" });
	throw new Error(message);
}

// check required globals for game operation
if (!window.lobbySettings) cancelLoading("Lobby settings are not available.");

if (window.isGameOffline) // If we play online
{
	window.pendingGameStart = {
		action: "start",
		playerSides: {
			user1: "left",
			user2: "right",
		},
		startTime: Date.now() + 3000
	}
	window.localPlayerId = "user1";
} else {
	if (!window.socket || window.socket.readyState !== WebSocket.OPEN) cancelLoading("WebSocket connection is not established.");
	if (!window.localPlayerId) cancelLoading("Local player ID is not set.");
	if (!window.pendingGameStart) cancelLoading("No pending game start information found.");
}

/* -------------------------------------------------------------------------- */
/*                                      TIMER                                 */
/* -------------------------------------------------------------------------- */

// MM:SS morphing timer — uses colon squares and JS-controlled blink,

const digitSegments: { [key: number]: number[][][] } = {
	0: [
		[[0, 0], [1, 0]],
		[[1, 0], [1, 1]],
		[[1, 1], [1, 2]],
		[[1, 2], [0, 2]],
		[[0, 2], [0, 1]],
		[[0, 1], [0, 0]],
		[[0, 0], [1, 0]]
	],

	1: [
		[[1, 0], [1, 0]],
		[[1, 0], [1, 1]],
		[[1, 1], [1, 2]],
		[[1, 2], [1, 2]],
		[[1, 2], [1, 1]],
		[[1, 1], [1, 0]],
		[[1, 0], [1, 0]]
	],

	2: [
		[[1, 0], [0, 0]],
		[[1, 0], [1, 1]],
		[[0, 1], [1, 1]],
		[[1, 2], [0, 2]],
		[[0, 2], [0, 1]],
		[[1, 1], [1, 0]],
		[[1, 0], [0, 0]]
	],

	3: [
		[[1, 0], [0, 0]],
		[[1, 0], [1, 1]],
		[[1, 1], [0, 1]],
		[[0, 2], [1, 2]],
		[[1, 2], [1, 1]],
		[[1, 1], [1, 0]],
		[[1, 0], [0, 0]]
	],

	4: [
		[[1, 0], [1, 0]],
		[[0, 0], [0, 1]],
		[[1, 1], [0, 1]],
		[[1, 2], [1, 2]],
		[[1, 2], [1, 1]],
		[[1, 1], [1, 0]],
		[[1, 0], [1, 0]]
	],

	5: [
		[[1, 0], [0, 0]],
		[[0, 0], [0, 1]],
		[[1, 1], [0, 1]],
		[[0, 2], [1, 2]],
		[[1, 2], [1, 1]],
		[[1, 0], [1, 0]],
		[[1, 0], [0, 0]]
	],

	6: [
		[[1, 0], [0, 0]],
		[[0, 0], [0, 2]],
		[[1, 1], [0, 1]],
		[[0, 2], [1, 2]],
		[[1, 2], [1, 1]],
		[[0, 0], [0, 0]],
		[[1, 0], [0, 0]]
	],

	7: [
		[[0, 0], [1, 0]],
		[[1, 0], [1, 1]],
		[[1, 1], [1, 1]],
		[[1, 2], [1, 2]],
		[[1, 2], [1, 1]],
		[[0, 0], [0, 0]],
		[[0, 0], [1, 0]]
	],

	8: [
		[[0, 0], [1, 0]],
		[[1, 0], [1, 2]],
		[[1, 1], [0, 1]],
		[[1, 2], [0, 2]],
		[[0, 2], [0, 1]],
		[[0, 1], [0, 0]],
		[[0, 0], [0, 0]]
	],

	9: [
		[[0, 0], [1, 0]],
		[[1, 0], [1, 2]],
		[[1, 1], [0, 1]],
		[[1, 2], [0, 2]],
		[[0, 1], [0, 1]],
		[[0, 1], [0, 0]],
		[[0, 0], [0, 0]]
	]
};

/* configuration */
const NUM_DIGITS = 4; // MMSS
const COLON_X = 6.2; // colon translate x
const COLON_MID_Y = 0.9; // center between top/bottom colon dots (dots at 0 and 1.4)
const DIGIT_VERTICAL_CENTER = 0.5; // digits internal center (their coordinate mid)
const VERTICAL_ADJUST = COLON_MID_Y - DIGIT_VERTICAL_CENTER; // shift to center digits on colon
const DIGIT_OFFSETS = [-4, -2, 2, 4]; // horizontal offsets relative to colon X
const DISPLAY_SCALE = 1.6; // scale each digit group

/* DOM refs */
const digitsContainer = assertElement<SVGGElement>(document.getElementById("digits"), "Digits container not found");
const colon = assertElement<SVGElement>(document.getElementById("colon"), "Colon element not found");

/** ### createDigits
 * - initializes the 4-digit SVG display structure
 * - creates groups and segment paths for each digit
 * - sets initial segment shapes to "0"
 */
function createDigits() {
	digitsContainer.innerHTML = "";

	for (let i = 0; i < NUM_DIGITS; i++) {
		// Create a group (<g>) for this digit
		const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
		g.classList.add("digit");

		// Compute the horizontal offset using pre-calculated spacing
		const offsetX = COLON_X + DIGIT_OFFSETS[i];

		// Vertically align the digit relative to the colon
		g.setAttribute(
			"transform",
			`translate(${offsetX} ${VERTICAL_ADJUST}) scale(${DISPLAY_SCALE})`
		);

		// Create the 7 path segments for the digit
		for (let s = 0; s < 7; s++) {
			const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
			p.classList.add("seg" + s); // For debugging / color distinction

			// Initialize each segment to the "0" digit shape
			const init =
				digitSegments[0] && digitSegments[0][s]
					? digitSegments[0][s]
					: [
							[0, 0],
							[0, 0]
						];

			p.setAttribute(
				"d",
				`M${init[0][0]} ${init[0][1]} L${init[1][0]} ${init[1][1]}`
			);
			g.appendChild(p);
		}

		// Add the digit group to the main container
		digitsContainer.appendChild(g);
	}
}


/** ### secondsToMMSS
 * - converts a total number of seconds into a "MMSS" string format
 * @param sec total seconds to convert
 * @returns string in "MMSS" format representing minutes and seconds
 */
function secondsToMMSS(sec: number): string {
	const minutes = Math.floor(sec / 60);
	const seconds = sec % 60;
	return String(minutes).padStart(2, "0") + String(seconds).padStart(2, "0");
}

/** ### updateDisplayFromSeconds
 * - updates the 4-digit SVG display based on a total seconds value
 * @param totalSeconds total seconds to display (0–5999)
 */
function updateDisplayFromSeconds(totalSeconds: number) {
	const mmss = secondsToMMSS(totalSeconds);

	const groups = digitsContainer.querySelectorAll("g.digit");
	// Update each group (each digit)
	groups.forEach((g, idx) => {
		// Get the numeric value of this digit
		const ch = Number(mmss[idx]);

		// Get segment definitions for this digit, fallback to "0"
		const segDefs = digitSegments[ch] || digitSegments[0];

		// Select all segment <path> elements in the group
		const paths = g.querySelectorAll("path");

		// Update each segment line according to the target digit
		paths.forEach((p, sIdx) => {
			const seg = segDefs[sIdx] || [
				[0, 0],
				[0, 0]
			];
			const d = `M${seg[0][0]} ${seg[0][1]} L${seg[1][0]} ${seg[1][1]}`;
			p.setAttribute("d", d);
		});
	});
}

/** ### colonTimeout
 * - timeout ID for colon blink removal
 */
let colonTimeout: number | null = null;

/** ### blinkColon
 * - blinks the colon element by toggling its "active" class
 * @param ms duration in milliseconds for the blink @default 600
 */
function blinkColon(ms = 600) {
	if (!colon) return;
	colon.classList.add("active");
	if (colonTimeout) clearTimeout(colonTimeout);
	colonTimeout = setTimeout(() => colon.classList.remove("active"), ms);
}

// timer state
/** total seconds elapsed for the timer */
let seconds = 0;
/** interval ID for the timer */
let timerId: number | null = null;
/** whether the timer is currently paused */
let paused = false;

/** ### startTimer
 * - starts the timer interval and marks it as running
 */
function startTimer() {
	if (timerId) return;
	timerId = setInterval(() => {
		seconds = (seconds + 1) % 6000;
		updateDisplayFromSeconds(seconds);
		blinkColon();
	}, 1000);
	paused = false;
}

/** ### stopTimer
 * - stops the timer interval and marks it as paused
 */
function stopTimer() {
	if (timerId) {
		clearInterval(timerId);
		timerId = null;
	}
	paused = true;
}

/* -------------------------------------------------------------------------- */
/*                                   RENDERING                                */
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
		addListener(window, "resize", () => this.resize());
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
/*	                          INPUT BUFFER                                    */
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
	public destroy() {
	this.remoteFrames.clear();
	}
}

/* -------------------------------------------------------------------------- */
/* 	                                PADDLE                                    */
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

		// console.log("--- PADDLE UPDATE ---");
		// console.log(this.y);
		// console.log(this.height);
		// console.log(this.x)
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
/*                                        BALL                                */
/* -------------------------------------------------------------------------- */

/** ### Ball
 * - represents the pong ball
 * - handles movement, collision with walls and paddles
 */
class Ball {
	public x: number = 0;
	public y: number = 0;
	public vx: number = 0;
	public vy: number = 0;
	public radius: number;
	private context: CanvasRenderingContext2D;
	private settings: BallSettings;

	/** ### constructor
	 * @param context - CanvasRenderingContext2D to draw the ball
	 * @param settings - BallSettings object from lobbySettings
	 */
	constructor(context: CanvasRenderingContext2D, settings: BallSettings) {
		this.context = context;
		this.settings = settings;

		this.radius = settings.radius;
		this.reset();
	}

	/** ### reset
	 * - reset ball to center with random initial direction
	 */
	reset() {
		const world = window.lobbySettings!.world;
		this.x = world.width / 2;
		this.y = world.height / 2;

		const dir = Math.random() < 0.5 ? -1 : 1;
		const angle = (Math.random() - 0.5) * this.settings.initialAngleRange;
		this.vx = this.settings.initialSpeed * dir * Math.cos(angle);
		this.vy = this.settings.initialSpeed * Math.sin(angle);
	}

	/** ### update
	 * - move ball and handle collision with top/bottom walls
	 * @param dt - delta time
	 */
	update(dt: number) {
		this.x += this.vx * dt;
		this.y += this.vy * dt;

		const field = window.lobbySettings!.field;
		const world = window.lobbySettings!.world;

		// bounce off top
		if (this.y - this.radius <= field.wallThickness) {
			this.y = field.wallThickness + this.radius;
			this.vy = Math.abs(this.vy);
		}

		// bounce off bottom
		if (this.y + this.radius >= world.height - field.wallThickness) {
			this.y = world.height - field.wallThickness - this.radius;
			this.vy = -Math.abs(this.vy);
		}
	}

	/** ### checkPaddleCollision
	 * - check collision with a paddle and adjust velocity
	 * @param paddle - Paddle instance
	 */
	checkPaddleCollision(paddle: Paddle) {
		const padCfg = window.lobbySettings!.paddles;

		if (
			this.x + this.radius >= paddle["x"] &&
			this.x - this.radius <= paddle["x"] + paddle["width"] &&
			this.y >= paddle["y"] &&
			this.y <= paddle["y"] + paddle["height"]
		) {
			this.vx = -this.vx;

			const rel = (this.y - paddle["y"]) / paddle["height"] - 0.5;
			this.vy += rel * this.settings.speedIncrement;

			// clamp speed
			const speed = Math.hypot(this.vx, this.vy);
			if (speed > this.settings.maxSpeed) {
				const factor = this.settings.maxSpeed / speed;
				this.vx *= factor;
				this.vy *= factor;
			}
		}
	}

	/** ### draw
	 * - render the ball on the canvas
	 */
	draw() {
		this.context.fillStyle = "white";
		this.context.beginPath();
		this.context.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
		this.context.fill();
	}
}

/* -------------------------------------------------------------------------- */
/*                                     BOARD                                  */
/* -------------------------------------------------------------------------- */

interface PaddleUpdate {
	playerId: string;
	position: { x: number; y: number };
	width: number;
	height: number;
}

interface BallUpdate {
	position: { x: number; y: number };
	velocity: { x: number; y: number };
	radius: number;
}

interface GameStateUpdate {
	frameId: number;
	ball: BallUpdate;
	paddles: PaddleUpdate[];
	scores?: { playerId: string; score: number }[];
	state?: string;
}

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
	/** Optional paddle for the second player in offline games */
	public player2Paddle?: Paddle;
	/** Map of player IDs to their corresponding Paddle instances. */
	private paddleByPlayerId = new Map<string, Paddle>();
	/** The Ball instance representing the pong ball. */
	private ball: Ball;

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

		if (window.isGameOffline)
			this.player2Paddle = this.paddleByPlayerId.get("user2")
		this.ball = new Ball(context, window.lobbySettings!.ball);
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
		if (this.ball) this.ball.update(dt);
		for (const p of this.paddles) this.ball.checkPaddleCollision(p);
	}

	/** ### draw
	 * - draw the pong board and all paddles
	 */
	public draw() {
		const ctx = (this.canvas as any).context as CanvasRenderingContext2D;
		ctx.fillStyle = "black";
		ctx.fillRect(0, 0, (this.canvas as any).canvas.width, (this.canvas as any).canvas.height);
		if (this.ball) this.ball.draw();
		for (const p of this.paddles) p.draw();
	}

	/** ### applyUpdate
	 * - Applies a server authoritative game state to the board
	 * @param update - GameStateUpdate payload from server
	 */
	public applyUpdate(update: GameStateUpdate) {
		// update ball
		if (!update || !update.ball) return;
		this.ball.x = update.ball.position.x;
		this.ball.y = update.ball.position.y;
		this.ball.vx = update.ball.velocity.x;
		this.ball.vy = update.ball.velocity.y;

		// update paddles
		for (const pUpdate of update.paddles) {
			const paddle = this.getPaddleByPlayerId(pUpdate.playerId);
			if (!paddle) continue;
			paddle.setHoldState(false, false); // reset local input prediction if needed
			// directly set position
			(paddle as any).x = pUpdate.position.x;
			(paddle as any).y = pUpdate.position.y;
			// optional: update width/height in case server changed config
			(paddle as any).width = pUpdate.width;
			(paddle as any).height = pUpdate.height;
		}

		// update scores
		if (update.scores) {
			updateScores(update.scores);
		}
	}
	public destroy() {
	this.canvas.canvas.remove();
	this.paddles = [];
	this.paddleByPlayerId.clear();
	this.ball = null as any;
	}
}

/* -------------------------------------------------------------------------- */
/*                                 SOCKET / MESSAGES                          */
/* -------------------------------------------------------------------------- */

/** ### updateScores
 * - updates the score display on the UI
 * @param scores - Array of score data from server
 */
function updateScores(scores: { playerId: string; score: number }[]) {
	if (!scores || scores.length === 0) return;

	const playerSides = window.pendingGameStart!.playerSides;
	const scoreLeftEl = document.getElementById("score-left");
	const scoreRightEl = document.getElementById("score-right");

	if (!scoreLeftEl || !scoreRightEl) return;

	let leftScore: number | null = null;
	let rightScore: number | null = null;

	for (const { playerId, score } of scores) {
		const side = playerSides[playerId];
		if (!side) continue;

		if (side === "left" || side === "top-left" || side === "bottom-left") {
			leftScore = leftScore === null ? score : Math.max(leftScore, score);
		} else if (side === "right" || side === "top-right" || side === "bottom-right") {
			rightScore = rightScore === null ? score : Math.max(rightScore, score);
		}
	}

	if (leftScore !== null) scoreLeftEl.textContent = String(leftScore);
	if (rightScore !== null) scoreRightEl.textContent = String(rightScore);
}

function updatePlayerNames() {
    const playerSides = window.pendingGameStart!.playerSides;
    const leftEl = document.getElementById("player-left");
    const leftBottomEl = document.getElementById("player-left-bottom");
    const rightBottomEl = document.getElementById("player-right-bottom");
    const rightEl = document.getElementById("player-right");
	const barBottom = document.getElementById("pong-bar-bottom");

    if (!leftEl || !rightEl || !window.playerNames) return;
	const hasBottomLeft = Object.values(playerSides).includes("bottom-left");
	const hasBottomRight = Object.values(playerSides).includes("bottom-right");
	const hasBottom = hasBottomLeft || hasBottomRight;

	if (!hasBottom) {
		leftBottomEl?.classList.add("unloaded");
		rightBottomEl?.classList.add("unloaded");
		barBottom?.classList.add("unloaded");
	}

    for (const [playerId, side] of Object.entries(playerSides)) {
        const name = window.playerNames[playerId] || playerId;
		if (side.includes("bottom-left") && leftBottomEl) leftBottomEl.textContent = name;
		else if (side.includes("bottom-right") && rightBottomEl) rightBottomEl.textContent = name;
		else if (side.includes("left")) leftEl.textContent = name;
		else if (side.includes("right")) rightEl.textContent = name;
    }
}

function handlePlayer(payload: PlayerPayload) {
	if (payload.action === "join")
		notify(`${payload.displayName} joined the game.`, { type: "info" });
	else if (payload.action === "leave") {
		notify(`${payload.displayName} left the game.`, { type: "warning" });
		
		if (!window.playerSyncData) return;

		let isOwner: boolean = false;
		if (window.playerSyncData.ownerId == payload.playerId) isOwner = true;

		const index = window.playerSyncData.players.findIndex(player => player.playerId === payload.playerId);
		if (index !== -1) window.playerSyncData.players.splice(index, 1);

		// TODO owner verif here
		if (isOwner && window.playerSyncData.players.length > 0) window.playerSyncData.ownerId = window.playerSyncData.players[0].playerId;

		loadPage('/lobby');
	}
}

if (!window.isGameOffline) {
	addListener(window.socket!, "message", (event: MessageEvent) => {
		const msg = JSON.parse(event.data);
		if (msg.type === "input") {
			const payload = msg.payload as ClientInputPayload;
			const paddle = pongBoard.getPaddleByPlayerId(payload.userId);
			if (!paddle) return;

			// store authoritative frames
			paddle.buffer.pushRemoteFrames(payload.inputs);

			// apply the last snapshot immediately for visual responsiveness
			const last = payload.inputs[payload.inputs.length - 1];
			if (last) paddle.applyInputs(last.inputs);
		} else if (msg.type === "game") {
			if (msg.payload.action === "stopped") {
				notify("Game has ended.", { type: "info" });
				stopTimer();
				setTimeout(() => { 
					pongBoard.destroy();
					stopTimer();
					loadPage("lobby"); 
				}, 1000);
			} else {
				const payload = msg.payload as GameStateUpdate;
				pongBoard.applyUpdate(payload);
			}
		} else if (msg.type === "player") {
			{
				const payload = msg.payload as PlayerPayload;
				if (payload.displayName)
					window.playerNames![payload.playerId] = payload.displayName;
				handlePlayer(payload);
				updatePlayerNames();
			}
		}
	});

	addListener(window.socket!, "close", () => {
		notify("Connection lost.", { type: "warning" });
		stopTimer();
		setTimeout(() => { loadPage("lobby"); }, 3000);
	});
}

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

	let buffer: InputBuffer;
	if (!window.isGameOffline)
		buffer = pongBoard.playerPaddle.buffer;
	else {
		if (event.key === "w" || event.key === "s")
			buffer = pongBoard.playerPaddle.buffer;
		else
			buffer = pongBoard.player2Paddle!.buffer;
	}


	// build a frame only on transition
	const frameId = pongGame.getCurrentFrame();
	const frame = buffer.setKeyAndBuildFrame(direction, pressed, frameId);
	if (!frame) return;

	if (!window.isGameOffline) {
		// send with user id to let server attribute frames
		window.socket!.send(JSON.stringify({
			type: "input",
			payload: {
				userId: window.localPlayerId!,
				inputs: [frame],
			} as ClientInputPayload
		}));
	}
}

/* -------------------------------------------------------------------------- */
/*                                  GAME LOOP                                 */
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
		startTimer();
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
					if (paddle === this.board.playerPaddle || (window.isGameOffline && paddle === this.board.player2Paddle)) continue;
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
	public destroy() {
		this.running = false;
		this.board.destroy();
	}
}

/* -------------------------------------------------------------------------- */
/*                                   BOOTSTRAP                                */
/* -------------------------------------------------------------------------- */

const pongBoard = new PongBoard(board);
const pongGame = new PongGame(pongBoard);

updatePlayerNames();

createDigits();
updateDisplayFromSeconds(seconds);
countdownDiv.style.fontSize = "12vh";

// start the game using the server-provided startTime
pongGame.startAt(window.pendingGameStart!.startTime);
