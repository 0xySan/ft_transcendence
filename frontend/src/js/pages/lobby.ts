declare global {
	interface Window {
		socket: WebSocket;
	}
}

declare function loadPage(url:string) : void;
declare function addListener(target: EventTarget | null, event: string, handler: any): void;

export {};

let data: any;
let socketConnection = window.socket;

function redirectUser(event: Event) : void{
	event.preventDefault();
	event.stopImmediatePropagation();
	socketConnection.send(JSON.stringify({ action: "start" }));
	loadPage(`/pong-board`);
}

function attachSocketListeners(socket: WebSocket) {

	addListener(socket, 'open', () => {
		console.log('Connected to WebSocket server.');
	});

	function safeJSONParse(data: string) {
		try {
			return JSON.parse(data);
		} catch {
			return (null);
		}
	}

	addListener(socket, 'message', (event: MessageEvent) => {
		const parsed = safeJSONParse(event.data);

		if (!parsed) {
			console.log("Received non-JSON message:", event.data);
			return;
		}

		console.log("Message JSON:", parsed);

		if (parsed.action === "start") {
			redirectUser(event);
		}
	});

	addListener(socket, "close", (event: CloseEvent) => {
		console.log("WebSocket closed");
		console.log("Code :", event.code);
		console.log("Reason :", event.reason);
		console.log("Clean closure :", event.wasClean);
	});

	addListener(socket, 'error', (err: Event) => {
		console.error('WebSocket error:', err);
	});
}

export async function createSocket(code: string | null) {

	let	response = null;
	if (code) {
		response = await fetch("/api/game", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code })
		});
	} else {
		response = await fetch("/api/game", {
			method: "GET"
		});
	}

	if (response == null) {
		new Error("ERROR api");
	}

	data = await response.json();
	console.log("DEBUG: data = ", data);

	if (data["error"]) {
		throw new Error("Error in contact api");
	}

	if (!socketConnection || socketConnection.readyState === WebSocket.CLOSED) {

		const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const socketUrl = wsProtocol + "//" + window.location.host + "/ws/?token=" + data.token;

		window.socket = new WebSocket(socketUrl);
		socketConnection = window.socket;
		console.log("Socket ouvert !");

		attachSocketListeners(socketConnection);
	}
	else {
		console.log("Socket déjà ouverte ou en cours de fermeture.");
	}
}

try {
	await createSocket("null");

	async function joinUser(event: Event) {
		const input = document.getElementById("lobby-input") as HTMLInputElement;
		const code = input.value;

		if (socketConnection && socketConnection.readyState !== WebSocket.CLOSED) {
			await new Promise<void>((resolve) => {
				addListener(socketConnection, "close", () => {
					console.log("Ancien socket fermée.");
					resolve();
				});
				socketConnection.close();
			});
		}

		console.log("DEBUG: join game");
		try {
			await createSocket(code);
		} catch (err) {
			console.error(err);
		}
	}

	const launchBtn = getEl<HTMLButtonElement>("lobby-btn-launch");
	const joinBtn = getEl<HTMLButtonElement>("lobby-btn-join");

	function startGame() {
		socketConnection.send(JSON.stringify({ action: "start" }));
	}

	addListener(launchBtn, "click", startGame);
	addListener(joinBtn, "click", joinUser);

} catch (err) {
	console.error("Erreur :", err);
}

/**
 * Get element by ID or throw error if missing
 * @param id The element ID
 * @returns The HTMLElement
 */
function getEl<T extends HTMLElement>(id: string): T {
	const el = document.getElementById(id);
	if (!el) throw new Error(`Missing element: #${id}`);
	return (el as T);
}

/** Modes (multiplayer, custom, tournament) */
type Mode = { button: HTMLButtonElement; tab: HTMLDivElement; };

/**
 * Mode elements
 * @contains multiplayer, custom game, tournament
 */
const modes: Record<string, Mode> = {
	multiplayer: {
		button: getEl<HTMLButtonElement>("lobby-multiplayer-button"),
		tab: getEl<HTMLDivElement>("lobby-multiplayer-tab")
	},
	custom: {
		button: getEl<HTMLButtonElement>("lobby-custom-game-button"),
		tab: getEl<HTMLDivElement>("lobby-custom-game-tab")
	},
	tournament: {
		button: getEl<HTMLButtonElement>("lobby-tournament-button"),
		tab: getEl<HTMLDivElement>("lobby-tournament-tab")
	}
};

/**
 * Sub-group of dual tabs (basic / advanced)
 * @contains buttons and tabs
 */
type SubGroup = { basicBtn: HTMLButtonElement; advBtn: HTMLButtonElement; basicTab: HTMLDivElement; advTab: HTMLDivElement; };
const subTabs: Record<string, SubGroup> = {
	custom: {
		basicBtn: getEl<HTMLButtonElement>("lobby-custom-game-basic-settings-button"),
		advBtn: getEl<HTMLButtonElement>("lobby-custom-game-advanced-settings-button"),
		basicTab: getEl<HTMLDivElement>("lobby-custom-game-basic-settings"),
		advTab: getEl<HTMLDivElement>("lobby-custom-game-advanced-settings")
	},
	tournament: {
		basicBtn: getEl<HTMLButtonElement>("lobby-tournament-basic-settings-button"),
		advBtn: getEl<HTMLButtonElement>("lobby-tournament-advanced-settings-button"),
		basicTab: getEl<HTMLDivElement>("lobby-tournament-basic-settings"),
		advTab: getEl<HTMLDivElement>("lobby-tournament-advanced-settings")
	}
};

/**
 * Deactivate all mode buttons except the active one
 * @param active The active button
 */
function deactivateAllModesExcept(active: HTMLButtonElement) {
	Object.values(modes).forEach(m => {
		if (m.button !== active) m.button.classList.remove("current-mode");
	});
}

/** Hide all mode tabs except the active one
 * @param active The active tab
 */
function hideAllTabsExcept(active: HTMLDivElement) {
	Object.values(modes).forEach(m => {
		if (m.tab !== active) m.tab.classList.add("unloaded");
	});
	active.classList.remove("unloaded");
}

/**
 * Setup mode button handlers
 */
function setupModeHandlers() {
	Object.values(modes).forEach(mode => {
		addListener(mode.button, "click", () => {
			if (mode.button.classList.contains("current-mode")) return;

			mode.button.classList.add("current-mode");
			deactivateAllModesExcept(mode.button);
			hideAllTabsExcept(mode.tab);
		});
	});
}

/**
 * Setup dual tab switcher (basic / advanced)
 * @param basicBtn The basic button
 * @param basicTab The basic tab
 * @param advBtn The advanced button
 * @param advTab The advanced tab
 */
function setupDualTabSwitcher(basicBtn: HTMLButtonElement, basicTab: HTMLDivElement, advBtn: HTMLButtonElement, advTab: HTMLDivElement) {
	addListener(basicBtn, "click", () => {
		if (basicBtn.classList.contains("lobby-btn-active")) return;

		basicBtn.classList.add("lobby-btn-active");
		advBtn.classList.remove("lobby-btn-active");
		basicTab.classList.remove("unloaded");
		advTab.classList.add("unloaded");
	});

	addListener(advBtn, "click", () => {
		if (advBtn.classList.contains("lobby-btn-active")) return;

		advBtn.classList.add("lobby-btn-active");
		basicBtn.classList.remove("lobby-btn-active");
		advTab.classList.remove("unloaded");
		basicTab.classList.add("unloaded");
	});
}

function setupAllSubTabs() {
	Object.values(subTabs).forEach(group => {
		setupDualTabSwitcher(group.basicBtn, group.basicTab, group.advBtn, group.advTab);
	});
}

/* Initialize handlers */
setupModeHandlers();
setupAllSubTabs();
