import type { Settings, UserData } from "../global";

/* -------------------------------------------------------------------------- */
/*                                External helpers                            */
/* -------------------------------------------------------------------------- */

declare function addListener(
	target: EventTarget | null,
	event: string,
	handler: EventListener
): void;
declare function getUserLang(): string;
declare function getTranslatedTextByKey(lang: string, key: string): Promise<string | null>;

// Translated strings used in this module
const LOBBYSETTINGS_TXT_SAVED_OFFLINE = await getTranslatedTextByKey(getUserLang(), 'lobbySettings.notify.savedOffline');
const LOBBYSETTINGS_TXT_SAVED = await getTranslatedTextByKey(getUserLang(), 'lobbySettings.notify.saved');
const LOBBYSETTINGS_TXT_SAVE_ERROR = await getTranslatedTextByKey(getUserLang(), 'lobbySettings.notify.saveError');
const LOBBYSETTINGS_TXT_LEFT_QUEUE = await getTranslatedTextByKey(getUserLang(), 'lobbySettings.notify.leftQueue');
const LOBBYSETTINGS_TXT_LEAVE_QUEUE_ERROR = await getTranslatedTextByKey(getUserLang(), 'lobbySettings.notify.leaveQueueError');
const LOBBYSETTINGS_TXT_ADDED_QUEUE = await getTranslatedTextByKey(getUserLang(), 'lobbySettings.notify.addedQueue');
const LOBBYSETTINGS_TXT_ADD_QUEUE_ERROR = await getTranslatedTextByKey(getUserLang(), 'lobbySettings.notify.addQueueError');
const LOBBYSETTINGS_TXT_LOGIN_REQUIRED = await getTranslatedTextByKey(getUserLang(), 'lobbySettings.notify.loginRequired');

declare global {
	interface Window {
		setPartialLobbyConfig: (partial: Partial<Settings>) => void;
		lobbySettings?: Settings;
		currentUser: UserData | null;
		currentUserReady: Promise<void>;
		selectLobbyMode: (modeKey: "reset" | "online" | "offline" | "join") => void;
		changeLobbyCodeInput: (newCode: string) => void;
		isGameOffline: boolean;
		tournamentMode: "online" | "offline";
	}
}

declare function loadPage(url: string): void;


/* -------------------------------------------------------------------------- */
/*                                    Utils                                    */
/* -------------------------------------------------------------------------- */

/** ### getEl
 * - get element by ID + typed
 * @param id - element ID
 * @returns - typed HTMLElement
 * @throws - if element not found
 */
function getEl<T extends HTMLElement>(id: string): T {
	const el = document.getElementById(id);
	if (!el) throw new Error(`Missing element #${id}`);
	return el as T;
}

/** ### getElQS
 * - get element by query selector + typed
 * @param selector - CSS selector
 * @returns - typed Element
 * @throws - if element not found
 */
function getElQS<T extends Element>(selector: string): T {
	const el = document.querySelector(selector);
	if (!el) throw new Error(`Missing element ${selector}`);
	return el as T;
}

/** ### readNumber
 * - read number from input, with fallback
 * @param input - HTML input element
 * @param fallback - fallback value if input is not a valid number
 * @returns - number value from input or fallback
 */
function readNumber(input: HTMLInputElement, fallback = 0): number {
	const n = Number(input.value);
	return Number.isFinite(n) ? n : fallback;
}

/** ### setInput
 * - set input value or checked state based on type
 * @param input - HTML input element
 * @param value - number or boolean value to set
 */
function setInput(input: HTMLInputElement, value: number | boolean): void {
	if (input.type === "checkbox") input.checked = Boolean(value);
	else input.value = String(value);
}

/** ### setSpan
 * - set span text content
 * @param span - HTML span element
 * @param v - value to set
 */
function setSpan(span: HTMLSpanElement | undefined | null, v: string | number): void {
	if (!span) return;
	span.textContent = String(v);
}


/* -------------------------------------------------------------------------- */
/*                                Default settings                             */
/* -------------------------------------------------------------------------- */

const defaultSettings: Settings = {
	game: {
		mode: "online",
		spectatorsAllowed: true,
		maxPlayers: 2,
		code: ''
	},
	scoring: {
		firstTo: 5,
		winBy: 1,
	},
	ball: {
		radius: 6,
		initialSpeed: 400,
		maxSpeed: 800,
		speedIncrement: 20,
		initialAngleRange: 20,
		maxBounceAngle: 60,
		allowSpin: false,
		spinFactor: 0.5,
		resetOnScore: true,
	},
	paddles: {
		width: 10,
		height: 80,
		margin: 20,
		maxSpeed: 400,
		acceleration: 1000,
		friction: 0.9,
	},
	field: {
		wallThickness: 10,
	},
	world: {
		width: 800,
		height: 600,
	},
};

let currentSettings: Settings = structuredClone(defaultSettings);
let customPlayerCount: 2 | 4 = defaultSettings.game.maxPlayers as 2 | 4;
let tournamentPlayerCount: 4 | 8 | 16 = 4;

/* -------------------------------------------------------------------------- */
/*                                   UI registry                               */
/* -------------------------------------------------------------------------- */

const ui = {
	base: {
		firstToInput: getEl<HTMLInputElement>("lobby-first-to"),
		firstToSpan: getEl<HTMLSpanElement>("lobby-first-to-value"),
		winByInput: getEl<HTMLInputElement>("lobby-win-by"),
		winBySpan: getEl<HTMLSpanElement>("lobby-win-by-value"),
		customGameCodeInput: getEl<HTMLInputElement>("lobby-game-code")
	},
	ball: {
		radius: getEl<HTMLInputElement>("ball-radius"),
		initialSpeed: getEl<HTMLInputElement>("ball-initial-speed"),
		maxSpeed: getEl<HTMLInputElement>("ball-max-speed"),
		speedIncrement: getEl<HTMLInputElement>("ball-speed-increment"),
		initialAngleRange: getEl<HTMLInputElement>("ball-initial-angle-range"),
		initialAngleRangeSpan: getEl<HTMLSpanElement>("ball-initial-angle-range-value"),
		maxBounceAngle: getEl<HTMLInputElement>("ball-max-bounce-angle"),
		maxBounceAngleSpan: getEl<HTMLSpanElement>("ball-max-bounce-angle-value"),
		allowSpin: getEl<HTMLInputElement>("ball-allow-spin"),
		spinFactor: getEl<HTMLInputElement>("ball-spin-factor"),
		resetOnScore: getEl<HTMLInputElement>("ball-reset-on-score"),
	},
	paddles: {
		width: getEl<HTMLInputElement>("paddle-width"),
		height: getEl<HTMLInputElement>("paddle-height"),
		margin: getEl<HTMLInputElement>("paddle-margin"),
		maxSpeed: getEl<HTMLInputElement>("paddle-max-speed"),
		acceleration: getEl<HTMLInputElement>("paddle-acceleration"),
		friction: getEl<HTMLInputElement>("paddle-friction"),
	},
	field: {
		wallThickness: getEl<HTMLInputElement>("field-wall-thickness"),
	},
	world: {
		width: getEl<HTMLInputElement>("world-width"),
		height: getEl<HTMLInputElement>("world-height"),
	},
	actions: {
		reset: getEl<HTMLButtonElement>("lobby-reset-settings-button"),
		save: getEl<HTMLButtonElement>("lobby-save-settings-button"),
	},
	lobby: {
		numPlayersSelect: document.getElementById("lobby-num-players") as HTMLSelectElement,
		maxPlayersSpan: document.getElementById("player-max-count") as HTMLSpanElement,
	},
	actionButtons: {
		joinBtn: getEl<HTMLButtonElement>("lobby-btn-join"),
		leaveBtn: getEl<HTMLButtonElement>("lobby-btn-leave"),
		launchBtn: getEl<HTMLButtonElement>("lobby-btn-launch"),
	},
} as const;

function setCustomPlayerCount(v: 2 | 4): void {
	customPlayerCount = v;
	currentSettings.game.maxPlayers = v as any;
	ui.lobby.numPlayersSelect.value = String(v);
	setSpan(ui.lobby.maxPlayersSpan, v);
}

function setTournamentPlayerCount(v: 4 | 8 | 16): void {
	tournamentPlayerCount = v;
	currentSettings.game.maxPlayers = v as any;
	ui.tournament.numPlayers.value = String(v);
	setSpan(ui.lobby.maxPlayersSpan, v);
}

/* -------------------------------------------------------------------------- */
/*                              UI population helpers                          */
/* -------------------------------------------------------------------------- */

/** ### populateUi
 * - populate the UI inputs with current settings
 */
function populateUi(): void {
	const s = currentSettings;

	// base / scoring
	ui.base.firstToInput.value = String(s.scoring.firstTo);
	setSpan(ui.base.firstToSpan, s.scoring.firstTo);
	ui.base.winByInput.value = String(s.scoring.winBy);
	setSpan(ui.base.winBySpan, s.scoring.winBy);
	// lobby player count
	ui.lobby.numPlayersSelect.value = String(s.game.maxPlayers);
	setSpan(ui.lobby.maxPlayersSpan, s.game.maxPlayers);
	if (s.game.maxPlayers === 2 || s.game.maxPlayers === 4) {
		setCustomPlayerCount(s.game.maxPlayers);
		customPlayerCount = s.game.maxPlayers;
		// keep tournament select in a sensible state
		ui.tournament.numPlayers.value = String(tournamentPlayerCount);
	} else if (s.game.maxPlayers === 8 || s.game.maxPlayers === 16) {
		setTournamentPlayerCount(s.game.maxPlayers);
	} else {
		// fallback
		setTournamentPlayerCount(4);
	}

	// ball
	setInput(ui.ball.radius, s.ball.radius);
	setInput(ui.ball.initialSpeed, s.ball.initialSpeed);
	setInput(ui.ball.maxSpeed, s.ball.maxSpeed);
	setInput(ui.ball.speedIncrement, s.ball.speedIncrement);
	setInput(ui.ball.initialAngleRange, s.ball.initialAngleRange);
	setSpan(ui.ball.initialAngleRangeSpan, s.ball.initialAngleRange);
	setInput(ui.ball.maxBounceAngle, s.ball.maxBounceAngle);
	setSpan(ui.ball.maxBounceAngleSpan, s.ball.maxBounceAngle);
	setInput(ui.ball.allowSpin, s.ball.allowSpin);
	setInput(ui.ball.spinFactor, s.ball.spinFactor);
	setInput(ui.ball.resetOnScore, s.ball.resetOnScore);

	// paddles
	setInput(ui.paddles.width, s.paddles.width);
	setInput(ui.paddles.height, s.paddles.height);
	setInput(ui.paddles.margin, s.paddles.margin);
	setInput(ui.paddles.maxSpeed, s.paddles.maxSpeed);
	setInput(ui.paddles.acceleration, s.paddles.acceleration);
	setInput(ui.paddles.friction, s.paddles.friction);

	// field / world
	setInput(ui.field.wallThickness, s.field.wallThickness);
	setInput(ui.world.width, s.world.width);
	setInput(ui.world.height, s.world.height);
}

/* -------------------------------------------------------------------------- */
/*                           Public partial setter                             */
/* -------------------------------------------------------------------------- */

/** ### setPartialLobbyConfig
 * - set partial settings and update UI accordingly
 * @param partial - partial settings to merge
 */
export function setPartialLobbyConfig(partial: Partial<Settings>): void {
	currentSettings = {
		...currentSettings,
		...partial,
		game: {
			mode: partial.game?.mode ?? currentSettings.game.mode,
			spectatorsAllowed:
				partial.game?.spectatorsAllowed ??
				currentSettings.game.spectatorsAllowed,
			maxPlayers:
				partial.game?.maxPlayers ??
				currentSettings.game.maxPlayers,
		},
		scoring: {
			firstTo:
				partial.scoring?.firstTo ??
				currentSettings.scoring.firstTo,
			winBy:
				partial.scoring?.winBy ??
				currentSettings.scoring.winBy,
		},
		ball: { ...currentSettings.ball, ...(partial.ball ?? {}) },
		paddles: { ...currentSettings.paddles, ...(partial.paddles ?? {}) },
		field: { ...currentSettings.field, ...(partial.field ?? {}) },
		world: { ...currentSettings.world, ...(partial.world ?? {}) },
	};

	populateUi();
	window.lobbySettings = structuredClone(currentSettings);
}

/* -------------------------------------------------------------------------- */
/*                                  Bind helpers                               */
/* -------------------------------------------------------------------------- */

/** ### bindNumber
 * - bind input number changes to onChange callback
 * @param input - HTML input element
 * @param onChange - callback to invoke on change
 */
function bindNumber(input: HTMLInputElement, onChange: (v: number) => void): void {
	addListener(input, "input", (_ev) => onChange(readNumber(input)));
}

/** ### bindCheckbox
 * - bind checkbox changes to onChange callback
 * @param input - HTML input element
 * @param onChange - callback to invoke on change
 */
function bindCheckbox(input: HTMLInputElement, onChange: (v: boolean) => void): void {
	addListener(input, "change", (_ev) => onChange(input.checked));
}

/* -------------------------------------------------------------------------- */
/*                                   Wire UI                                   */
/* -------------------------------------------------------------------------- */

/** ### wire
 * - wire up UI inputs to currentSettings
 */
function wire(): void {
	// base / scoring
	addListener(ui.base.firstToInput, "input", () => {
		const v = readNumber(ui.base.firstToInput, defaultSettings.scoring.firstTo);
		currentSettings.scoring.firstTo = v;
		setSpan(ui.base.firstToSpan, v);
	});
	addListener(ui.base.winByInput, "input", () => {
		const v = readNumber(ui.base.winByInput, defaultSettings.scoring.winBy);
		currentSettings.scoring.winBy = v;
		setSpan(ui.base.winBySpan, v);
	});

	// lobby player count
	addListener(ui.lobby.numPlayersSelect, "change", () => {
		const v = parseInt(ui.lobby.numPlayersSelect.value, 10) || defaultSettings.game.maxPlayers;
		if (v !== 2 && v !== 4) return; // invalid value
		currentSettings.game.maxPlayers = v;
		setSpan(ui.lobby.maxPlayersSpan, v);
	});

	// custom game code
	addListener(ui.base.customGameCodeInput, "input", () => {
		const v = ui.base.customGameCodeInput.value.trim();
		currentSettings.game.code = v;
	});

	// ball
	bindNumber(ui.ball.radius, (v) => (currentSettings.ball.radius = v));
	bindNumber(ui.ball.initialSpeed, (v) => (currentSettings.ball.initialSpeed = v));
	bindNumber(ui.ball.maxSpeed, (v) => (currentSettings.ball.maxSpeed = v));
	bindNumber(ui.ball.speedIncrement, (v) => (currentSettings.ball.speedIncrement = v));

	addListener(ui.ball.initialAngleRange, "input", () => {
		let v = readNumber(ui.ball.initialAngleRange, defaultSettings.ball.initialAngleRange);
		if (v < 0) v = 0;
		if (v > 90) v = 90;
		currentSettings.ball.initialAngleRange = v;
		setSpan(ui.ball.initialAngleRangeSpan, v);
	});
	addListener(ui.ball.maxBounceAngle, "input", () => {
		let v = readNumber(ui.ball.maxBounceAngle, defaultSettings.ball.maxBounceAngle);
		if (v < 0) v = 0;
		if (v > 90) v = 90;
		currentSettings.ball.maxBounceAngle = v;
		setSpan(ui.ball.maxBounceAngleSpan, v);
	});

	bindCheckbox(ui.ball.allowSpin, (v) => (currentSettings.ball.allowSpin = v));
	bindNumber(ui.ball.spinFactor, (v) => (currentSettings.ball.spinFactor = v));
	bindCheckbox(ui.ball.resetOnScore, (v) => (currentSettings.ball.resetOnScore = v));

	// paddles
	bindNumber(ui.paddles.width, (v) => (currentSettings.paddles.width = v));
	bindNumber(ui.paddles.height, (v) => (currentSettings.paddles.height = v));
	bindNumber(ui.paddles.margin, (v) => (currentSettings.paddles.margin = v));
	bindNumber(ui.paddles.maxSpeed, (v) => (currentSettings.paddles.maxSpeed = v));
	bindNumber(ui.paddles.acceleration, (v) => (currentSettings.paddles.acceleration = v));
	bindNumber(ui.paddles.friction, (v) => (currentSettings.paddles.friction = v));

	// field / world
	bindNumber(ui.field.wallThickness, (v) => (currentSettings.field.wallThickness = v));
	bindNumber(ui.world.width, (v) => (currentSettings.world.width = v));
	bindNumber(ui.world.height, (v) => (currentSettings.world.height = v));

	// tournament settings
	addListener(ui.tournament.firstToInput, "input", () => {
		const v = readNumber(ui.tournament.firstToInput, defaultSettings.scoring.firstTo);
		currentSettings.scoring.firstTo = v;
		setSpan(ui.tournament.firstToSpan, v);
		// sync with custom game
		ui.base.firstToInput.value = String(v);
		setSpan(ui.base.firstToSpan, v);
	});

	addListener(ui.tournament.winByInput, "input", () => {
		const v = readNumber(ui.tournament.winByInput, defaultSettings.scoring.winBy);
		currentSettings.scoring.winBy = v;
		setSpan(ui.tournament.winBySpan, v);
		// sync with custom game
		ui.base.winByInput.value = String(v);
		setSpan(ui.base.winBySpan, v);
	});

	bindCheckbox(ui.tournament.allowSpectators, (v) => {
		currentSettings.game.spectatorsAllowed = v;
		ui.base.allowSpectators.checked = v;
	});

	addListener(ui.tournament.numPlayers, "change", () => {
		const raw = parseInt(ui.tournament.numPlayers.value, 10) || 4;
		const v: 4 | 8 | 16 = raw === 16 ? 16 : raw === 8 ? 8 : 4;
		setTournamentPlayerCount(v);
	});

	addListener(ui.tournament.resetBtn, "click", () => {
		currentSettings = structuredClone(defaultSettings);
		populateUi();
	});

	addListener(ui.tournament.saveBtn, "click", () => {
		fetch("/api/game/settings", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ settings: currentSettings }),
		}).then(async (res) => {
			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to save settings.');
			}
			notify(LOBBYSETTINGS_TXT_SAVED || 'Settings saved successfully.', { type: "success" });
		} catch (err: any) {
			const msg = LOBBYSETTINGS_TXT_SAVE_ERROR ? LOBBYSETTINGS_TXT_SAVE_ERROR.replace('{error}', err.message) : `Error saving settings: ${err.message}`;
			notify(msg, { type: "error" });
		}
	});

	// tournament settings
	addListener(ui.tournament.firstToInput, "input", () => {
		const v = readNumber(ui.tournament.firstToInput, defaultSettings.scoring.firstTo);
		currentSettings.scoring.firstTo = v;
		setSpan(ui.tournament.firstToSpan, v);
		// sync with custom game
		ui.base.firstToInput.value = String(v);
		setSpan(ui.base.firstToSpan, v);
	});

	addListener(ui.tournament.winByInput, "input", () => {
		const v = readNumber(ui.tournament.winByInput, defaultSettings.scoring.winBy);
		currentSettings.scoring.winBy = v;
		setSpan(ui.tournament.winBySpan, v);
		// sync with custom game
		ui.base.winByInput.value = String(v);
		setSpan(ui.base.winBySpan, v);
	});

	bindCheckbox(ui.tournament.allowSpectators, (v) => {
		currentSettings.game.spectatorsAllowed = v;
		ui.base.allowSpectators.checked = v;
	});

	addListener(ui.tournament.numPlayers, "change", () => {
		const raw = parseInt(ui.tournament.numPlayers.value, 10) || 4;
		const v: 4 | 8 | 16 = raw === 16 ? 16 : raw === 8 ? 8 : 4;
		setTournamentPlayerCount(v);
	});

	addListener(ui.tournament.resetBtn, "click", () => {
		currentSettings = structuredClone(defaultSettings);
		populateUi();
	});

	addListener(ui.actions.save, "click", async () => {
		if (window.isGameOffline) {
			window.lobbySettings = structuredClone(currentSettings);
			notify(LOBBYSETTINGS_TXT_SAVED_OFFLINE || 'Settings saved locally for offline game.', { type: "success" });
			return;
		}

		// avoid sending an empty `code` field (server will reject with "Invalid code")
		const payloadSettings: any = structuredClone(currentSettings);
		if (payloadSettings?.game && typeof payloadSettings.game.code === 'string' && payloadSettings.game.code.trim() === '') {
			delete payloadSettings.game.code;
		}

		try {
			const res = await fetch("/api/game/settings", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ settings: payloadSettings }),
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to save settings.');
			}

			notify(LOBBYSETTINGS_TXT_SAVED || 'Settings saved successfully.', { type: "success" });
		} catch (err: any) {
			const msg = LOBBYSETTINGS_TXT_SAVE_ERROR ? LOBBYSETTINGS_TXT_SAVE_ERROR.replace('{error}', err.message) : `Error saving settings: ${err.message}`;
			notify(msg, { type: "error" });
		}
	});
}

	// actions
	addListener(ui.actions.reset, "click", () => {
		currentSettings = structuredClone(defaultSettings);
		populateUi();
	});

	addListener(ui.actions.save, "click", async () => {
		if (window.isGameOffline) {
			window.lobbySettings = structuredClone(currentSettings);
			notify(LOBBYSETTINGS_TXT_SAVED_OFFLINE || 'Settings saved locally for offline game.', { type: "success" });
			return;
		}

		// avoid sending an empty `code` field (server will reject with "Invalid code")
		const payloadSettings: any = structuredClone(currentSettings);
		if (payloadSettings?.game && typeof payloadSettings.game.code === 'string' && payloadSettings.game.code.trim() === '') {
			delete payloadSettings.game.code;
		}

		try {
			const res = await fetch("/api/game/settings", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ settings: payloadSettings }),
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to save settings.');
			}

			notify(LOBBYSETTINGS_TXT_SAVED || 'Settings saved successfully.', { type: "success" });
		} catch (err: any) {
			const msg = LOBBYSETTINGS_TXT_SAVE_ERROR ? LOBBYSETTINGS_TXT_SAVE_ERROR.replace('{error}', err.message) : `Error saving settings: ${err.message}`;
			notify(msg, { type: "error" });
		}
	});
}

export function changeLobbyCodeInput(newCode: string): void {
	ui.base.customGameCodeInput.value = newCode;
	currentSettings.game.code = newCode;
}

window.changeLobbyCodeInput = changeLobbyCodeInput;

/* -------------------------------------------------------------------------- */
/*                                  Initialization                             */
/* -------------------------------------------------------------------------- */

// if (window.lobbySettings) {
// 	selectLobbyMode("online");
// 	setPartialLobbyConfig(window.lobbySettings);
// }

/** ### initLobbySettings
 * - initialize lobby settings with optional initial partial settings
 * @param initial - optional initial partial settings
 */
export function initLobbySettings(initial?: Partial<Settings>): void {
	currentSettings = window.lobbySettings ? window.lobbySettings : structuredClone(defaultSettings);
	// TODO 
	if (window.lobbySettings) {
		selectLobbyMode("online");
		setPartialLobbyConfig(window.lobbySettings);
	}
	if (initial) setPartialLobbyConfig(initial);
	populateUi();
	window.lobbySettings = structuredClone(currentSettings);
	wire();
}

/* auto-init */
initLobbySettings();


/* -------------------------------------------------------------------------- */
/*                                 UI – Modes                                  */
/* -------------------------------------------------------------------------- */

/** ### Mode
 * - structure representing a lobby mode (button + tab)
 * @property **button** - HTML button element for the mode
 * @property **tab** - HTML div element for the mode's tab content
 */
type Mode = {
	button: HTMLButtonElement;
	tab: HTMLDivElement;
};

/** ### modes
 * - record of available lobby modes
 * - keys: 'multiplayer' | 'custom' | 'tournament'
 */
const modes: Record<string, Mode> = {
	multiplayer: {
		button: getEl("lobby-multiplayer-button"),
		tab: getEl("lobby-multiplayer-tab"),
	},
	custom: {
		button: getEl("lobby-custom-game-button"),
		tab: getEl("lobby-custom-game-tab"),
	},
	tournament: {
		button: getEl("lobby-tournament-button"),
		tab: getEl("lobby-custom-game-tab"),
	},
};

/* -------------------------------------------------------------------------- */
/*                                   Sub-tabs                                  */
/* -------------------------------------------------------------------------- */

/** ### SubTabs
 * - structure representing sub-tabs within a mode (buttons + tabs)
 * @property **basicBtn** - HTML button element for the basic settings tab
 * @property **advBtn** - HTML button element for the advanced settings tab
 * @property **basicTab** - HTML div element for the basic settings tab content
 * @property **advTab** - HTML div element for the advanced settings tab content
 */
type SubTabs = {
	basicBtn: HTMLButtonElement;
	advBtn: HTMLButtonElement;
	basicTab: HTMLDivElement;
	advTab: HTMLDivElement;
};

type SubTabsMultiplayer = {
	findBtn: HTMLButtonElement;
	leaveBtn: HTMLButtonElement;
};

/** ### subTabs
 * - record of sub-tabs for custom and tournament modes
 */
const subTabsMultiplayer: Record<string, SubTabsMultiplayer> = {
	multiplayer: {
		findBtn: getEl("lobby-waiting-find-player"),
		leaveBtn: getEl("lobby-leave-queue")
	}
};

const uiTournament = {
	launchOnlineBtn: getEl<HTMLButtonElement>("lobby-tournament-online"),
	launchOfflineBtn: getEl<HTMLButtonElement>("lobby-tournament-offline"),
};

/** ### createTournament
 * Create a new online tournament or rejoin if already in one.
 * Sends a request to the server to create the tournament.
 * On success, navigates to the tournament page with the tournament ID.
 */
async function createTournament(): Promise<void> {
	// Check if user is already in a tournament
	const existingTournamentId = sessionStorage.getItem('tournamentId');
	if (existingTournamentId) {
		// User already in a tournament, just navigate to it
		const res = await fetch(`/api/tournament/${existingTournamentId}/status`, {
			method: "GET",
			headers: { "Content-Type": "application/json" },
		});

		const data = await res.json();
		if (res.ok) {
			notify("Rejoining existing tournament.", { type: "info" });
			loadPage("/tournament");
		} else {
			notify(`Failed to rejoin tournament: ${data.error || 'Unknown error'}`, { type: 'error' });
			// Clear invalid tournament ID
			sessionStorage.removeItem('tournamentId');
			sessionStorage.removeItem('tournamentCode');
			sessionStorage.removeItem('tournamentVisibility');
			return;
		}
		return;
	}

	const visibility = (document.getElementById("lobby-private-checkbox-custom-game") as any | null).checked;
	console.log("Creating tournament with visibility:", visibility);
	const res = await fetch("/api/tournament/create", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			visibility: visibility ? "private" : "public",
			config: window.lobbySettings || {},
		}),
	});

	const data = await res.json();
	if (!res.ok) {
		notify(`Failed to create tournament: ${data.error || 'Unknown error'}`, { type: 'error' });
		return;
	}

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
}

addListener(uiTournament.launchOnlineBtn, "click", () => {
	window.tournamentMode = "online";
	createTournament();
});

addListener(uiTournament.launchOfflineBtn, "click", () => {
	window.tournamentMode = "offline";
	setPartialLobbyConfig(currentSettings);
	loadPage("/tournament");
});

const subTabs: Record<string, SubTabs> = {
	custom: {
		basicBtn: getEl("lobby-custom-game-basic-settings-button"),
		advBtn: getEl("lobby-custom-game-advanced-settings-button"),
		basicTab: getEl("lobby-custom-game-basic-settings"),
		advTab: getEl("lobby-custom-game-advanced-settings"),
	},
	tournament: {
		basicBtn: getEl("lobby-custom-game-basic-settings-button"),
		advBtn: getEl("lobby-custom-game-advanced-settings-button"),
		basicTab: getEl("lobby-custom-game-basic-settings"),
		advTab: getEl("lobby-custom-game-advanced-settings"),
	}
};

/** ### setupSubTabs
 * - add click listeners to sub-tab buttons (basic/advanced)
 * - also sets up the game finding button on the multiplayer tab
 */
function setupSubTabs(): void {
	Object.values(subTabs).forEach((tab) => {
		addListener(tab.basicBtn, "click", () => {
			tab.basicBtn.classList.add("lobby-btn-active");
			tab.advBtn.classList.remove("lobby-btn-active");
			tab.basicTab.classList.remove("unloaded");
			tab.advTab.classList.add("unloaded");
		});

		addListener(tab.advBtn, "click", () => {
			tab.advBtn.classList.add("lobby-btn-active");
			tab.basicBtn.classList.remove("lobby-btn-active");
			tab.advTab.classList.remove("unloaded");
			tab.basicTab.classList.add("unloaded");
		});
	});

	// Setup game finding on multiplayer tab
	addListener(subTabsMultiplayer.multiplayer.findBtn, "click", async () => {
		try {
			const response = await fetch("/api/game/finding", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ settings: currentSettings }),
			});

			if (!response.ok) {
				throw new Error("Request failed");
			}

			const data = await response.json();
			window.dispatchEvent(new CustomEvent("joinQueue", { detail: { socketToken: data.authToken } }));

			notify(LOBBYSETTINGS_TXT_ADDED_QUEUE || "You are added in a queue.", { type: "success" });
		} catch (error) {
			notify(LOBBYSETTINGS_TXT_ADD_QUEUE_ERROR || "Error adding in queue.", { type: "error" });
		}
	});
}

/* -------------------------------------------------------------------------- */
/*                         Mode selection & Join handlers                      */
/* -------------------------------------------------------------------------- */

/**
 * Custom-game selection state
 * - "none" => show online/offline choice
 * - "online" | "offline" => show settings for chosen mode
 */
type CustomGameSelection = "none" | "online" | "offline";
let customGameSelection: CustomGameSelection = "none";

/** ### updateCustomGameUi
 * - synchronise Custom Game area (either choice panel or settings tab)
 */
function updateCustomGameUi(): void {
	const lobbySelectMode = getEl<HTMLDivElement>("lobby-select-mode");
	const customTab = modes.custom.tab;

	if (customGameSelection === "none") {
		// show the online/offline choice
		lobbySelectMode.classList.remove("unloaded");
		lobbySelectMode.classList.add("current-mode");

		customTab.classList.add("unloaded");
		customTab.classList.remove("current-mode");
	} else {
		// show custom settings
		lobbySelectMode.classList.add("unloaded");
		lobbySelectMode.classList.remove("current-mode");

		customTab.classList.remove("unloaded");
		customTab.classList.add("current-mode");
	}
}

/**
 * ### setupModeSelection
 * - add click listeners to the top-mode buttons (multiplayer/custom/tournament)
 * - switching updates active tab + button
 */
function setupModeSelection(): void {
	Object.values(modes).forEach((mode) => {
		addListener(mode.button, "click", () => {
			Object.values(modes).forEach(m => {
				const isActive = m === mode;

				m.button.classList.toggle("current-mode", isActive);
				m.tab.classList.toggle("unloaded", !isActive);
				m.tab.classList.toggle("current-mode", isActive);
				customGameSelection = "offline";
			});

			const lobbySelectMode = getEl<HTMLDivElement>("lobby-select-mode");
			// when switching to custom tab, decide what to show based on state
			if (mode === modes.custom)
				updateCustomGameUi();
			if(mode === modes.tournament){
				const galungaDiv = getElQS<HTMLDivElement>("#galunga");
				galungaDiv.classList.add("unloaded");
				uiTournament.launchOnlineBtn.classList.remove("unloaded");
				uiTournament.launchOfflineBtn.classList.remove("unloaded");
				lobbySelectMode.classList.add("unloaded");
				subTabs.custom.basicTab.classList.remove("grayed");
			} else {
				// hide the online/offline selector if we're not on custom
				lobbySelectMode.classList.add("unloaded");
				uiTournament.launchOnlineBtn.classList.add("unloaded");
				uiTournament.launchOfflineBtn.classList.add("unloaded");
			};
				m.button.classList.toggle("current-mode", m === mode);
				m.tab.classList.toggle("unloaded", m !== mode);
			});
		});
	});
}

/**
 * ### selectLobbyMode
 * - centralised behaviour when the user picks online/offline/join
 * - updates the action buttons & custom UI accordingly
 * @param modeKey - 'online' | 'offline' | 'join' | 'reset'
 */
function selectLobbyMode(modeKey: "reset" | "online" | "offline" | "join"): void {
	const galungaDiv = getElQS<HTMLDivElement>("#galunga");
	// update internal state
	if (modeKey === "reset")
		customGameSelection = "none";
	else if (modeKey === "offline") {
		customGameSelection = "offline";
		window.isGameOffline = true;
		subTabs.custom.basicTab.classList.remove("grayed");
		galungaDiv.classList.add("unloaded");
	} else {
		// online or join
		customGameSelection = "online";
		window.isGameOffline = false;
		galungaDiv.classList.remove("unloaded");
	}

	// update UI for custom game area
	updateCustomGameUi();

	// update action buttons / join box
	const lobbyActionButtons = getElQS<HTMLDivElement>("#lobby-action-buttons");
	const joinBtn = ui.actionButtons.joinBtn;
	const leaveBtn = ui.actionButtons.leaveBtn;
	const joinBox = getElQS<HTMLDivElement>("#lobby-join-box");
	const tabMode = document.querySelector("#lobby-mode-buttons");

	// ensure actions visible when appropriate
	if (customGameSelection === "offline") {
		lobbyActionButtons.classList.remove("unloaded");
		joinBtn.classList.add("unloaded");
		leaveBtn.classList.remove("unloaded");
		joinBox.classList.add("unloaded");
		let tabMode = document.querySelector("#lobby-mode-buttons");
		tabMode?.classList.add("grayed");
		document.querySelector(".lobby-setting-box")?.classList.remove("grayed");
	} else if (customGameSelection === "online") {
		lobbyActionButtons.classList.remove("unloaded");
		joinBtn.classList.remove("unloaded");
		leaveBtn.classList.remove("unloaded");
		joinBox.classList.remove("unloaded");
		tabMode?.classList.remove("grayed");
	} else {
		// reset state
		lobbyActionButtons.classList.add("unloaded");
		tabMode?.classList.remove("grayed");
	}
}

// expose function to window for external use
window.selectLobbyMode = selectLobbyMode;

/** ### setupLobbyModeHandlers
 * - attach listeners to offline/online/join UI elements
 * - exported so other modules can call it after DOM changes if necessary
 */
async function setupLobbyModeHandlers(): Promise<void> {
	let readyCheck = false;

	const userConnected = getElQS<HTMLDivElement>("#lobby-select-mode div:first-child");
	const lobbyJoin = getElQS<HTMLDivElement>("#lobby-join-box");

	// offline/online elements are DIVs in markup — use the correct type
	const offlineBtn = getEl<HTMLDivElement>("lobby-offline");
	const onlineBtn = getEl<HTMLDivElement>("lobby-online");

	const isUserLogged = await window.currentUserReady.then(() => {
		return (window.currentUser !== null);
	});

	// enable/disable join area depending on login presence
	if (isUserLogged) {
		getElQS<HTMLDivElement>("#lobby-action-buttons").classList.remove("unloaded");
		userConnected.classList.remove("unclickable");
		lobbyJoin.classList.remove("unclickable");
	} else {
		userConnected.classList.add("unclickable");
		lobbyJoin.classList.add("unclickable");
		getElQS<HTMLDivElement>("#lobby-join-box")?.classList.add("unloaded");
	}

	addListener(offlineBtn, "click", () => {
		readyCheck = true;
		selectLobbyMode("offline");
		// show basic tab for custom offline immediately
		subTabs.custom.basicTab.classList.remove("grayed");
		ui.actionButtons.launchBtn.classList.remove("unloaded");
	});

	// online button handler
	addListener(onlineBtn, "click", () => {
		readyCheck = true;
		selectLobbyMode("online");
	});

	addListener(ui.actionButtons.leaveBtn, "click", () => {
		selectLobbyMode("reset");
	});
}

setupSubTabs();


/* -------------------------------------------------------------------------- */
/*                                   Sub-tabs                                  */
/* -------------------------------------------------------------------------- */

/** ### SubTabs
 * - structure representing sub-tabs within a mode (buttons + tabs)
 * @property **basicBtn** - HTML button element for the basic settings tab
 * @property **advBtn** - HTML button element for the advanced settings tab
 * @property **basicTab** - HTML div element for the basic settings tab content
 * @property **advTab** - HTML div element for the advanced settings tab content
 */
type SubTabs = {
	basicBtn: HTMLButtonElement;
	advBtn: HTMLButtonElement;
	basicTab: HTMLDivElement;
	advTab: HTMLDivElement;
};

/** ### subTabs
 * - record of sub-tabs for custom and tournament modes
 */
const subTabs: Record<string, SubTabs> = {
	custom: {
		basicBtn: getEl("lobby-custom-game-basic-settings-button"),
		advBtn: getEl("lobby-custom-game-advanced-settings-button"),
		basicTab: getEl("lobby-custom-game-basic-settings"),
		advTab: getEl("lobby-custom-game-advanced-settings"),
	},
	tournament: {
		basicBtn: getEl("lobby-tournament-basic-settings-button"),
		advBtn: getEl("lobby-tournament-advanced-settings-button"),
		basicTab: getEl("lobby-tournament-basic-settings"),
		advTab: getEl("lobby-tournament-advanced-settings"),
	},
};

function setupSubTabs(): void {
	Object.values(subTabs).forEach((tab) => {
		addListener(tab.basicBtn, "click", () => {
			tab.basicBtn.classList.add("lobby-btn-active");
			tab.advBtn.classList.remove("lobby-btn-active");
			tab.basicTab.classList.remove("unloaded");
			tab.advTab.classList.add("unloaded");
		});

		addListener(tab.advBtn, "click", () => {
			tab.advBtn.classList.add("lobby-btn-active");
			tab.basicBtn.classList.remove("lobby-btn-active");
			tab.advTab.classList.remove("unloaded");
			tab.basicTab.classList.add("unloaded");
		});
	});
}

/* -------------------------------------------------------------------------- */
/*                                    Boot                                      */
/* -------------------------------------------------------------------------- */

window.setPartialLobbyConfig = setPartialLobbyConfig;

setupModeSelection();
wire();

if (window.lobbySettings)
	setPartialLobbyConfig(window.lobbySettings);

if (window.socket && window.lobbySettings) {
	selectLobbyMode("online");
	setPartialLobbyConfig(window.lobbySettings);
}
else if (window.isGameOffline && window.lobbySettings) {
	selectLobbyMode("offline");
	setPartialLobbyConfig(window.lobbySettings);
} else {
	window.lobbySettings = structuredClone(currentSettings);
	setupLobbyModeHandlers();
}
const TOURNAMENT_STORAGE_KEY = "ft_tournament_offline_state_v1";
localStorage.removeItem(TOURNAMENT_STORAGE_KEY);

// Auto-join by code present in URL (query `?code=ABCD`, `?gameCode=ABCD`, path ending with `/ABCD`, or hash `#ABCD`).
// Reuses the same logic as the `JOIN` button by setting the input value and dispatching a click event.
(async () => {
	try {
		const params = new URLSearchParams(location.search);
		let code: string | null = params.get('code') || params.get('gameCode') || null;

		if (!code) {
			const parts = location.pathname.split('/').filter(Boolean);
			const last = parts.length ? parts[parts.length - 1] : null;
			if (last && /^[A-Z0-9]{4}$/i.test(last)) code = last;
		}

		if (!code && location.hash) {
			const h = location.hash.replace(/^#/, '');
			if (/^[A-Z0-9]{4}$/i.test(h)) code = h;
		}

		if (!code) return; // no code present

		code = String(code).toUpperCase();
		if (!/^[A-Z0-9]{4}$/.test(code)) return; // invalid -> do nothing

		const isLogged = await window.currentUserReady.then(() => Boolean(window.currentUser)).catch(() => false);
		if (!isLogged) {
			notify(LOBBYSETTINGS_TXT_LOGIN_REQUIRED || 'Please log in to join a lobby from a link.', { type: 'warning' });
			return;
		}

		// reuse the same join logic directly when available
		if (typeof window.joinGame === 'function') {
			await window.joinGame(code);
		} else {
			const btn = document.getElementById('lobby-btn-join') as HTMLButtonElement | null;
			if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		}
	} catch (err) {
		console.error('Auto-join processing failed', err);
	}
})();