export {};

declare function addListener(target: EventTarget | null, event: string, handler: EventListenerOrEventListenerObject): void;

const loginForm = document.querySelector<HTMLFormElement>('.auth-form-container');
const usernameInput = document.getElementById('username-text-input') as HTMLInputElement | null;
const passwordInput = document.getElementById('password-text-input') as HTMLInputElement | null;

function handleLogin(event: Event): void {
	event.preventDefault();
	const isUsernameValid = verifyUsernameValidity();
	const isPasswordValid = verifyPasswordValidity();

	if (isUsernameValid && isPasswordValid) {
		console.log('Form is valid. Submitting...');
	} else {
		console.log('Form is invalid. Please correct the errors and try again.');
	}
}

function verifyUsernameValidity(): boolean {
	const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
	const username = usernameInput?.value ?? '';
	const errorTextElement = document.getElementById('login-username-error-text');

	if (!errorTextElement) return (false);

	if (!usernameRegex.test(username)) {
		errorTextElement.textContent =
			'Username must be 3-20 characters long and can only contain letters, numbers, and underscores.';
		errorTextElement.classList.remove('hidden');
		errorTextElement.setAttribute('aria-hidden', 'false');

		return (false);
	} else {
		errorTextElement.textContent = '';
		errorTextElement.classList.add('hidden');
		errorTextElement.setAttribute('aria-hidden', 'true');
		return (true);
	}
}

function verifyPasswordValidity(): boolean {
	const passwordRegex: RegExp = /^.{8,64}$/;
	const password: string = passwordInput?.value ?? '';
	const errorTextElement: HTMLElement | null = document.getElementById('login-password-error-text');

	if (!errorTextElement) return false;

	if (!passwordRegex.test(password)) {
		errorTextElement.textContent = 'Password must be between 8 and 64 characters long.';
		errorTextElement.classList.remove('hidden');
		errorTextElement.setAttribute('aria-hidden', 'false');
		(errorTextElement as HTMLElement).hidden = false;

		return (false);
	} else {
		errorTextElement.textContent = '';
		errorTextElement.classList.add('hidden');
		errorTextElement.setAttribute('aria-hidden', 'true');
		(errorTextElement as HTMLElement).hidden = true;

		return (true);
	}
}

addListener(loginForm, 'submit', handleLogin);
addListener(usernameInput, 'input', verifyUsernameValidity);
addListener(passwordInput, 'input', verifyPasswordValidity);
