export {};

declare function addListener(target: EventTarget | null, event: string, handler: EventListenerOrEventListenerObject): void;
declare function translatePage(language: string): void;
declare function translateElement(language: string, element: HTMLElement): void;
declare function getUserLang(): string;
declare function loadPage(url: string): void;
declare function updateNavBar(userData: any): void;
declare function getTranslatedTextByKey(language: string, key: string): Promise<string | null>;

const loginForm = document.querySelector<HTMLFormElement>('.auth-form-container');
const usernameInput = document.getElementById('username-text-input') as HTMLInputElement | null;
const passwordInput = document.getElementById('password-text-input') as HTMLInputElement | null;

/** Shows the error message for a given element
 * @param element the element whose error message is to be shown
 * @param message the message to be shown
 */
function showErrorMessage(element: HTMLSpanElement, message: string): void {
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

function refreshNavBarState() {
	const user = fetch("/api/users/me")
				.then(res => res.ok ? res.json() : null)
				.then(data => {
					updateNavBar(data);
				})
				.catch(err => {
					console.error("Error fetching user data:", err);
					updateNavBar(null);
				});
}

/** Handles the login form submission
 * @param event the submit event
 */
async function handleLogin(event: Event): Promise<void> {
	event.preventDefault();
	const isUsernameValid = await verifyUsernameMailValidity();
	const isPasswordValid = await verifyPasswordValidity();
	const checkboxElement: HTMLInputElement | null = document.getElementById('remember-me-checkbox') as HTMLInputElement | null;
	const inputElement: HTMLInputElement | null = document.getElementById('username-text-input') as HTMLInputElement | null;
	let errorTextElement: HTMLSpanElement | null = document.getElementById('login-form-error-text');
	console.log('Error element:', errorTextElement);
	event.stopImmediatePropagation();
	if (isUsernameValid && isPasswordValid) {
		if (inputElement?.value.includes('@'))
			inputElement.name = 'email';
		else
			inputElement!.name = 'username';

		fetch('/api/users/accounts/login', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'accept-language': getUserLang()
			},
			body: JSON.stringify({
				[inputElement!.name]: inputElement!.value,
				password: passwordInput?.value,
				rememberMe: checkboxElement?.checked || false
			})
		})
		.then(async res => {
			const data = await res.json();
			if (res.ok)
			{
				if (data.message === '2FA required.')
					loadPage('/twofa');
				else {
					refreshNavBarState();
					loadPage('/home');
				}
			}
			else
				throw new Error(data.message || `HTTP ${res.status}`);
		})
		.catch(async err => {
			console.error('Login error:', err);
			if (!errorTextElement) {
				errorTextElement = document.createElement('span');
				errorTextElement.id = 'login-form-error-text';
				errorTextElement.classList.add('error-message');
				loginForm?.appendChild(errorTextElement);
			}
			const base = await getTranslatedTextByKey(getUserLang(), 'login.error.loginFailed');
			const details = err && err.message ? ` (${err.message})` : '.';
			showErrorMessage(errorTextElement, (base ?? 'Login failed. Please try again later') + details);

		});
	} else {
		const txt = await getTranslatedTextByKey(getUserLang(), 'login.error.invalidForm');
		showErrorMessage(errorTextElement!, txt ?? 'Invalid form input. Please correct the errors and try again.');
	}
}

/** Verifies the validity of the username or email input
 * @returns true if the username or email is valid, false otherwise
 */
async function verifyUsernameMailValidity(): Promise<boolean> {
	const usernameRegex: RegExp = /^[a-zA-Z0-9_]{3,20}$/;
	const emailRegex:	RegExp = /^[\p{L}\p{N}._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,}$/u;
	const username = usernameInput?.value ?? '';
	let errorTextElement = document.getElementById('login-username-error-text');
	const isEmail = emailRegex.test(username);

	if (!errorTextElement) {
		errorTextElement = document.createElement('span');
		errorTextElement.id = 'login-username-error-text';
		errorTextElement.classList.add('error-message');
		usernameInput?.parentElement?.appendChild(errorTextElement);
	}

	if (!isEmail && !usernameRegex.test(username)) {
		const txt = await getTranslatedTextByKey(getUserLang(), 'login.error.usernameRequirements');
		showErrorMessage(errorTextElement, txt ?? 'Username must be 3-20 characters long and can only contain letters, numbers, and underscores.');
	} else if (isEmail && !emailRegex.test(username)) {
		const txt = await getTranslatedTextByKey(getUserLang(), 'login.error.invalidEmail');
		showErrorMessage(errorTextElement, txt ?? 'Please enter a valid email address.');
	} else {
		hideErrorMessage(errorTextElement);
		return (true);
	}
	return (false);
}

/** Verifies the validity of the password input
 * @returns true if the password is valid, false otherwise
 */
async function verifyPasswordValidity(): Promise<boolean> {
	const passwordRegex: RegExp = /^.{8,64}$/;
	const password: string = passwordInput?.value ?? '';
	let errorTextElement: HTMLSpanElement | null = document.getElementById('login-password-error-text');

	if (!errorTextElement) {
		errorTextElement = document.createElement('span');
		errorTextElement.id = 'login-password-error-text';
		errorTextElement.classList.add('error-message');
		passwordInput?.parentElement?.appendChild(errorTextElement);
	}

	if (!passwordRegex.test(password)) {
		const txt = await getTranslatedTextByKey(getUserLang(), 'login.error.passwordRequirements');
		showErrorMessage(errorTextElement, txt ?? 'Password must be between 8 and 64 characters long.');
		return (false);
	} else {
		hideErrorMessage(errorTextElement);
		return (true);
	}
}


// ================================================
// 				OAuth popup handling
// ================================================

const oauthPopups = new Map();

window.addEventListener("message", (e) => {
	if (e.origin !== window.location.origin) return;
	if (!e.data || !e.data.requestId) return;

	// Get the popup and close it
	const popup = oauthPopups.get(e.data.requestId);
	if (popup && !popup.closed) popup.close();
	oauthPopups.delete(e.data.requestId);

	if (e.data.isTwofa === "true")
		loadPage('/twofa');
	else {
		refreshNavBarState();
		loadPage('/home');
	}
});

const oauthButtons = document.querySelectorAll<HTMLLinkElement>(".oauth-button");

oauthButtons.forEach((button) => {
	button.addEventListener("click", (e) => {
		e.preventDefault();

		const requestId = crypto.randomUUID();
		const url = `${button.href}?requestId=${requestId}`;

		const popup = window.open(
			url,
			"oauth_window_" + requestId,
			"width=500,height=600,resizable=yes,scrollbars=yes"
		);

		oauthPopups.set(requestId, popup);

		setTimeout(() => {
			if (popup && !popup.closed) popup.close();
			oauthPopups.delete(requestId);
		}, 120000);
	});
});



addListener(loginForm, 'submit', handleLogin);
addListener(usernameInput, 'input', verifyUsernameMailValidity);
addListener(passwordInput, 'input', verifyPasswordValidity);
