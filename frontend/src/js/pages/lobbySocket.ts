import type { PlayerPayload, Settings, UserData } from "../global";

declare global {
	interface Window {
		socket?: WebSocket;
		
		pendingGameStart?: gameStartAckPayload;
		playerSyncData: PlayerSyncPayload | null;
		playerNames?: Record<string, string>;
		localPlayerId?: string;
		lobbyGameId?: string;
		__resolveCurrentUser: (user?: any) => void;
		currentUser: UserData | null;
		currentUserReady: Promise<void>;

		joinGame?: (code: string) => Promise<void>;

		lobbySettings?: Settings;
		setPartialLobbyConfig: (partial: Partial<Settings>) => void;
		selectLobbyMode: (modeKey: "reset" | "online" | "offline" | "join") => void;
	}
}

declare function loadPage(url: string): void;
declare function addListener(
	target: EventTarget | null,
	event: string,
	handler: any,
): void;
declare function changeLobbyCodeInput(newCode: string): void;
declare function getUserLang(): string;
declare function getTranslatedTextByKey(lang: string, key: string): Promise<string | null>;

// Translations (top-level await allowed in modules)
const LOBBYSOCKET_TXT_CONNECTED = await getTranslatedTextByKey(getUserLang(), 'lobbySocket.notify.connected');
const LOBBYSOCKET_TXT_GAME_STARTING = await getTranslatedTextByKey(getUserLang(), 'lobbySocket.notify.gameStarting');
const LOBBYSOCKET_TXT_SETTINGS_UPDATED = await getTranslatedTextByKey(getUserLang(), 'lobbySocket.notify.settingsUpdated');
const LOBBYSOCKET_TXT_DISCONNECTED = await getTranslatedTextByKey(getUserLang(), 'lobbySocket.notify.disconnected');
const LOBBYSOCKET_TXT_INVALID_GAME = await getTranslatedTextByKey(getUserLang(), 'lobbySocket.notify.invalidGame');
const LOBBYSOCKET_TXT_PLAYER_JOINED = await getTranslatedTextByKey(getUserLang(), 'lobbySocket.notify.playerJoined');
const LOBBYSOCKET_TXT_PLAYER_LEFT = await getTranslatedTextByKey(getUserLang(), 'lobbySocket.notify.playerLeft');

window.playerNames = {};

/* -------------------------------------------------------------------------- */
/* 								Utils										  */
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
/* State																	  */
/* -------------------------------------------------------------------------- */
let gameId: string | null = null;
let authToken: string | null = null;
let myPlayerId: string | null = null;
let ownerId: string | null = null;

/* -------------------------------------------------------------------------- */
/* Elements																   */
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
};

/* -------------------------------------------------------------------------- */
/* WebSocket types															*/
/* -------------------------------------------------------------------------- */
export type MsgType = "connect" | "player" | "playerSync" | "game" | "settings";

export type SocketMessage<T> = {
	type: MsgType;
	payload: T;
};

export type ConnectPayload = {
	token: {
		token: string;
	}
};

export type PlayerSyncPayload = {
	ownerId: string;
	players: Array<{
		playerId: string;
		displayName: string;
		status: "player" | "spectator";
	}>;
};

type gameAction = "start" | "pause" | "resume" | "abort";

export type GamePayload = {
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
/*									WebSocket								  */
/* -------------------------------------------------------------------------- */

/**
 * Try to connect to the lobby WebSocket using the provided socket token.
 * The event is sent from the lobbySettings module when the user joins the queue.
 */
addListener(window, "joinQueue", (event: CustomEvent) => {
	connectWebSocket(event.detail.socketToken);
});

/** ### applyListener
 * Apply WebSocket event listeners for open, message, and close events.
 * Handles connection setup, incoming messages, and disconnection logic.
 * 
 * @param socket - The WebSocket instance to apply listeners to.
 * @param token - Optional authentication token for connecting to the lobby.
 */
function applyListener(socket: WebSocket, token?: string) {
	if (token) {
		addListener(socket, "open", () => {
			notify(LOBBYSOCKET_TXT_CONNECTED || 'Connected to the game lobby.', { type: 'success' });
			const msg: SocketMessage<ConnectPayload> = {
				type: "connect",
				payload: { token: {token: token} },
			};
			socket.send(JSON.stringify(msg));

			// start client keepalive: send a small "send" message every 20s
			(window as any).socketPingInterval = window.setInterval(() => {
				if (socket.readyState === WebSocket.OPEN)
					socket.send(JSON.stringify({ type: "send", payload: { keepalive: true } }));
			}, 20_000);
		});
	}

	addListener(socket, "message", (event: MessageEvent) => {
		const msg = JSON.parse(event.data) as SocketMessage<PlayerSyncPayload | PlayerPayload | GamePayload | Partial<Settings> | gameStartAckPayload>;
		switch (msg.type) {
			case "playerSync":
				handlePlayerSync(msg.payload as PlayerSyncPayload);
				window.playerSyncData = msg.payload as PlayerSyncPayload;
				break;

			case "player":
				handlePlayer(msg.payload as PlayerPayload);
				break;

			case "game":
				if ((msg.payload as GamePayload).action === "start") {
					notify(LOBBYSOCKET_TXT_GAME_STARTING || 'The game is starting!', { type: 'success' });
					window.pendingGameStart = msg.payload as gameStartAckPayload;
					loadPage("/pong-board");
				}
				break;
			case "settings":
				window.setPartialLobbyConfig(msg.payload as Partial<Settings>);
				notify(LOBBYSOCKET_TXT_SETTINGS_UPDATED || 'Game settings have been updated.', { type: 'info' });
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
		notify(LOBBYSOCKET_TXT_DISCONNECTED || 'Disconnected from the game lobby.', { type: 'warning' });
		window.socket = undefined;
		resetLobbyState();
	});
}

function connectWebSocket(token: string): void {
	if (window.socket) {
		window.socket.close();
	}

	const protocol = location.protocol === "https:" ? "wss" : "ws";
	const socket = new WebSocket(`${protocol}://${location.host}/ws/`);
	window.socket = socket;

	applyListener(socket, token);

	leaveBtn.style.opacity = "1";
	leaveBtn.classList.remove("unloaded");
}

/* -------------------------------------------------------------------------- */
/* 									Players handling						  */
/* -------------------------------------------------------------------------- */

/** ### handlePlayerSync
 * Handle player synchronization by updating the player list and UI elements.
 * Clears the existing player list and repopulates it based on the provided payload.
 * 
 * @param payload - The player synchronization payload containing owner ID and player details.
 */
function handlePlayerSync(payload: PlayerSyncPayload): void {
	playerListEl.innerHTML = "";
	ownerId = payload.ownerId;
	payload.players.forEach((player) => {
		addPlayer(
			player.playerId,
			player.displayName,
			player.playerId === ownerId
		);
		window.playerNames![player.playerId] = player.displayName;
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

/** ### handlePlayer
 * Handle player join and leave events by updating the player list and UI elements.
 * Adds or removes players from the list based on the action specified in the payload.
 * 
 * @param payload - The player payload containing action, player ID, and display name.
 */
function handlePlayer(payload: PlayerPayload): void {
	if (payload.action === "join" && window.playerSyncData) {
		const exist: boolean = window.playerSyncData.players.some(player => player.playerId === payload.playerId);
		if (!exist) {
			window.playerSyncData.players.push({
				playerId: payload.playerId,
				displayName: payload.displayName,
				status: "player"
			});
		}
		addPlayer(
			payload.playerId,
			payload.displayName,
			payload.playerId === ownerId
		);
		window.playerNames![payload.playerId] = payload.displayName;
		const tpl = LOBBYSOCKET_TXT_PLAYER_JOINED || '{name} has joined the lobby.';
		notify(tpl.replace('{name}', payload.displayName), { type: 'info' });
		updateLaunchVisibility("lobby-online", playerListEl.children.length);
	}

	if (payload.action === "leave") {
		const index = window.playerSyncData!.players.findIndex(player => player.playerId === payload.playerId);
		window.playerSyncData!.players.splice(index, 1);
		delete window.playerNames![payload.playerId];
		removePlayer(payload.playerId);
		const tpl = LOBBYSOCKET_TXT_PLAYER_LEFT || '{name} has left the lobby.';
		notify(tpl.replace('{name}', payload.displayName), { type: 'info' });
		updateLaunchVisibility("", playerListEl.children.length);
	}
}

/* -------------------------------------------------------------------------- */
/* 									Players UI								  */
/* -------------------------------------------------------------------------- */

/** ### addPlayer
 * Add a player to the player list UI.
 * 
 * @param id - The player's unique identifier.
 * @param name - The display name of the player.
 * @param isOwner - Boolean indicating if the player is the owner.
 */
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

/** ### removePlayer
 * Remove a player from the player list UI.
 * 
 * @param id - The player's unique identifier.
 */
function removePlayer(id: string): void {
	const el = playerListEl.querySelector(`#player-${id}`);
	if (!el) return;

	el.remove();
	updateCounts(playerListEl.children.length);
}

/** ### updateCounts
 * Update the player count display in the lobby UI.
 * 
 * @param current - The current number of players in the lobby.
 */
function updateCounts(current: number): void {
	playerCurrentCountEl.textContent = String(current);
	if (window.lobbySettings && window.lobbySettings.game) {
		playerMaxCountEl.textContent = String(window.lobbySettings.game.maxPlayers) || '?';
	}
}

/* -------------------------------------------------------------------------- */
/* 									Owner / Launch logic					  */
/* -------------------------------------------------------------------------- */

/** ### updateLaunchVisibility
 * Update the visibility and state of the launch button based on the lobby mode and player count.
 * 
 * @param mode - The current lobby mode ("lobby-online" or "lobby-offline").
 * @param maxPlayers - The current number of players in the lobby.
 */
export function updateLaunchVisibility(mode:string, maxPlayers:number): void {

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
		else if (maxPlayers === (window.lobbySettings?.game?.maxPlayers || 2))
		{
			launchBtn.classList.remove("unclickable");
			launchBtn.style.opacity = "1";
		}
		else if (isOwner)
			launchBtn.style.opacity = "0.4";
	} else if (mode === "lobby-offline" && maxPlayers == 0) launchBtn.classList.add("unloaded");
}

/* -------------------------------------------------------------------------- */
/* 							API – Game creation / join						  */
/* -------------------------------------------------------------------------- */

async function joinGameWithCode(code: string): Promise<void> {
	const payload = /^[A-Z0-9]{4}$/.test(code.toUpperCase())
		? { code: code.toUpperCase() }
		: { gameId: code };
	const res = await fetch("/api/game/join", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});

	const data = await res.json();
	if (!res.ok) {
		const tpl = await getTranslatedTextByKey(getUserLang(), 'lobbySocket.notify.failedToJoinGame');
		const msg = tpl ? tpl.replace('{error}', data.error || 'Unknown error') : `Failed to join game: ${data.error || 'Unknown error'}`;
		return notify(msg, { type: 'error' });
	}

	if (res.status !== 200) {
		const tpl = await getTranslatedTextByKey(getUserLang(), 'lobbySocket.notify.failedToJoinGameStatus');
		const msg = tpl
			? tpl.replace('{status}', String(res.status)).replace('{error}', data.error || 'Unknown error')
			: `Failed to join game: ${res.status} - ${data.error || 'Unknown error'}`;
		return notify(msg, { type: 'error' });
	}

	if (!data.gameId) {
		notify(LOBBYSOCKET_TXT_INVALID_GAME || "invalid game", { type: "error" });
		return;
	}
	gameId = data.gameId;
	window.lobbyGameId = data.gameId;
	authToken = data.authToken;

	if (!authToken) throw new Error("Missing auth token");
	window.selectLobbyMode("join");
	connectWebSocket(authToken);
}

async function joinTournamentWithCode(code: string): Promise<void> {
	const payload = /^[A-Z0-9]{6}$/.test(code.toUpperCase())
		? { code: code.toUpperCase() }
		: { gameId: code };
	const res = await fetch("/api/tournament/join", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ code: payload.code }),
	});

	const data = await res.json();
	if (!res.ok)
		return notify(`Failed to join tournament: ${data.error || 'Unknown error'}`, { type: 'error' });
	if (res.status !== 200)
		return notify(`Failed to join tournament: ${res.status} - ${data.error || 'Unknown error'}`, { type: 'error' });

	if (!data.tournamentId) {
		notify("Invalid tournament response", { type: "error" });
		return;
	}

	// Store tournament info in sessionStorage for the tournament page
	sessionStorage.setItem('tournamentId', data.tournamentId);
	sessionStorage.setItem('tournamentCode', data.code || '');
	sessionStorage.setItem('tournamentVisibility', data.visibility || 'private');

	// Navigate to tournament page
	loadPage("/tournament");
	return;
}

/** ### joinGame
 * Attempt to join a game using the provided code or game ID.
 * Validates the input and sends a request to the server to join the game.
 * On success, connects to the lobby WebSocket with the received auth token.
 * 
 * @param code - The game code or game ID to join.
 */
async function joinGame(code: string) : Promise<void> {
	const codeLength = code.trim().length;

	if (codeLength === 6)
	{
		joinTournamentWithCode(code).catch((err) => {
			console.error("Error joining tournament:", err);
			notify(`Error joining tournament: ${err.message || 'Unknown error'}`, { type: 'error' });
		});
		return ;
	}
	joinGameWithCode(code).catch((err) => {
		console.error("Error joining game:", err);
		notify(`Error joining game: ${err.message || 'Unknown error'}`, { type: 'error' });
	});
}

// expose joinGame so other modules (e.g. lobbySettings) can programmatically reuse the same logic
window.joinGame = joinGame;

/** ### createGame
 * Create a new online game with default settings.
 * Sends a request to the server to create the game and retrieves the game ID and auth token.
 * On success, connects to the lobby WebSocket with the received auth token.
 */
async function createGame(): Promise<void> {
	const res = await fetch("/api/game/new", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			game: {
				mode: "online",
				code: generateCode(),
				maxPlayers: 2,
				spectatorsAllowed: true,
			},
		}),
	});

	const data = await res.json();

	gameId = data.gameId;
	window.lobbyGameId = data.gameId;
	authToken = data.authToken;
	joinInput.value = data.code;
	changeLobbyCodeInput(data.code);

	if (!authToken) throw new Error("Missing auth token");
	connectWebSocket(authToken);
}

/* -------------------------------------------------------------------------- */
/* 									Events									  */
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
	if (window.isGameOffline)
	{
		loadPage("/pong-board");
		return;
	}
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

/* -------------------------------------------------------------------------- */
/* Reset																	  */
/* -------------------------------------------------------------------------- */

/** ### resetLobbyState
 * Reset the lobby state by clearing player lists, closing WebSocket connections,
 * and resetting UI elements to their default state.
 */
function resetLobbyState(): void {
	// Prevent resetting if the multiplayer tab exists
	const elem = document.getElementById("lobby-multiplayer-tab");
	if (elem) return;

	// Clear socket keepalive interval
	if ((window as any).socketPingInterval) {
		clearInterval((window as any).socketPingInterval);
		(window as any).socketPingInterval = undefined;
	}

	// Close WebSocket if exists
	if (window.socket) {
		window.socket.close();
	}

	// Reset UI player list and counts
	playerListEl.innerHTML = "";
	updateCounts(0);

	// Reset game state variables
	gameId = null;
	authToken = null;
	ownerId = null;

	// Hide launch and leave buttons
	launchBtn.classList.add("unloaded");
	leaveBtn.classList.add("unloaded");

	// Update launch button visibility
	updateLaunchVisibility("lobby-offline", 0);

	// Reset lobby mode
	window.selectLobbyMode("reset");

	// Gray out lobby mode buttons tab
	const tabMode = document.querySelector("#lobby-mode-buttons");
	tabMode?.classList.add("grayed");

	// Clear join input
	joinInput.value = "";

	// Gray out settings panels
	htmlSettings.basic.div.classList.add("grayed");
	htmlSettings.advanced.div.classList.add("grayed");
}


/* -------------------------------------------------------------------------- */
/* Init																	   */
/* -------------------------------------------------------------------------- */

launchBtn.classList.add("unloaded");
leaveBtn.classList.add("unloaded");

if (window.socket) {
	applyListener(window.socket)
	if (!window.playerSyncData) throw new Error("Missing player sync data on reload");
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