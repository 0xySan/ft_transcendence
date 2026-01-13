// reorganized-pong.ts
import type { BallSettings, PlayerPayload, Settings } from "../global";
import type { gameStartAckPayload } from "./lobbySocket";
import { PongTimer } from "./pongBoardUtils";

/* -------------------------------------------------------------------------- */
/*							   GLOBAL DECLARATIONS						  */
/* -------------------------------------------------------------------------- */

declare global {
	interface Window {
		socket?: WebSocket;
		localPlayerId?: string;
		pendingGameStart?: gameStartAckPayload;
		lobbySettings?: Settings;
		pongTimer: PongTimer;
	}
}

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
/*								   GLOBAL TYPES							 */
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
/*									 SANITY CHECKS						  */
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

/**
 * The main pong board container.
 */
const board = assertElement<HTMLDivElement>(document.getElementById("pong-board"), "Pong board not found");

/**
 * The countdown overlay element.
 */
const countdownDiv = assertElement<HTMLDivElement>(document.querySelector(".countdown-overlay"), "Countdown overlay not found");

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
	};
	window.localPlayerId = "user1";
} else {
	if (!window.socket || window.socket.readyState !== WebSocket.OPEN) cancelLoading("WebSocket connection is not established.");
	if (!window.localPlayerId) cancelLoading("Local player ID is not set.");
	if (!window.pendingGameStart) cancelLoading("No pending game start information found.");
}

function getThemeColors(): { [key: string]: string } {
	const themeElement = document.documentElement; // Get current theme element
	const computedStyles = getComputedStyle(themeElement);

	const colors: { [key: string]: string } = {};

	const colorVariables = [
		'--flamingo', '--maroon', '--sky', '--blue', '--crust', '--mauve', '--red'
	];

	colorVariables.forEach((variable) => {
		const colorValue = computedStyles.getPropertyValue(variable).trim();
		const rgb = `rgb(${colorValue})`;
		colors[variable] = rgb;
	});

	return colors;
}

let currentThemeColors = getThemeColors();

addListener(window, 'themeChange', (event: CustomEvent) => {
	currentThemeColors = getThemeColors();
});

function endGame() {
	notify("Game has ended.", { type: "info" });
	window.pongTimer.stopTimer();
	const navBar = document.getElementById("nav-bar");
	if (navBar) navBar.classList.remove("unloaded");

	setTimeout(() => { 
		pongGame.destroy();
		window.pongTimer.stopTimer();
		loadPage("lobby"); 
	}, 1000);
}


/* -------------------------------------------------------------------------- */
/*								   RENDERING								*/
/* -------------------------------------------------------------------------- */

/** ### PongBoardCanvas
 * - manages the canvas element for rendering the pong board
 * - handles resizing for desktop and mobile
 */
class PongBoardCanvas {
	canvas: HTMLCanvasElement;
	context: CanvasRenderingContext2D;
	private worldWidth: number;
	private worldHeight: number;
	private enforceLandscape?: () => void;

	constructor(container: HTMLDivElement) {
		this.canvas = document.createElement("canvas");
		this.context = this.canvas.getContext("2d") as CanvasRenderingContext2D;
		this.canvas.id = "pong-canvas";

		const settings = window.lobbySettings!;
		this.worldWidth = settings.world.width;
		this.worldHeight = settings.world.height;

		this.canvas.width = this.worldWidth;
		this.canvas.height = this.worldHeight;

		const isMobile = /Mobi|Android/i.test(navigator.userAgent);
		if (isMobile) {
			// mobile fullscreen
			document.body.appendChild(this.canvas);
			this.applyMobileFullscreen();
		} else {
			// desktop: append to container and keep original style
			container.appendChild(this.canvas);
		}

		this.resize();
		window.addEventListener("resize", () => this.resize());
	}

	private resize() {
		const isMobile = /Mobi|Android/i.test(navigator.userAgent);

		if (isMobile) {
			// Full viewport scaling for mobile
			const availW = window.innerWidth;
			const availH = window.innerHeight;
			const scale = Math.min(availW / this.worldWidth, availH / this.worldHeight);

			this.canvas.style.width = `${this.worldWidth * scale}px`;
			this.canvas.style.height = `${this.worldHeight * scale}px`;

			this.canvas.style.position = "fixed";
			this.canvas.style.top = "50%";
			this.canvas.style.left = "50%";
			this.canvas.style.transform = "translate(-50%, -50%)";
			this.canvas.style.display = "block";
			this.canvas.style.zIndex = "9999";
		} else {
			// desktop: scale relative to parent
			const parent = this.canvas.parentElement!;
			const availW = parent.clientWidth;
			const availH = parent.clientHeight;
			const scale = Math.min(availW / this.worldWidth, availH / this.worldHeight);

			this.canvas.style.width = `${this.worldWidth * scale}px`;
			this.canvas.style.height = `${this.worldHeight * scale}px`;
			this.canvas.style.position = "";
			this.canvas.style.top = "";
			this.canvas.style.left = "";
			this.canvas.style.transform = "";
			this.canvas.style.zIndex = "";
		}
	}

	private applyMobileFullscreen() {
		// Fullscreen styles
		document.body.style.margin = "0";
		document.body.style.overflow = "hidden";
		document.body.style.background = "black";

		// enforce landscape on mobile
		this.enforceLandscape = () => {
			if (window.innerWidth < window.innerHeight) {
				const navBar = document.getElementById("nav-bar");
				if (navBar) navBar.classList.add("unloaded");

				if (!document.getElementById("rotate-msg")) {
					const msg = document.createElement("div");
					msg.id = "rotate-msg";
					msg.innerText = "Rotate your device to landscape";
					Object.assign(msg.style, {
						position: "fixed",
						top: "0",
						left: "0",
						width: "100%",
						height: "100%",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						background: "black",
						color: "white",
						fontSize: "2rem",
						zIndex: "10000",
						textAlign: "center",
					});
					document.body.appendChild(msg);
				}
				this.canvas.style.display = "none";
			} else {
				const msg = document.getElementById("rotate-msg");
				if (msg) msg.remove();
				this.canvas.style.display = "block";
			}
			this.resize();
		};

		window.addEventListener("resize", this.enforceLandscape);
		this.enforceLandscape();
	}

	public destroy() {
		this.canvas.remove();
		const msg = document.getElementById("rotate-msg");
		if (msg) msg.remove();

		document.body.style.margin = "";
		document.body.style.overflow = "";
		document.body.style.background = "";

		if (this.enforceLandscape) {
			window.removeEventListener("resize", this.enforceLandscape);
			this.enforceLandscape = undefined;
		}
	}
}




/* -------------------------------------------------------------------------- */
/*							  INPUT BUFFER									*/
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
/* 									PADDLE									*/
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
	private color = "--text";
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
	constructor(x: number, y: number, width: number, height: number, context: CanvasRenderingContext2D, color = "--text") {
		this.color = color;
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
		this.context.fillStyle = currentThemeColors[this.color] || 'white';
		this.context.fillRect(this.x, this.y, this.width, this.height);
	}
}

/* -------------------------------------------------------------------------- */
/*										BALL								*/
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
		this.context.fillStyle = 'white';
		this.context.beginPath();
		this.context.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
		this.context.fill();
	}
	/** ### checkGoal
	 * - check if ball went past left or right edge
	 * @returns "left" if ball passed left edge, "right" if passed right edge, null otherwise
	 */
	checkGoal(): "left" | "right" | null {
		const world = window.lobbySettings!.world;
		if (this.x - this.radius < 0) return "left";
		if (this.x + this.radius > world.width) return "right";
		return null;
	}
}

/* -------------------------------------------------------------------------- */
/*									 BOARD								  */
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
	/** Scores for offline mode */
	private scores = new Map<string, number>();

	/** ### constructor of PongBoard
	 * @param container - The HTMLDivElement to contain the pong board.
	 */
	constructor(container: HTMLDivElement) {
		this.canvas = new PongBoardCanvas(container);
		const context = this.canvas.context;

		const playerSides = window.pendingGameStart!.playerSides;
		const padCfg = window.lobbySettings!.paddles;

		const getPaddlePosition = (side: string) => {
			let x: number, y: number;
			const margin = 50;

			// horizontal
			if (side.includes("left")) x = margin;
			else x = this.canvas.canvas.width - margin - padCfg.width;

			// vertical
			if (side.includes("top")) y = margin;
			else if (side.includes("bottom")) y = this.canvas.canvas.height - margin - padCfg.height;
			else y = (this.canvas.canvas.height - padCfg.height) / 2;

			return { x, y };
		};

		const getPaddleColor = (side: string) => (side.includes("left") ? "--red" : "--blue");

		// create paddles for each player
		for (const [playerId, side] of Object.entries(playerSides)) {
			const { x, y } = getPaddlePosition(side);
			const color = getPaddleColor(side);

			const paddle = new Paddle(x, y, padCfg.width, padCfg.height, context, color);
			this.paddles.push(paddle);
			this.paddleByPlayerId.set(playerId, paddle);
		}

		this.playerPaddle = this.paddleByPlayerId.get(window.localPlayerId!)!;
		if (window.isGameOffline) this.player2Paddle = this.paddleByPlayerId.get("user2");

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

		// Check for goals in offline mode
		if (window.isGameOffline) {
			const goal = this.ball.checkGoal();
			if (goal) {
				this.handleOfflineGoal(goal);
			}
		}
	}

	/** ### handleOfflineGoal
	 * - handle goal scoring in offline mode
	 * @param side - which side was scored on ("left" or "right")
	 */
	private handleOfflineGoal(side: "left" | "right") {
		const playerSides = window.pendingGameStart!.playerSides;
		
		// Find the player who scored (opposite side of goal)
		for (const [playerId, playerSide] of Object.entries(playerSides)) {
			const isLeftPlayer = playerSide.includes("left");
			const isRightPlayer = playerSide.includes("right");
			
			// If goal was on left, right player scored
			if (side === "left" && isRightPlayer) {
				this.scores.set(playerId, (this.scores.get(playerId) || 0) + 1);
			}
			// If goal was on right, left player scored
			else if (side === "right" && isLeftPlayer) {
				this.scores.set(playerId, (this.scores.get(playerId) || 0) + 1);
			}
		}
		
		// Update UI
		const scoresArray = Array.from(this.scores.entries()).map(([playerId, score]) => ({
			playerId,
			score
		}));
		updateScores(scoresArray);
		
		// Reset ball
		this.ball.reset();
		// check for win condition
		const winningScore = window.lobbySettings!.scoring.firstTo;
		for (const score of this.scores.values()) {
			if (score >= winningScore) {
				// Reset window for lobby
				window.isGameOffline = false;
				window.pendingGameStart = undefined;
				window.localPlayerId = undefined;
				window.lobbySettings = undefined;
				// End game
				endGame();
				break;
			}
			}
		}
	
	/** ### draw
	 * - draw the pong board and all paddles
	 */
	public draw() {
		const ctx = (this.canvas as any).context as CanvasRenderingContext2D;
		ctx.fillStyle = currentThemeColors["--crust"] || 'black';
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
		this.scores.clear();
		this.canvas.destroy();
	}
}


/* -------------------------------------------------------------------------- */
/*								 SOCKET / MESSAGES						  */
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

		if (side === "left" || side === "top-left" || side === "bottom-left")
			leftScore = leftScore === null ? score : Math.max(leftScore, score);
		else if (side === "right" || side === "top-right" || side === "bottom-right")
			rightScore = rightScore === null ? score : Math.max(rightScore, score);
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
  const side = window.pendingGameStart?.playerSides;

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

		if (isOwner && window.playerSyncData.players.length > 0) window.playerSyncData.ownerId = window.playerSyncData.players[0].playerId;

		endGame();
	}
}

if (!window.isGameOffline) {
	addListener(window.socket!, "message", (event: MessageEvent) => {
		const msg = JSON.parse(event.data);
		console.log("Received message:", msg);
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
				endGame();
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
		} else {
			endGame();
		}
	});
}

/* -------------------------------------------------------------------------- */
/*								 INPUT HANDLING								  */
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
/*                               TOUCH INPUT HANDLING                          */
/* -------------------------------------------------------------------------- */

// add touch listeners
addListener(window, "touchstart", handleTouch);
addListener(window, "touchmove", handleTouch);
addListener(window, "touchend", handleTouchEnd);

/** handleTouch
 * Convert touch position to paddle inputs
 */
function handleTouch(event: TouchEvent) {
	event.preventDefault(); // prevent scrolling

	const width = window.innerWidth;
	const height = window.innerHeight;

	for (const touch of Array.from(event.touches)) {
		const x = touch.clientX;
		const y = touch.clientY;

		let direction: KeyName | null = null;
		let buffer: InputBuffer;

		// left half = local player paddle, right half = second paddle (offline)
		const isLeftSide = x < width / 2;
		if (isLeftSide) buffer = pongBoard.playerPaddle.buffer;
		else if (window.isGameOffline) buffer = pongBoard.player2Paddle!.buffer;
		else continue;

		// determine vertical zone
		if (y < height / 2) direction = "up";
		else direction = "down";

		// determine frame
		const frameId = pongGame.getCurrentFrame();
		buffer.setKeyAndBuildFrame(direction, true, frameId);
	}
}

/** handleTouchEnd
 * Release all touches
 */
function handleTouchEnd(event: TouchEvent) {
	event.preventDefault();
	const buffers = [pongBoard.playerPaddle.buffer];
	if (window.isGameOffline && pongBoard.player2Paddle)
		buffers.push(pongBoard.player2Paddle.buffer);

	for (const buffer of buffers) {
		const frameId = pongGame.getCurrentFrame();
		buffer.setKeyAndBuildFrame("up", false, frameId);
		buffer.setKeyAndBuildFrame("down", false, frameId);
	}
}


/* -------------------------------------------------------------------------- */
/*								  GAME LOOP								 */
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
		window.pongTimer.startTimer();
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

				// apply local inputs for player2 in offline mode
				if (window.isGameOffline && this.board.player2Paddle) {
					const player2Hold = this.board.player2Paddle.buffer.getCurrentHoldState();
					this.board.player2Paddle.setHoldState(player2Hold.up, player2Hold.down);
				}

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
/*								   BOOTSTRAP								*/
/* -------------------------------------------------------------------------- */

const pongBoard = new PongBoard(board);
const pongGame = new PongGame(pongBoard);

updatePlayerNames();

window.pongTimer.updateDisplayFromSeconds(window.pongTimer.seconds);
countdownDiv.style.fontSize = "12vh";

// start the game using the server-provided startTime
pongGame.startAt(window.pendingGameStart!.startTime);
registerDynamicCleanup(endGame);