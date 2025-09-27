export {};

const form = document.getElementById("registerForm") as HTMLFormElement | null;
const usernameInput = document.querySelector<HTMLInputElement>('input[name="username"]');
const errorSpan = document.getElementById("usernameError") as HTMLSpanElement | null;

if (!form || !usernameInput || !errorSpan) {
	console.warn("usernameValidator: missing form, input or error span");
} else {
	// Capture non-null local references so TypeScript knows they cannot be null
	const usernameEl: HTMLInputElement = usernameInput;
	const errorEl: HTMLSpanElement = errorSpan;

	// Regex: only lowercase letters a-z, A-Z, digits 0-9 and underscore, 3..20 chars
	const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;

	/**
	 * Validate current username value and display a message if invalid.
	 * Return true when valid.
	 */
	function validateUsername(): boolean {
		const value = usernameEl.value.trim();
		const allowed = "Allowed: a–z, A–Z, 0–9, _ (3–20 chars)";

		// Empty username
		if (value.length === 0) {
			errorEl.textContent = "Username cannot be empty. " + allowed;
			errorEl.className = "text-red-600";
			return false;
		}

		// Invalid characters / length
		if (!usernameRegex.test(value)) {
			errorEl.textContent = "Invalid username. " + allowed;
			errorEl.className = "text-red-600";
			return false;
		}

		// Valid username -> clear message (or show success)
		errorEl.textContent = "";
		return true;
	}

	// Live validation while typing
	usernameEl.addEventListener("input", () => {
		validateUsername();
	});

	// Prevent submit if invalid
	form.addEventListener("submit", (e) => {
		if (!validateUsername()) {
			e.preventDefault();
			usernameEl.focus();
		}
	});
}
