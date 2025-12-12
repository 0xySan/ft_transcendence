export {};

declare function addListener(target: EventTarget | null, event: string, handler: EventListenerOrEventListenerObject): void;
declare function getUserLang(): string;
declare function loadPage(url: string): void;


const registerForm = document.querySelector<HTMLFormElement>('.auth-form-container');
const usernameInput = document.getElementById('username-text-input') as HTMLInputElement | null;
const displayNameInput = document.getElementById('displayName-text-input') as HTMLInputElement | null;
const emailInput = document.getElementById('email-text-input') as HTMLInputElement | null;
const passwordInput = document.getElementById('password-text-input') as HTMLInputElement | null;
const confirmPasswordInput = document.getElementById('confirm-password-text-input') as HTMLInputElement | null;

const params = new URLSearchParams(window.location.search);
const preFill = {
	email: params.get('email') || '',
	username: params.get('name') || '',
	displayName: params.get('displayName') || '',
	provider: params.get('provider') || '',
	providerId: params.get('providerId') || '',
	picture: params.get('picture') || ''
}


/** Shows the error message for a given element
 * @param element the element whose error message is to be shown
 * @param message the message to be shown
 */
function showErrorMessage(element: HTMLSpanElement, message: string): void {
	console.log('Showing error message:', message);
	element.textContent = message;
	element.classList.remove('hidden');
	element.setAttribute('aria-hidden', 'false');
}

/** Hides the error message for a given element
 * @param element the element whose error message is to be hidden
 */
function hideErrorMessage(element: HTMLSpanElement): void {
	element.textContent = '';
	element.classList.add('hidden');
	element.setAttribute('aria-hidden', 'true');
}

/** Handles the register form submission
 * @param event the submit event
 */
function handleRegister(event: Event): void {
	event.preventDefault();
	const isUsernameValid = verifyUsernameValidity();
	const isEmailValid = verifyEmailValidity();
	const isPasswordValid = verifyPasswordValidity();
	const isConfirmPasswordValid = verifyConfirmPasswordValidity();
	let errorTextElement: HTMLSpanElement | null = document.getElementById('register-form-error-text');

	if (isUsernameValid && isEmailValid && isPasswordValid && isConfirmPasswordValid) {
		fetch('/api/users/accounts/register', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'accept-language': getUserLang()
			},
			body: JSON.stringify({
				username: usernameInput!.value,
				email: emailInput?.value,
				password: passwordInput?.value,
			})
		})
		.then(async res => {
			const data = await res.json();
			if (res.ok) {
				localStorage.setItem('userEmailForVerification', emailInput?.value || '');
				loadPage('/mail-verification');
			} else
				throw new Error(data.message || `HTTP ${res.status}`);
		})
		.catch(err => {
			console.error('Register error:', err);
			if (!errorTextElement) {
				errorTextElement = document.createElement('span');
				errorTextElement.id = 'register-form-error-text';
				errorTextElement.classList.add('error-message');
				registerForm?.appendChild(errorTextElement);
			}
			showErrorMessage(errorTextElement!, 'Register failed. Please try again later.');
		});
	} else
		showErrorMessage(errorTextElement!, 'Form is invalid. Please correct the errors and try again.');
}

/** Verifies the validity of the username input
 * @returns true if the username is valid, false otherwise
 */
function verifyUsernameValidity(): boolean {
	const usernameRegex: RegExp = /^[a-zA-Z0-9_]{3,20}$/;
	const username: string = usernameInput?.value ?? '';
	let errorTextElement: HTMLElement | null = document.getElementById('register-username-error-text');

	if (!errorTextElement) {
		errorTextElement = document.createElement('span');
		errorTextElement.id = 'login-username-error-text';
		errorTextElement.classList.add('error-message');
		usernameInput?.parentElement?.appendChild(errorTextElement);
	}

	if (!usernameRegex.test(username)) {
		showErrorMessage(errorTextElement as HTMLSpanElement, 'Username must be 3-20 characters long and can only contain letters, numbers, and underscores.');
	} else {
		hideErrorMessage(errorTextElement as HTMLSpanElement);
		return (true);
	}
	return (false);
}

/** Verifies the validity of the email input
 * @returns true if the email is valid, false otherwise
 */
function verifyEmailValidity(): boolean {
	const emailRegex: RegExp = /^[\p{L}\p{N}._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,}$/u;
	const email: string = emailInput?.value ?? '';
	let errorTextElement: HTMLElement | null = document.getElementById('register-email-error-text');

	if (!errorTextElement) {
		errorTextElement = document.createElement('span');
		errorTextElement.id = 'register-email-error-text';
		errorTextElement.classList.add('error-message');
		emailInput?.parentElement?.appendChild(errorTextElement);
	}

	if (!emailRegex.test(email)) {
		showErrorMessage(errorTextElement as HTMLSpanElement, 'Please enter a valid email address.');
		return (false);
	} else {
		hideErrorMessage(errorTextElement as HTMLSpanElement);
		return (true);
	}
}

/** Verifies the validity of the password input
 * @returns true if the password is valid, false otherwise
 */
function verifyPasswordValidity(): boolean {
	const passwordRegex: RegExp = /^.{8,64}$/;
	const password: string = passwordInput?.value ?? '';
	let errorTextElement: HTMLElement | null = document.getElementById('register-password-error-text');

	if (!errorTextElement){
		errorTextElement = document.createElement('span');
		errorTextElement.id = 'register-password-error-text';
		errorTextElement.classList.add('error-message');
		passwordInput?.parentElement?.appendChild(errorTextElement);
	}

	if (!passwordRegex.test(password)) {
		showErrorMessage(errorTextElement as HTMLSpanElement, 'Password must be between 8 and 64 characters long.');
		return (false);
	} else {
		hideErrorMessage(errorTextElement as HTMLSpanElement);
		return (true);
	}
}

/** Verifies the validity of the confirm password input
 * @returns true if the confirm password matches the password, false otherwise
 */
function verifyConfirmPasswordValidity(): boolean {
	const password: string = passwordInput?.value ?? '';
	const confirmPassword: string = confirmPasswordInput?.value ?? '';
	let errorTextElement: HTMLElement | null = document.getElementById('register-confirm-password-error-text');

	if (!errorTextElement) {
		errorTextElement = document.createElement('span');
		errorTextElement.id = 'register-confirm-password-error-text';
		errorTextElement.classList.add('error-message');
		confirmPasswordInput?.parentElement?.appendChild(errorTextElement);
	}

	if (password !== confirmPassword)
		showErrorMessage(errorTextElement as HTMLSpanElement, 'Passwords do not match.');
	else {
		hideErrorMessage(errorTextElement as HTMLSpanElement);
		return (true);
	}
	return (false);
}

addListener(window, 'load', () => {
	if (emailInput && preFill.email)
		emailInput.value = preFill.email;
	if (usernameInput && preFill.username)
		usernameInput.value = preFill.username;
	if (displayNameInput && preFill.displayName)
		displayNameInput.value = preFill.displayName;
});

addListener(registerForm, 'submit', handleRegister);
addListener(usernameInput, 'input', verifyUsernameValidity);
addListener(emailInput, 'input', verifyEmailValidity);
addListener(passwordInput, 'input', verifyPasswordValidity);
addListener(confirmPasswordInput, 'input', verifyConfirmPasswordValidity);
