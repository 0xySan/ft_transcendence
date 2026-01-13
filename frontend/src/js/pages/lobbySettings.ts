import type { Settings, UserData } from "../global";

/* -------------------------------------------------------------------------- */
/*                                External helpers                            */
/* -------------------------------------------------------------------------- */

declare function addListener(
	target: EventTarget | null,
	event: string,
	handler: EventListener
): void;

declare global {
	interface Window {
		setPartialLobbyConfig: (partial: Partial<Settings>) => void;
		lobbySettings?: Settings;
		currentUser: UserData | null;
		currentUserReady: Promise<void>;
		selectLobbyMode: (modeKey: "reset" | "online" | "offline" | "join") => void;
		isGameOffline: boolean;
	}
}

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
		playerCount: 2,
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

/* -------------------------------------------------------------------------- */
/*                                   UI registry                               */
/* -------------------------------------------------------------------------- */

const ui = {
	base: {
		firstToInput: getEl<HTMLInputElement>("lobby-first-to"),
		firstToSpan: getEl<HTMLSpanElement>("lobby-first-to-value"),
		winByInput: getEl<HTMLInputElement>("lobby-win-by"),
		winBySpan: getEl<HTMLSpanElement>("lobby-win-by-value"),
		allowSpectators: getEl<HTMLInputElement>("lobby-allow-spectators"),
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
	ui.base.allowSpectators.checked = s.game.spectatorsAllowed;
	// lobby player count
	ui.lobby.numPlayersSelect.value = String(s.game.playerCount);
	setSpan(ui.lobby.maxPlayersSpan, s.game.playerCount);

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
			playerCount:
				partial.game?.playerCount ??
				currentSettings.game.playerCount,
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
	bindCheckbox(ui.base.allowSpectators, (v) => (currentSettings.game.spectatorsAllowed = v));

	// lobby player count
	addListener(ui.lobby.numPlayersSelect, "change", () => {
		const v = parseInt(ui.lobby.numPlayersSelect.value, 10) || defaultSettings.game.playerCount;
		if (v !== 2 && v !== 4) return; // invalid value
		currentSettings.game.playerCount = v;
		setSpan(ui.lobby.maxPlayersSpan, v);
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

		try {
			const res = await fetch("/api/game/settings", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ settings: currentSettings }),
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to save settings.');
			}
		}).then(() => {
			notify(LOBBYSETTINGS_TXT_SAVED || 'Settings saved successfully.', { type: "success" });
		}).catch((error) => {
			const msg = LOBBYSETTINGS_TXT_SAVE_ERROR ? LOBBYSETTINGS_TXT_SAVE_ERROR.replace('{error}', error.message) : `Error saving settings: ${error.message}`;
			notify(msg, { type: "error" });
		});
	});
}

/* -------------------------------------------------------------------------- */
/*                                  Initialization                             */
/* -------------------------------------------------------------------------- */

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
		tab: getEl("lobby-tournament-tab"),
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
		findBtn: getEl("lobby-wating-find-player"),
		leaveBtn: getEl("lobby-leave-queue")
	}
};

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

			notify("You are added in a queue.", { type: "success" });
		} catch (error) {
			notify("Error adding in queue.", { type: "error" });
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
			});

			// when switching to custom tab, decide what to show based on state
			if (mode === modes.custom) {
				updateCustomGameUi();
			} else {
				// hide the online/offline selector if we're not on custom
				const lobbySelectMode = getEl<HTMLDivElement>("lobby-select-mode");
				lobbySelectMode.classList.add("unloaded");
			}
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
	// update internal state
	if (modeKey === "reset")
		customGameSelection = "none";
	else if (modeKey === "offline") {
		customGameSelection = "offline";
		window.isGameOffline = true;
		subTabs.custom.basicTab.classList.remove("grayed");
	} else {
		// online or join
		customGameSelection = "online";
		window.isGameOffline = false;
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
