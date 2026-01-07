export {};

declare function addListener(
	target: EventTarget,
	event: string,
	handler: EventListenerOrEventListenerObject
): void;

declare function translateElement(language: string, element: HTMLElement): void;
declare function getUserLang(): string;

/* ---------------------------------- */
/* Constants */
/* ---------------------------------- */

const VERIFY_TOTP_ENDPOINT = '/api/users/twofa/totp/token';
const VERIFY_EMAIL_ENDPOINT = '/api/users/twofa/email';
const VERIFY_BACKUP_ENDPOINT = '/api/users/twofa/backup-codes';
const SEND_EMAIL_ENDPOINT = '/api/users/twofa/email/send';

/* ---------------------------------- */
/* Elements */
/* ---------------------------------- */

const select = document.getElementById('method-select') as HTMLSelectElement;
const resendBtn = document.getElementById('resend-otp-btn') as HTMLButtonElement;
const cancelBtn = document.getElementById('twoFA-cancel-btn') as HTMLButtonElement;

/* ---------------------------------- */
/* State */
/* ---------------------------------- */

let methods: any[] = [];
let primary: any | null = null;
let resendCooldownTimer: number | null = null;

/* ---------------------------------- */
/* Helpers */
/* ---------------------------------- */

function sendSuccess(token: string) {
	if (window.opener && !window.opener.closed) {
		window.opener.postMessage({ type: 'TWOFA_SUCCESS', token }, window.location.origin);
		window.close();
	}
}

function sendCancel() {
	if (window.opener && !window.opener.closed) {
		window.opener.postMessage({ type: 'TWOFA_CANCEL' }, window.location.origin);
		window.close();
	}
}

/* ---------------------------------- */
/* Input Handling */
/* ---------------------------------- */

function tryVerifyIfFilled(inputs: HTMLInputElement[]) {
	if (inputs.every(i => i.value.length === 1)) {
		verifyTwoFa(inputs.map(i => i.value).join(''));
	}
}

function setupInputs() {
	const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('.otp-input'));

	inputs.forEach((input, index) => {
		addListener(input, 'input', () => {
			input.value = input.value.replace(/[^0-9A-Za-z]/g, '').slice(0, 1);
			if (input.value && inputs[index + 1]) inputs[index + 1].focus();
			tryVerifyIfFilled(inputs);
		});

		addListener(input, 'keydown', (e) => {
			if ((e as KeyboardEvent).key === 'Backspace' && !input.value && inputs[index - 1]) {
				inputs[index - 1].focus();
			}
		});

		addListener(input, 'paste', (e) => {
			e.preventDefault();
			const paste = (e as ClipboardEvent).clipboardData?.getData('text') ?? '';
			paste.slice(0, inputs.length).split('').forEach((c, i) => {
				if (inputs[i]) inputs[i].value = c;
			});
			tryVerifyIfFilled(inputs);
		});
	});
}

/* ---------------------------------- */
/* Verification */
/* ---------------------------------- */

async function verifyTwoFa(code: string): Promise<void> {
	let res: Response;

	switch (primary?.method_type) {
		case 0:
			res = await fetch(VERIFY_EMAIL_ENDPOINT, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json', 'accept-language': getUserLang() },
				body: JSON.stringify({ uuid: primary.id, code })
			});
			break;

		case 1:
			res = await fetch(VERIFY_TOTP_ENDPOINT, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json', 'accept-language': getUserLang() },
				body: JSON.stringify({ twofa_uuid: primary.id, totp_code: code })
			});
			break;

		case 2:
			res = await fetch(VERIFY_BACKUP_ENDPOINT, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json', 'accept-language': getUserLang() },
				body: JSON.stringify({ uuid: primary.id, code })
			});
			break;

		default:
			return;
	}

	if (!res.ok) {
		alert('Invalid code');
		return;
	}

	const data = await res.json().catch(() => null);
	if (!data?.token) {
		alert('No token returned');
		return;
	}

	sendSuccess(data.token);
}

/* ---------------------------------- */
/* Resend Email */
/* ---------------------------------- */

function setupResendButton() {
	if (!resendBtn) return;

	addListener(resendBtn, 'click', async () => {
		await fetch(SEND_EMAIL_ENDPOINT, {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ uuid: primary.id })
		});

		let remaining = 60;
		resendBtn.disabled = true;
		resendBtn.textContent = `(${remaining}s)`;

		resendCooldownTimer = window.setInterval(() => {
			remaining--;
			resendBtn.textContent = `(${remaining}s)`;
			if (remaining <= 0) {
				clearInterval(resendCooldownTimer!);
				resendBtn.disabled = false;
			}
		}, 1000);
	});
}

/* ---------------------------------- */
/* Init */
/* ---------------------------------- */

async function init() {
	const res = await fetch('/api/users/twofa/', { credentials: 'include' });
	const data = await res.json();

	methods = (data.twoFaMethods ?? []).filter((m: any) => m.is_verified);
	primary = methods.find((m: any) => m.is_primary);

	methods.forEach((m, i) => {
		const opt = document.createElement('option');
		opt.value = i.toString();
		opt.textContent = m.label;
		select.appendChild(opt);
	});

	select.value = methods.indexOf(primary).toString();

	addListener(select, 'change', () => {
		primary = methods?.[parseInt(select.value, 10)];
	});

	if (primary.method_type === 0) resendBtn.classList.remove('hidden');

	setupInputs();
	setupResendButton();
}

addListener(cancelBtn, 'click', sendCancel);
init();
