export {};

declare function addListener(target: EventTarget, event: string, handler: EventListenerOrEventListenerObject): void;
declare function translatePage(language: string): void;
declare function translateElement(language: string, element: HTMLElement): void;
declare function getUserLang(): string;
declare function loadPage(url: string): void;
declare function updateNavBar(userData: any): void;

const VERIFY_ENDPOINT = '/api/users/twofa/totp/token';
const LOGIN_ENDPOINT = '/api/users/accounts/login';

let primary = null as any | null; // will hold primary TOTP method details

function inputEventOnInput(input: HTMLInputElement, index: number, inputs: HTMLInputElement[]): void {
	addListener(input, 'input', (e) => {
		const target = e.target as HTMLInputElement;
		const value = target.value;

		// Only keep one numeric character
		target.value = value.replace(/[^0-9]/g, '').slice(0, 1);

		// Move to next input if filled
		if (target.value && index < inputs.length - 1) {
			inputs[index + 1].focus();
		}

		// If all are filled, you can trigger verification here
		if (inputs.every((i) => i.value.length === 1)) {
			const code = inputs.map((i) => i.value).join('');
			console.log('2FA code:', code);
		}
	});
}

function backspaceEventOnInput(input: HTMLInputElement, index: number, inputs: HTMLInputElement[]): void {
	addListener(input, 'keydown', (e) => {
		const event = e as KeyboardEvent;
		// Move backward on Backspace if empty
		if (event.key === 'Backspace' && !input.value && index > 0) {
			inputs[index - 1].focus();
		}
	});
}

function pasteEventOnInput(input: HTMLInputElement, index: number, inputs: HTMLInputElement[]): void {
	addListener(input, 'paste', (e) => {
		const event = e as ClipboardEvent;
		e.preventDefault();
		const paste = event.clipboardData?.getData('text') ?? '';
			
		// Check if paste contains only numbers
		const onlyNumbers = /^\d+$/.test(paste);
		if (!onlyNumbers) return;

		// Limit to number of inputs
		const digits = paste.slice(0, inputs.length);
		if (!digits.length) return;

		digits.split('').forEach((char, i) => {
			if (inputs[i]) inputs[i].value = char;
		});

		// Focus last filled or next empty input
		const nextIndex = Math.min(digits.length, inputs.length - 1);
		inputs[nextIndex].focus();

		if (digits.length === inputs.length) {
			console.log('2FA code:', digits);
		}
	});
}

function enterKeyEventOnInput(input: HTMLInputElement, index: number, inputs: HTMLInputElement[]): void {
	addListener(input, 'keydown', (e) => {
	  const ev = e as KeyboardEvent;
	  if (ev.key === 'Enter') {
		// assemble and submit immediately
		const code = inputs.map(i => i.value).join('');
		if (code.length === inputs.length) verifyTwoFa(code);
	  }
	})
}

async function patchUserToken(totpToken: string): Promise<void> {
	// disable UI feedback (find inputs)
	const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('.otp-input'));
	inputs.forEach(i => i.disabled = true);

	try {
		const res = await fetch(LOGIN_ENDPOINT, {
			method: 'PATCH',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json',
				'accept-language': getUserLang()
			},
			body: JSON.stringify({
				token: totpToken
			})
		});

		if (res.ok) {
		  console.log('TOTP token patched successfully');
		  loadPage('/home');
		  return;
		}

		// handle known error statuses
		if (res.status === 401 || res.status === 400) {
		  const err = await res.json().catch(() => ({ message: 'Invalid code' }));
		  console.error('Verification error:', err);
		  // show error UI: simple alert for now, replace with nicer UI later
		  alert(err.message || 'Invalid 2FA code');
		  // clear inputs and re-focus first
		  inputs.forEach(i => i.value = '');
		  if (inputs[0]) inputs[0].focus();
		  return;
		}

		// fallback
		console.error('Verification failed, status', res.status);
		alert('Verification failed. Try again later.');
	} catch (e) {
		console.error('Network error during verification', e);
		alert('Network error. Try again.');
	} finally {
		// re-enable inputs
		const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('.otp-input'));
		inputs.forEach(i => i.disabled = false);
  	}
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

async function verifyTwoFa(code: string): Promise<void> {
  // disable UI feedback (find inputs)
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('.otp-input'));
  inputs.forEach(i => i.disabled = true);

  try {
    const res = await fetch(VERIFY_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'accept-language': getUserLang()
      },
      body: JSON.stringify({
        twofa_uuid: primary ? primary.id : null,
        totp_code: code
      })
    });

    // If response is OK, read the token from body
    if (res.ok) {
      let data: any = {};
      try {
        data = await res.json();     // <-- extract token here
      } catch (_) {
        console.warn('No JSON body returned from 2FA verify');
      }

      const token = data.token ?? null; // adjust field name if needed
      patchUserToken(token);
	  refreshNavBarState();
      console.log('2FA verified');
      loadPage('/home');
      return;
    }

    // handle known error statuses
    if (res.status === 401 || res.status === 400) {
      const err = await res.json().catch(() => ({ message: 'Invalid code' }));
      console.error('Verification error:', err);

      alert(err.message || 'Invalid 2FA code');

      // clear inputs and focus first
      inputs.forEach(i => i.value = '');
      if (inputs[0]) inputs[0].focus();
      return;
    }

    // fallback
    console.error('Verification failed, status', res.status);
    alert('Verification failed. Try again later.');
  } catch (e) {
    console.error('Network error during verification', e);
    alert('Network error. Try again.');
  } finally {
    // re-enable inputs
    inputs.forEach(i => i.disabled = false);
  }
}


function prepareInputs() {
	const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('.otp-input'));

  console.log(inputs);

  // Fetch user's registered 2FA methods (ensure cookie sent)
  fetch('/api/users/twofa/', {
	method: 'GET',
	credentials: 'include',
  })
  .then(async response => {
	if (response.status === 404) {
	  // server returns 404 when no methods — adjust UX as needed
	  console.error('No 2FA methods set up. Redirecting.');
	  loadPage('/home');
	  return null;
	}
	if (!response.ok) {
	  throw new Error('Failed fetching 2FA methods: ' + response.status);
	}
	return response.json();
  })
  .then(data => {
	if (!data) return;

	const methods = data.twoFaMethods ?? [];
	primary = methods.find((m: any) => m.is_primary && m.method_type === 1);
	if (!primary) {
	  console.error('No primary TOTP 2FA method found. Redirecting to home.');
	  loadPage('/home');
	  return;
	}
	console.log('Primary TOTP 2FA method found:', primary);
  })
  .catch(err => {
	console.error('Error fetching 2FA methods:', err);
	loadPage('/home');
  });

  // Helper to collect code and verify
  const tryVerifyIfFilled = () => {
	if (inputs.length === 0) return;
	if (inputs.every(i => i.value.length === 1)) {
	  const code = inputs.map(i => i.value).join('');
	  verifyTwoFa(code);
	}
  };

  // Wire existing handlers and add Enter key submit
  inputs.forEach((input, index) => {
	inputEventOnInput(input, index, inputs);
	backspaceEventOnInput(input, index, inputs);
	pasteEventOnInput(input, index, inputs);
	enterKeyEventOnInput(input, index, inputs);
	
	addListener(input, 'input', tryVerifyIfFilled);
  });
}

prepareInputs();