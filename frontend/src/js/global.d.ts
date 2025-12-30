export {};

declare global {
	type NotificationType =
		| "info"
		| "success"
		| "warning"
		| "error";

	type NotifOptions = {
		type?: NotificationType;
		duration?: number;
	};

	interface Window {
		notify: (message: string, options?: NotifOptions) => void;
	}

	function notify(
		message: string,
		options?: NotifOptions
	): void;
}


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

export interface Settings {
	game: GameSettings;
	scoring: ScoringSettings;
	ball: BallSettings;
	paddles: PaddleSettings;
	field: FieldSettings;
	world: WorldSettings;
}