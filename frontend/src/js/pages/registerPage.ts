export {};

declare function addListener(target: EventTarget | null, event: string, handler: EventListenerOrEventListenerObject): void;

const registerForm = document.querySelector<HTMLFormElement>('.auth-form-container');
const usernameInput = document.getElementById('username-text-input') as HTMLInputElement | null;
const emailInput = document.getElementById('email-text-input') as HTMLInputElement | null;
const passwordInput = document.getElementById('password-text-input') as HTMLInputElement | null;
const confirmPasswordInput = document.getElementById('confirm-password-text-input') as HTMLInputElement | null;
const registerButton = document.querySelector<HTMLButtonElement>('button[type="submit"]');

function handleRegister(event: Event): void {
  event.preventDefault();
  const isUsernameValid = verifyUsernameValidity();
  const isEmailValid = verifyEmailValidity();
  const isPasswordValid = verifyPasswordValidity();
  const isConfirmPasswordValid = verifyConfirmPasswordValidity();

  if (isUsernameValid && isEmailValid && isPasswordValid && isConfirmPasswordValid) {
    console.log('Form is valid. Submitting...');
    // registerForm?.submit();
    // or: registerForm?.requestSubmit?.();
  } else {
    console.log('Form is invalid. Please correct the errors and try again.');
  }
}

function verifyUsernameValidity(): boolean {
  const usernameRegex: RegExp = /^[a-zA-Z0-9_]{3,20}$/;
  const username: string = usernameInput?.value ?? '';
  const errorTextElement: HTMLElement | null = document.getElementById('register-username-error-text');

  if (!errorTextElement) return false;

  if (!usernameRegex.test(username)) {
    errorTextElement.textContent =
      'Username must be 3-20 characters long and can only contain letters, numbers, and underscores.';
    errorTextElement.classList.remove('hidden');
    errorTextElement.setAttribute('aria-hidden', 'false');
    console.log('Invalid username:', username);
    return false;
  } else {
    errorTextElement.textContent = '';
    errorTextElement.classList.add('hidden');
    errorTextElement.setAttribute('aria-hidden', 'true');
    return true;
  }
}

function verifyEmailValidity(): boolean {
  const emailRegex: RegExp = /^[\p{L}\p{N}._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,}$/u;
  const email: string = emailInput?.value ?? '';
  const errorTextElement: HTMLElement | null = document.getElementById('register-email-error-text');

  if (!errorTextElement) return false;

  if (!emailRegex.test(email)) {
    errorTextElement.textContent = 'Please enter a valid email address.';
    errorTextElement.classList.remove('hidden');
    errorTextElement.setAttribute('aria-hidden', 'false');
    console.log('Invalid email:', email);
    return false;
  } else {
    errorTextElement.textContent = '';
    errorTextElement.classList.add('hidden');
    errorTextElement.setAttribute('aria-hidden', 'true');
    return true;
  }
}

function verifyPasswordValidity(): boolean {
  const passwordRegex: RegExp = /^.{8,64}$/;
  const password: string = passwordInput?.value ?? '';
  const errorTextElement: HTMLElement | null = document.getElementById('register-password-error-text');

  if (!errorTextElement) return false;

  if (!passwordRegex.test(password)) {
    errorTextElement.textContent = 'Password must be between 8 and 64 characters long.';
    errorTextElement.classList.remove('hidden');
    errorTextElement.setAttribute('aria-hidden', 'false');
    console.log('Invalid password length:', password.length);
    return false;
  } else {
    errorTextElement.textContent = '';
    errorTextElement.classList.add('hidden');
    errorTextElement.setAttribute('aria-hidden', 'true');
    return true;
  }
}

function verifyConfirmPasswordValidity(): boolean {
  const password: string = passwordInput?.value ?? '';
  const confirmPassword: string = confirmPasswordInput?.value ?? '';
  const errorTextElement: HTMLElement | null = document.getElementById('register-confirm-password-error-text');

  if (!errorTextElement) return false;

  if (password !== confirmPassword) {
    errorTextElement.textContent = 'Passwords do not match.';
    errorTextElement.classList.remove('hidden');
    errorTextElement.setAttribute('aria-hidden', 'false');
    (errorTextElement as HTMLElement).hidden = false;
    console.log('Passwords do not match.');
    return false;
  } else {
    errorTextElement.textContent = '';
    errorTextElement.classList.add('hidden');
    errorTextElement.setAttribute('aria-hidden', 'true');
    return true;
  }
}

addListener(registerForm, 'submit', handleRegister);
addListener(usernameInput, 'input', verifyUsernameValidity);
addListener(emailInput, 'input', verifyEmailValidity);
addListener(passwordInput, 'input', verifyPasswordValidity);
addListener(confirmPasswordInput, 'input', verifyConfirmPasswordValidity);