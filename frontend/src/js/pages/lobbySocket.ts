import type { PlayerPayload, Settings, UserData } from "../global";

declare global {
	interface Window {
		socket?: WebSocket;
		setPartialLobbyConfig: (partial: Partial<Settings>) => void;
		localPlayerId?: string;
		lobbyGameId?: string;
		playerSyncData: PlayerSyncPayload;
		pendingGameStart?: gameStartAckPayload;
		currentUser: UserData | null;
		currentUserReady: Promise<void>;
		__resolveCurrentUser: (user?: any) => void;
		joinLobby: () => Promise<void>;
		lobbySettings?: Settings;
		selectLobbyMode: (modeKey: "reset" | "online" | "offline" | "join") => void;
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
const createBtn = getEl<HTMLDivElement>("lobby-online");
const lobbyTournamentBtn = getEl<HTMLDivElement>("lobby-tournament-button");
const multiplayerBtn = getEl<HTMLDivElement>("lobby-multiplayer-button");

const leaveBtn = getEl<HTMLButtonElement>("lobby-btn-leave");
const launchBtn = getEl<HTMLButtonElement>("lobby-btn-launch");

const playerListEl = getEl<HTMLDivElement>("lobby-player-list");
const playerCurrentCountEl = getEl<HTMLSpanElement>("player-current-count");
const playerMaxCountEl = getEl<HTMLSpanElement>("player-max-count");

const lobbyTournamentTab = getEl<HTMLSpanElement>("lobby-tournament-tab");

const htmlSettings = {
	basic: {
		div: getEl<HTMLDivElement>("lobby-custom-game-basic-settings"),
	},
	advanced: {
		div: getEl<HTMLDivElement>("lobby-custom-game-advanced-settings"),
	}
}

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

type PlayerSyncPayload = {
	ownerId: string;
	players: Array<{
		playerId: string;
		displayName: string;
		status: "player" | "spectator";
	}>;
};

type gameAction = "start" | "pause" | "resume" | "abort";

type GamePayload = {
	action:		gameAction;
	gameId?:	string;
};

/**
 * Possible sides a player can be assigned to.
 * - **left**: Left side of the game.
 * - **right**: Right side of the game.
 */
export type PlayerSide = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "left" | "right";

/**
 * Mapping of player IDs to their assigned sides.
 */
export type PlayerSideMap = Record<string, PlayerSide>;

/**
 * Payload structure for acknowledging the start of a game.
 * - **action**: The game action performed (should be "start").
 * - **playerSides**: Mapping of player IDs to their assigned sides.
 * - **startTime**: Timestamp indicating when the game started - 3 seconds.
 */
export interface gameStartAckPayload {
	action:			gameAction;
	playerSides:	PlayerSideMap;
	startTime:		number;
}

/* -------------------------------------------------------------------------- */
/* WebSocket                                                                  */
/* -------------------------------------------------------------------------- */
function connectWebSocket(token: string): void {
	if (window.socket)
		window.socket.close();

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

		// start client keepalive: send a small "send" message every 20s
		(window as any).socketPingInterval = window.setInterval(() => {
			if (socket.readyState === WebSocket.OPEN)
				socket.send(JSON.stringify({ type: "send", payload: { keepalive: true } }));
		}, 20_000);
	});

	addListener(socket, "message", (event: MessageEvent) => {
		const msg = JSON.parse(event.data) as SocketMessage<PlayerSyncPayload | PlayerPayload | GamePayload | Partial<Settings> | gameStartAckPayload>;
		switch (msg.type) {
			case "playerSync":
				console.log("Received playerSync:", msg.payload);
				handlePlayerSync(msg.payload as PlayerSyncPayload);
				window.playerSyncData = msg.payload as PlayerSyncPayload;
				break;

			case "player":
				handlePlayer(msg.payload as PlayerPayload);
				break;

			case "game":
				if ((msg.payload as GamePayload).action === "start") {
					notify('The game is starting!', { type: 'success' });
					window.pendingGameStart = msg.payload as gameStartAckPayload;
					loadPage("/pong-board");
				}
				break;
			case "settings":
				window.setPartialLobbyConfig(msg.payload as Partial<Settings>);
				notify('Game settings have been updated.', { type: 'info' });
				break;

			default:
				console.warn("Unknown socket message:", msg);
		}
	});

	addListener(socket, "close", (event: CloseEvent) => {
		if ((window as any).socketPingInterval) {
			clearInterval((window as any).socketPingInterval);
			(window as any).socketPingInterval = undefined;
		}
		notify('Disconnected from the game lobby.', { type: 'warning' });
		window.socket = undefined;
		resetLobbyState();
	});

	leaveBtn.style.opacity = "1";
	leaveBtn.classList.remove("unloaded");
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

	if (myPlayerId === ownerId)
	{
		htmlSettings.basic.div.classList.remove("grayed");
		htmlSettings.advanced.div.classList.remove("grayed");
	} else if (window.socket) {
		htmlSettings.basic.div.classList.add("grayed");
		htmlSettings.advanced.div.classList.add("grayed");
	}
	updateCounts(payload.players.length);
	updateLaunchVisibility("lobby-online", Math.max(payload.players.length, playerListEl.children.length));
}

function handlePlayer(payload: PlayerPayload): void {
	if (payload.action === "join") {
		window.playerSyncData.players.push({
			playerId: payload.playerId,
			displayName: payload.displayName,
			status: "player"
		})
		addPlayer(
			payload.playerId,
			payload.displayName,
			payload.playerId === ownerId
		);
		notify(`${payload.displayName} has joined the lobby.`, { type: 'info' });
		updateLaunchVisibility("lobby-online", playerListEl.children.length);
	}

	if (payload.action === "leave") {
		const index = window.playerSyncData.players.findIndex(player => player.playerId === payload.playerId);
		window.playerSyncData.players.splice(index, 1);
		removePlayer(payload.playerId);
		notify(`${payload.displayName} has left the lobby.`, { type: 'info' });
		updateLaunchVisibility("", playerListEl.children.length);
	}
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

function updateCounts(current: number): void {
	playerCurrentCountEl.textContent = String(current);
	if (window.lobbySettings && window.lobbySettings.game) {
		playerMaxCountEl.textContent = String(window.lobbySettings.game.playerCount) || '?';
	}
}

/* -------------------------------------------------------------------------- */
/* Owner / Launch logic                                                       */
/* -------------------------------------------------------------------------- */
export function updateLaunchVisibility(mode:string, playerCount:number): void {

	const isOwner =
		myPlayerId !== null &&
		ownerId !== null &&
		myPlayerId === ownerId &&
		gameId !== null;

	launchBtn.classList.remove("unloaded");
	if (mode === "lobby-online")
	{
		if (!isOwner)
			launchBtn.classList.add("unloaded");
		else if (playerCount === (window.lobbySettings?.game?.playerCount || 2))
		{
			launchBtn.classList.remove("unclickable");
			launchBtn.style.opacity = "1";
		}
		else if (isOwner)
			launchBtn.style.opacity = "0.4";
	} else if (mode === "lobby-offline" && playerCount == 0) launchBtn.classList.add("unloaded");
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
	if (!res.ok)
		return notify(`Failed to join game: ${data.error || 'Unknown error'}`, { type: 'error' });

	if (res.status !== 200)
		return notify(`Failed to join game: ${res.status} - ${data.error || 'Unknown error'}`, { type: 'error' });

	if (!data.gameId) {
		notify("invalid game", { type: "error" });
		return;
	}
	gameId = data.gameId;
	window.lobbyGameId = data.gameId;
	authToken = data.authToken;

	if (!authToken) throw new Error("Missing auth token");
	window.selectLobbyMode("join");
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
	window.lobbyGameId = data.gameId;
	authToken = data.authToken;
	joinInput.value = data.code;

	if (!authToken) throw new Error("Missing auth token");
	connectWebSocket(authToken);
}

/* -------------------------------------------------------------------------- */
/* Events                                                                     */
/* -------------------------------------------------------------------------- */
addListener(joinBtn, "click", () => joinGame(joinInput.value));

addListener(createBtn, "click", () => createGame());

addListener(leaveBtn, "click", () => {
	window.socket?.close();
	lobbyTournamentTab.classList.add("unloaded");
	lobbyTournamentBtn.classList.remove("current-mode");
	multiplayerBtn.classList.remove("current-mode");
	resetLobbyState();
});

addListener(launchBtn, "click", () => {
	console.log("DEBUG: socker = ", window.socket + " | gameId = " + gameId + " | lobbyGameId = " + window.lobbyGameId);
	if (window.lobbyGameId) gameId = window.lobbyGameId;
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

const lobbyOnline: any = document.getElementById("lobby-select-mode");

/* -------------------------------------------------------------------------- */
/* Reset                                                                      */
/* -------------------------------------------------------------------------- */
function resetLobbyState(): void {
	if ((window as any).socketPingInterval) {
		clearInterval((window as any).socketPingInterval);
		(window as any).socketPingInterval = undefined;
	}
	if (window.socket)
		window.socket.close();
	playerListEl.innerHTML = "";
	updateCounts(0);
	gameId = null;
	authToken = null;
	ownerId = null;
	launchBtn.classList.add("unloaded");
	updateLaunchVisibility("lobby-offline", 0);
	window.selectLobbyMode("reset");
	leaveBtn.classList.add("unloaded");
	let tabMode = document.querySelector("#lobby-mode-buttons");
	tabMode?.classList.add("grayed");
}

/* -------------------------------------------------------------------------- */
/* Init                                                                       */
/* -------------------------------------------------------------------------- */

launchBtn.classList.add("unloaded");
leaveBtn.classList.add("unloaded");

if (window.playerSyncData) {
	handlePlayerSync(window.playerSyncData);
	if (window.localPlayerId == window.playerSyncData.ownerId) {
		launchBtn.classList.remove("unloaded");
		gameId = window.lobbyGameId || null;
		htmlSettings.basic.div.classList.remove("grayed");
	}
}

myPlayerId = await window.currentUserReady.then(() => {
	window.localPlayerId = window.currentUser ? String(window.currentUser.id) : undefined;
	return window.localPlayerId || null;
});
console.log("LobbbySocket Current user ID:", myPlayerId);