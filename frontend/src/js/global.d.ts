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
