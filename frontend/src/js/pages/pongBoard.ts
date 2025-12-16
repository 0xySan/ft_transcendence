/* -------------------------------------------------------------------------- */
/* Global declarations                                                        */
/* -------------------------------------------------------------------------- */
declare global {
	interface Window {
		socket?: WebSocket;
	}
}

declare function addListener(
	target: EventTarget | null,
	event: string,
	handler: any,
): void;

export {};

/* -------------------------------------------------------------------------- */
/* Types (frontend mirror)                                                     */
/* -------------------------------------------------------------------------- */
type Vec2 = {
	x: number;
	y: number;
};

type BallState = {
	position: Vec2;
	velocity: Vec2;
	radius: number;
};

type PaddleState = {
	playerId: string;
	position: Vec2;
	width: number;
	height: number;
};

type GameStatePayload = {
	frameId: number;
	ball: BallState;
	paddles: PaddleState[];
	scores?: Array<{ playerId: string; score: number }>;
	state?: "waiting" | "playing" | "ended";
};

type SocketMessage<T> = {
	type: "game";
	payload: T;
};

/* -------------------------------------------------------------------------- */
/* Canvas / Rendering setup                                                    */
/* -------------------------------------------------------------------------- */
const canvas = document.getElementById("pong-board") as HTMLCanvasElement;
if (!canvas) throw new Error("Canvas pong-board not found");

const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
if (!ctx) throw new Error("Canvas context unavailable");

/* -------------------------------------------------------------------------- */
/* Local render state (interpolated)                                           */
/* -------------------------------------------------------------------------- */
const renderState = {
	ball: {
		x: canvas.width / 2,
		y: canvas.height / 2,
		targetX: canvas.width / 2,
		targetY: canvas.height / 2,
		radius: 6,
	},
	paddles: new Map<string, PaddleState>(),
	scores: new Map<string, number>(),
};

/* -------------------------------------------------------------------------- */
/* WebSocket                                                                   */
/* -------------------------------------------------------------------------- */
let socketConnection = window.socket;

if (!socketConnection) {
	const res = await fetch("/api/game");
	const data = await res.json();

	if (!data?.token) {
		throw new Error("Missing token – access via lobby");
	}

	const protocol = location.protocol === "https:" ? "wss:" : "ws:";
	socketConnection = new WebSocket(
		`${protocol}//${location.host}/ws/?token=${data.token}`,
	);
	window.socket = socketConnection;
}

/* -------------------------------------------------------------------------- */
/* Socket handlers                                                             */
/* -------------------------------------------------------------------------- */
addListener(socketConnection, "message", (event: MessageEvent) => {
	const msg = JSON.parse(event.data) as SocketMessage<GameStatePayload>;

	if (msg.type !== "game") return;
	applyGameState(msg.payload);
});

addListener(socketConnection, "close", () => {
	console.warn("Disconnected from game server");
});

addListener(socketConnection, "error", (err: Event) => {
	console.error("WebSocket error:", err);
});

/* -------------------------------------------------------------------------- */
/* Game state application                                                      */
/* -------------------------------------------------------------------------- */
function applyGameState(state: GameStatePayload): void {
	/* Ball */
	renderState.ball.targetX = state.ball.position.x;
	renderState.ball.targetY = state.ball.position.y;
	renderState.ball.radius = state.ball.radius;

	/* Paddles */
	renderState.paddles.clear();
	for (const paddle of state.paddles) {
		renderState.paddles.set(paddle.playerId, paddle);
	}

	/* Scores */
	if (state.scores) {
		renderState.scores.clear();
		for (const score of state.scores) {
			renderState.scores.set(score.playerId, score.score);
		}
		updateScoreUI(state.scores);
	}
}

/* -------------------------------------------------------------------------- */
/* Rendering loop                                                              */
/* -------------------------------------------------------------------------- */
function animate(): void {
	const SMOOTH = 0.25;

	renderState.ball.x +=
		(renderState.ball.targetX - renderState.ball.x) * SMOOTH;
	renderState.ball.y +=
		(renderState.ball.targetY - renderState.ball.y) * SMOOTH;

	draw();
	requestAnimationFrame(animate);
}

animate();

/* -------------------------------------------------------------------------- */
/* Draw                                                                        */
/* -------------------------------------------------------------------------- */
function draw(): void {
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	drawMidLine();
	drawPaddles();
	drawBall();
}

function drawMidLine(): void {
	ctx.setLineDash([10, 10]);
	ctx.strokeStyle = "#ffffff";
	ctx.beginPath();
	ctx.moveTo(canvas.width / 2, 0);
	ctx.lineTo(canvas.width / 2, canvas.height);
	ctx.stroke();
	ctx.setLineDash([]);
}

function drawPaddles(): void {
	ctx.fillStyle = "#ffffff";

	for (const paddle of renderState.paddles.values()) {
		ctx.fillRect(
			paddle.position.x,
			paddle.position.y,
			paddle.width,
			paddle.height,
		);
	}
}

function drawBall(): void {
	ctx.beginPath();
	ctx.arc(
		renderState.ball.x,
		renderState.ball.y,
		renderState.ball.radius,
		0,
		Math.PI * 2,
	);
	ctx.fillStyle = "#ffffff";
	ctx.fill();
}

/* -------------------------------------------------------------------------- */
/* UI                                                                          */
/* -------------------------------------------------------------------------- */
function updateScoreUI(
	scores: Array<{ playerId: string; score: number }>,
): void {
	const left = document.getElementById("left-score");
	const right = document.getElementById("right-score");

	if (!left || !right) return;

	left.textContent = String(scores[0]?.score ?? 0);
	right.textContent = String(scores[1]?.score ?? 0);
}

/* -------------------------------------------------------------------------- */
/* Inputs → backend                                                            */
/* -------------------------------------------------------------------------- */
const inputState = {
	up: false,
	down: false,
};

addListener(document, "keydown", (e: KeyboardEvent) => {
	if (e.key === "w") setInput("up", true);
	if (e.key === "s") setInput("down", true);
});

addListener(document, "keyup", (e: KeyboardEvent) => {
	if (e.key === "w") setInput("up", false);
	if (e.key === "s") setInput("down", false);
});

function setInput(key: "up" | "down", pressed: boolean): void {
	if (inputState[key] === pressed) return;
	inputState[key] = pressed;

	if (!socketConnection || socketConnection.readyState !== WebSocket.OPEN)
		return;

	socketConnection.send(
		JSON.stringify({
			type: "input",
			payload: {
				inputs: [
					{
						frameId: 0, // server will realign
						inputs: [{ key, pressed }],
					},
				],
			},
		}),
	);
}
