

export {};

declare function addListener(
	target: EventTarget | null,
	event: string,
	handler: EventListener
): void;

declare global {
	interface Window {
		setPartialLobbyConfig: (partial: Partial<settings>) => void;
	}
}

/* ---------------------------
   Types
   --------------------------- */
export interface BallSettings {
	radius: number;
	initialSpeed: number;
	maxSpeed: number;
	speedIncrement: number;
	initialAngleRange: number;
	maxBounceAngle: number;
	allowSpin: boolean;
	spinFactor: number;
	resetOnScore: boolean;
}

export interface PaddleSettings {
	width: number;
	height: number;
	margin: number;
	maxSpeed: number;
	acceleration: number;
	friction: number;
}

export interface FieldSettings {
	wallThickness: number;
}

export interface WorldSettings {
	width: number;
	height: number;
}

export interface GameSettings {
	mode: string;
	spectatorsAllowed: boolean;
}

export interface ScoringSettings {
	firstTo: number;
	winBy: number;
}

export interface settings {
	game: GameSettings;
	scoring: ScoringSettings;
	ball: BallSettings;
	paddles: PaddleSettings;
	field: FieldSettings;
	world: WorldSettings;
}

/* ---------------------------
   Utils
   --------------------------- */
function getEl<T extends HTMLElement>(id: string): T {
	const el = document.getElementById(id);
	if (!el) throw new Error(`Missing element #${id}`);
	return el as T;
}

function readNumber(input: HTMLInputElement, fallback = 0): number {
	const n = Number(input.value);
	return Number.isFinite(n) ? n : fallback;
}

function setInput(input: HTMLInputElement, value: number | boolean): void {
	if (input.type === "checkbox") input.checked = Boolean(value);
	else input.value = String(value);
}

function setSpan(span: HTMLSpanElement | undefined | null, v: string | number): void {
	if (!span) return;
	span.textContent = String(v);
}

function getElQS<T extends Element>(selector: string): T {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`Missing element ${selector}`);
  return el as T;
}
/* ---------------------------
   Defaults / State
   --------------------------- */
const defaultSettings: settings = {
	game: {
		mode: "online",
		spectatorsAllowed: true,
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
	}
};

let currentSettings: settings = structuredClone(defaultSettings);

/* ---------------------------
   UI registry (grouped)
   --------------------------- */
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
} as const;

/* ---------------------------
   Populate UI from state
   --------------------------- */
function populateUi(): void {
	const s = currentSettings;

	// base / scoring
	ui.base.firstToInput.value = String(s.scoring.firstTo);
	setSpan(ui.base.firstToSpan, s.scoring.firstTo);
	ui.base.winByInput.value = String(s.scoring.winBy);
	setSpan(ui.base.winBySpan, s.scoring.winBy);
	ui.base.allowSpectators.checked = s.game.spectatorsAllowed;

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

	// field/world
	setInput(ui.field.wallThickness, s.field.wallThickness);
	setInput(ui.world.width, s.world.width);
	setInput(ui.world.height, s.world.height);
}

/* ---------------------------
   Apply partial settings to inputs (public helper)
   --------------------------- */
export function setPartialLobbyConfig(partial: Partial<settings>): void {
	currentSettings = {
		...currentSettings,
		...partial,
		game: {
			mode: partial.game?.mode ?? currentSettings.game.mode,
			spectatorsAllowed:
				partial.game?.spectatorsAllowed ??
				currentSettings.game.spectatorsAllowed,
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
}

/* ---------------------------
   Bind helpers
   --------------------------- */
function bindNumber(input: HTMLInputElement, onChange: (v: number) => void): void {
	addListener(input, "input", () => onChange(readNumber(input)));
}
function bindCheckbox(input: HTMLInputElement, onChange: (v: boolean) => void): void {
	addListener(input, "change", () => onChange(input.checked));
}

/* ---------------------------
   Wire listeners (logic preserved)
   --------------------------- */
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

	addListener(ui.actions.save, "click", () => {
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
		}).then(() => {
			notify('Settings saved successfully.', { type: "success" });
		}).catch((error) => {
			notify(`Error saving settings: ${error.message}`, { type: "error" });
		});
	});
}

function initLobbySettings(initial?: Partial<settings>): void {
	currentSettings = structuredClone(defaultSettings);
	if (initial) setPartialLobbyConfig(initial);
	populateUi();
	wire();
}

/* ---------------------------
   Auto-init
   --------------------------- */
initLobbySettings();


/* -------------------------------------------------------------------------- */
/* UI – Modes                                                                 */
/* -------------------------------------------------------------------------- */
type Mode = {
	button: HTMLButtonElement;
	tab: HTMLDivElement;
};

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

function setupModeHandlers(): void {
	let readyCheck = false;
	const lobbyActionButtons = getElQS<HTMLDivElement>("#lobby-action-buttons");
	const joinBtn = getEl<HTMLButtonElement>("lobby-btn-join");
	const leaveBtn = getEl<HTMLButtonElement>("lobby-btn-leave");
	const launchBtn = getEl<HTMLButtonElement>("lobby-btn-launch");
	const userConnected = getElQS<HTMLDivElement>("#lobby-select-mode div:first-child");
	const lobbyJoin = getElQS<HTMLDivElement>("#lobby-join-box");

	fetch("/api/users/me")
		.then(res => {
			if (res.ok) {
				lobbyActionButtons.classList.remove("unloaded");
				userConnected.classList.remove("unclickable");
				lobbyJoin.classList.remove("unclickable");
			} else {
				userConnected.classList.add("unclickable");
				lobbyJoin.classList.add("unclickable");
			}
		})
		.catch(() => {
			userConnected.classList.add("unclickable");
			lobbyJoin.classList.add("unclickable");
		});

	["lobby-online", "lobby-offline"].forEach((selected) => {
		const selectMode = getEl<HTMLButtonElement>(selected);
		addListener(selectMode, "click", () => {
			readyCheck = true;

			if (selected === "lobby-offline") {
				lobbyActionButtons.classList.remove("unloaded");
				joinBtn.classList.add("unloaded");
				leaveBtn.classList.add("unloaded");
				launchBtn.classList.remove("unloaded");
				lobbyJoin.classList.add("unloaded");
			} else if (selected === "lobby-online") {
				joinBtn.classList.remove("unloaded");
				leaveBtn.classList.remove("unloaded");
				launchBtn.classList.add("unloaded");
			}

			const lobbySelectMode = getEl<HTMLDivElement>("lobby-select-mode");
			lobbySelectMode.classList.remove("current-mode");
			lobbySelectMode.classList.add("unloaded");

			const lobbyButton = getEl<HTMLButtonElement>("lobby-custom-game-button");
			lobbyButton.classList.add("current-mode");

			const lobbySettingBox = getElQS<HTMLDivElement>(".lobby-setting-box");
			lobbySettingBox.classList.add("current-mode");
			lobbySettingBox.classList.remove("unloaded");

			if (readyCheck) {
				Object.values(modes).forEach((mode) => {
					addListener(mode.button, "click", () => {
						Object.values(modes).forEach((m) => {
							m.button.classList.toggle("current-mode", m === mode);
							m.tab.classList.toggle("unloaded", m !== mode);
						});
					});
				});
			}
		});
	});
}




/* -------------------------------------------------------------------------- */
/* UI – Sub tabs                                                              */
/* -------------------------------------------------------------------------- */
type SubTabs = {
	basicBtn: HTMLButtonElement;
	advBtn: HTMLButtonElement;
	basicTab: HTMLDivElement;
	advTab: HTMLDivElement;
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

setupModeHandlers();
setupSubTabs();

window.setPartialLobbyConfig = setPartialLobbyConfig;