export {};

declare function addListener(target: EventTarget | null, event: string, handler: EventListenerOrEventListenerObject): void;
declare function translatePage(language: string): void;
declare function translateElement(language: string, element: HTMLElement): void;
declare function getUserLang(): string;

const emailInput = document.getElementById('email-text-input') as HTMLInputElement | null;
const resetButton = document.querySelector<HTMLButtonElement>('button[type="submit"]');

function handleForgotPassword(event: Event): void {
	event.preventDefault();
	const isEmailValid = verifyEmailValidity();

	if (isEmailValid) {
		console.log('Form is valid. Submitting...');
		// forgotPasswordForm?.submit();
		// or: forgotPasswordForm?.requestSubmit?.();
	} else {
		console.log('Form is invalid. Please correct the errors and try again.');
	}
}

function verifyEmailValidity(): boolean {
	const emailRegex: RegExp = /^[\p{L}\p{N}._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,}$/u;
	const email: string = emailInput?.value ?? '';
	const errorTextElement: HTMLElement | null = document.getElementById('forgot-password-email-error-text');

	if (!errorTextElement) return (false);

	if (!emailRegex.test(email)) {
		errorTextElement.textContent = 'Please enter a valid email address.';
		errorTextElement.setAttribute('aria-hidden', 'false');
		errorTextElement.style.opacity = '1';
		console.log('Invalid email:', email);
		return (false);
	} else {
		errorTextElement.textContent = '';
		errorTextElement.setAttribute('aria-hidden', 'true');
		errorTextElement.style.opacity = '0';
		return (true);
	}
}

addListener(resetButton, 'click', handleForgotPassword);
addListener(emailInput, 'input', verifyEmailValidity);

translatePage(getUserLang());