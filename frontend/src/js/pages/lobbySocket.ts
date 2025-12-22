import { settings } from "./lobbySettings";

declare global {
	interface Window {
		socket?: WebSocket;
		setPartialLobbyConfig: (partial: Partial<settings>) => void;
	}
}

export {};

declare function loadPage(url: string): void;
declare function addListener(
	target: EventTarget | null,
	event: string,
	handler: any,
): void;

/* -------------------------------------------------------------------------- */
/* Utils                                                                      */
/* -------------------------------------------------------------------------- */
function getEl<T extends HTMLElement>(id: string): T {
	const el = document.getElementById(id);
	if (!el) throw new Error(`Missing element: #${id}`);
	return el as T;
}

function generateCode(): string {
	return Math.random().toString(36).substring(2, 6).toUpperCase();
}

/* -------------------------------------------------------------------------- */
/* State                                                                      */
/* -------------------------------------------------------------------------- */
let gameId: string | null = null;
let authToken: string | null = null;
let myPlayerId: string | null = null;
let ownerId: string | null = null;

/* -------------------------------------------------------------------------- */
/* Elements                                                                   */
/* -------------------------------------------------------------------------- */
const joinInput = getEl<HTMLInputElement>("lobby-input");
const joinBtn = getEl<HTMLButtonElement>("lobby-btn-join");
const createBtn = getEl<HTMLDivElement>("online");

const leaveBtn = getEl<HTMLButtonElement>("lobby-btn-leave");
const launchBtn = getEl<HTMLButtonElement>("lobby-btn-launch");

const playerListEl = getEl<HTMLDivElement>("lobby-player-list");
const playerCurrentCountEl = getEl<HTMLSpanElement>("player-current-count");
const playerMaxCountEl = getEl<HTMLSpanElement>("player-max-count");

/* -------------------------------------------------------------------------- */
/* WebSocket types                                                            */
/* -------------------------------------------------------------------------- */
type MsgType = "connect" | "player" | "playerSync" | "game" | "settings";

type SocketMessage<T> = {
	type: MsgType;
	payload: T;
};

type ConnectPayload = {
	token: string;
};

type PlayerPayload = {
	playerId: string;
	displayName: string;
	status: "player" | "spectator";
	action: "join" | "leave";
};

type PlayerSyncPayload = {
	ownerId: string;
	players: Array<{
		playerId: string;
		displayName: string;
		status: "player" | "spectator";
	}>;
};

type GamePayload = {
	action: "start" | "pause" | "resume" | "abort";
	gameId?: string;
};

/* -------------------------------------------------------------------------- */
/* WebSocket                                                                  */
/* -------------------------------------------------------------------------- */
function connectWebSocket(token: string): void {
	if (window.socket) return;

	const protocol = location.protocol === "https:" ? "wss" : "ws";
	const socket = new WebSocket(`${protocol}://${location.host}/ws/`);
	window.socket = socket;

	addListener(socket, "open", () => {
		notify('Connected to the game lobby.', { type: 'success' });
		const msg: SocketMessage<ConnectPayload> = {
			type: "connect",
			payload: { token },
		};
		socket.send(JSON.stringify(msg));
	});

	addListener(socket, "message", (event: MessageEvent) => {
		const msg = JSON.parse(event.data) as SocketMessage<any>;

		switch (msg.type) {
			case "playerSync":
				handlePlayerSync(msg.payload as PlayerSyncPayload);
				break;

			case "player":
				handlePlayer(msg.payload as PlayerPayload);
				break;

			case "game":
				console.log("Game message received:", msg.payload);
				if ((msg.payload as GamePayload).action === "start") {
					notify('The game is starting!', { type: 'success' });
					loadPage("/pong-board");
				}
				break;
			case "settings":
				window.setPartialLobbyConfig(msg.payload as Partial<settings>);
				notify('Game settings have been updated.', { type: 'info' });
				break;

			default:
				console.warn("Unknown socket message:", msg);
		}
	});

	addListener(socket, "close", () => {
		notify('Disconnected from the game lobby.', { type: 'warning' });
		window.socket = undefined;
		resetLobbyState();
	});
}

/* -------------------------------------------------------------------------- */
/* Players handling                                                           */
/* -------------------------------------------------------------------------- */
function handlePlayerSync(payload: PlayerSyncPayload): void {
	playerListEl.innerHTML = "";
	ownerId = payload.ownerId;
	payload.players.forEach((player) => {
		addPlayer(
			player.playerId,
			player.displayName,
			player.playerId === ownerId
		);
	});

	updateCounts(payload.players.length);
	updateLaunchVisibility();
}

function handlePlayer(payload: PlayerPayload): void {
	if (payload.action === "join") {
		addPlayer(
			payload.playerId,
			payload.displayName,
			payload.playerId === ownerId
		);
		notify(`${payload.displayName} has joined the lobby.`, { type: 'info' });
	}

	if (payload.action === "leave") {
		removePlayer(payload.playerId);
		notify(`${payload.displayName} has left the lobby.`, { type: 'info' });
	}

	updateLaunchVisibility();
}

/* -------------------------------------------------------------------------- */
/* Players UI                                                                 */
/* -------------------------------------------------------------------------- */
function addPlayer(
	id: string,
	name: string,
	isOwner: boolean
): void {
	if (playerListEl.querySelector(`#player-${id}`)) return;

	if (!myPlayerId) myPlayerId = id;

	const el = document.createElement("div");
	el.classList.add("lobby-player-entry");
	el.id = `player-${id}`;
	el.textContent = name;

	if (isOwner) {
		const badge = document.createElement("span");
		badge.classList.add("lobby-owner-badge");
		badge.textContent = " (owner)";
		el.appendChild(badge);
	}

	playerListEl.appendChild(el);
	updateCounts(playerListEl.children.length);
}

function removePlayer(id: string): void {
	const el = playerListEl.querySelector(`#player-${id}`);
	if (!el) return;

	el.remove();
	updateCounts(playerListEl.children.length);
}

function updateCounts(current: number, max?: number): void {
	playerCurrentCountEl.textContent = String(current);
	if (max !== undefined) {
		playerMaxCountEl.textContent = String(max);
	}
}

/* -------------------------------------------------------------------------- */
/* Owner / Launch logic                                                       */
/* -------------------------------------------------------------------------- */
function updateLaunchVisibility(): void {
	const isOwner =
		myPlayerId !== null &&
		ownerId !== null &&
		myPlayerId === ownerId &&
		gameId !== null;

	launchBtn.classList.toggle("unloaded", !isOwner);
}

/* -------------------------------------------------------------------------- */
/* API – Game creation / join                                                 */
/* -------------------------------------------------------------------------- */
async function joinGame(code: string): Promise<void> {
	const payload = /^[A-Z0-9]{4}$/.test(code.toUpperCase())
		? { code: code.toUpperCase() }
		: { gameId: code };

	const res = await fetch("/api/game/join", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});

	const data = await res.json();
	if (!res.ok) throw new Error(data.error);

	gameId = data.gameId;
	authToken = data.authToken;

	if (!authToken) throw new Error("Missing auth token");
	connectWebSocket(authToken);
}

async function createGame(): Promise<void> {
	const res = await fetch("/api/game/new", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			game: {
				mode: "online",
				code: generateCode(),
				maxPlayers: 4,
				spectatorsAllowed: true,
			},
		}),
	});

	const data = await res.json();

	gameId = data.gameId;
	authToken = data.authToken;
	joinInput.value = data.code;

	if (!authToken) throw new Error("Missing auth token");
	connectWebSocket(authToken);
}

/* -------------------------------------------------------------------------- */
/* Events                                                                     */
/* -------------------------------------------------------------------------- */
addListener(joinBtn, "click", () => joinGame(joinInput.value));
console.log(createBtn);
addListener(createBtn, "click", () => {
	
	createGame();
	const leaveButton = document.getElementById("lobby-btn-leave") as HTMLButtonElement | null;
	if (leaveButton)
  		leaveButton.style.opacity = "1";
});

addListener(leaveBtn, "click", () => {
	window.socket?.close();
});

addListener(launchBtn, "click", () => {
	if (!window.socket || !gameId) return;

	const msg: SocketMessage<GamePayload> = {
		type: "game",
		payload: {
			action: "start",
			gameId: gameId,
		},
	};

	window.socket.send(JSON.stringify(msg));
});

/* -------------------------------------------------------------------------- */
/* Reset                                                                      */
/* -------------------------------------------------------------------------- */
function resetLobbyState(): void {
	playerListEl.innerHTML = "";
	updateCounts(0, 0);
console.log("coucou");
	gameId = null;
	authToken = null;
	myPlayerId = null;
	ownerId = null;

	launchBtn.classList.add("unloaded");
}

/* -------------------------------------------------------------------------- */
/* Init                                                                       */
/* -------------------------------------------------------------------------- */
launchBtn.classList.add("unloaded");