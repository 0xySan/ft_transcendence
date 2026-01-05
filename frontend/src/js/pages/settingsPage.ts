// settings.ts
export {};

type EventMapFor<T> =
T extends Window ? WindowEventMap :
T extends Document ? DocumentEventMap :
T extends HTMLElement ? HTMLElementEventMap :
T extends EventTarget ? Record<string, Event> :
never;

declare function addListener<
T extends EventTarget,
K extends keyof EventMapFor<T>
>(
	target: T | null,
	type: K,
	handler: (event: EventMapFor<T>[K]) => void
): void;
declare function translateElement(language: string, element: HTMLElement): void;
declare function getUserLang(): string;
declare function updateNavBar(userData: any): void;
declare function loadPage(url: string): void;

type SectionName = string;

const menuItems = document.querySelectorAll<HTMLLIElement>('.settings-item');
const sections = document.querySelectorAll<HTMLElement>('.settings-section');

function showSection(sectionName: SectionName): void {
	sections.forEach((section) => {
		const isActive = section.dataset.section === sectionName;
		section.classList.toggle('unloaded', !isActive);
	});
	
	menuItems.forEach((item) => {
		const isActive = item.dataset.section === sectionName;
		item.classList.toggle('active', isActive);
	});
	
	// Accessibility: focus first interactive element
	const activeSection = document.querySelector<HTMLElement>(
		`.settings-section[data-section="${sectionName}"]`
	);
	
	if (!activeSection) return;
	
	const focusable = activeSection.querySelector<HTMLElement>(
		'input, button, select, textarea, a'
	);
	
	focusable?.focus();
}

menuItems.forEach((item) => {
	addListener(item, 'click', () => {
		const section = item.dataset.section;
		if (!section) return;
		
		showSection(section);
	});
});

// On page load, fetch user profile data and populate form fields
fetch('/api/users/me', {
	method: 'GET',
	credentials: 'include',
	headers: {
		'accept-language': getUserLang()
	}
})
.then(async (res) => {
	if (res.status === 401 || res.status === 403 || res.status === 404) {
		loadPage('/home');
		return;
	}
	if (!res.ok) {
		return;
	}
	const data = await res.json();
	if (!data.user || !data.user.profile) {
		loadPage('/home');
		return;
	}
	const profile = data.user.profile;
	const displayNameInput = document.querySelector<HTMLInputElement>('#profile-form input[name="display-name"]');
	const bioInput = document.querySelector<HTMLTextAreaElement>('#profile-form textarea[name="bio"]');
	const currentAvatarContainer = document.getElementById('current-avatar-container');
	const currentAvatarImage = document.querySelector<HTMLImageElement>('#current-avatar');

	if (displayNameInput) displayNameInput.value = profile.displayName || '';
	if (bioInput) bioInput.value = profile.bio || '';
	if (currentAvatarContainer && currentAvatarImage) {
		if (profile.profilePicture) {
			currentAvatarImage.src = `/api/users/data/imgs/${profile.profilePicture}`;
			currentAvatarContainer.style.display = '';
		} else {
			currentAvatarContainer.style.display = 'none';
		}
	}
	updateTwoFaButtons();
})
.catch((err) => {
	console.error('Error fetching profile data:', err);
	loadPage('/home');
});

/** Update the 2FA buttons based on current user 2FA methods
 * Fetches the current 2FA methods and updates the button states accordingly.
 */
function updateTwoFaButtons() {
	fetch('/api/users/twofa/', {
		method: 'GET',
		credentials: 'include',
		headers: { 'accept-language': getUserLang() }
	})
	.then(async res => {
		let methods: any[] = [];
		if (res.status === 404) methods = [];
		else if (res.ok) {
			const data = await res.json();
			methods = data.twoFaMethods || [];
		} else {
			return;
		}
		// Find method types
		const hasEmail = methods.some(m => m.method_type === 0 && m.is_verified);
		const hasTotp = methods.some(m => m.method_type === 1 && m.is_verified);
		const hasBackup = methods.some(m => m.method_type === 2 && m.is_verified);

		const emailBtn = document.getElementById('enable-email-otp-btn') as HTMLButtonElement;
		const totpBtn = document.getElementById('enable-totp-btn') as HTMLButtonElement;
		const backupBtn = document.getElementById('generate-backup-btn') as HTMLButtonElement;

		if (emailBtn) {
			if (hasEmail) {
				emailBtn.setAttribute('data-translate-key', 'settings.twofa.disableEmailOtpButton');
				emailBtn.classList.add('button-danger');
			} else {
				emailBtn.setAttribute('data-translate-key', 'settings.twofa.enableEmailOtpButton');
				emailBtn.classList.remove('button-danger');
			}
			translateElement(getUserLang(), emailBtn);
		}
		if (totpBtn) {
			if (hasTotp) {
				totpBtn.setAttribute('data-translate-key', 'settings.twofa.disableTotpButton');
				totpBtn.classList.add('button-danger');
			} else {
				totpBtn.setAttribute('data-translate-key', 'settings.twofa.enableTotpButton');
				totpBtn.classList.remove('button-danger');
			}
			translateElement(getUserLang(), totpBtn);
		}
		if (backupBtn) {
			if (hasBackup) {
				backupBtn.setAttribute('data-translate-key', 'settings.twofa.deleteBackupCodesButton');
			} else {
				backupBtn.setAttribute('data-translate-key', 'settings.twofa.generateBackupCodesButton');
			}
			translateElement(getUserLang(), backupBtn);
		}
	})
	.catch(err => {
		console.error('Error fetching 2FA methods:', err);
	});
}

/** Minimal QR matrix store and postMessage handler for TOTP popup (414 fix) */
/** Store the last generated QR matrix for TOTP */
let lastTotpQrMatrix: any = null;
addListener(window, 'message', (event: MessageEvent) => {
	if (event.data && event.data.type === 'request-totp-qr-matrix' && lastTotpQrMatrix) {
		let matrix = lastTotpQrMatrix;
		// If matrix is a string, try to parse it as JSON
		if (typeof matrix === 'string') {
			try {
				matrix = JSON.parse(matrix);
			} catch {}
		}
		// Normalize matrix into array of '0'/'1' strings per row
		function normalizeCell(cell: any) {
			if (typeof cell === 'boolean') return cell ? '1' : '0';
			if (typeof cell === 'number') return cell ? '1' : '0';
			if (typeof cell === 'string') {
				const s = cell.trim().toLowerCase();
				if (s === 'true' || s === '1') return '1';
				if (s === 'false' || s === '0') return '0';
				// if single-char '0'/'1'
				if (/^[01]+$/.test(s)) return s;
			}
			return '0';
		}

		if (Array.isArray(matrix)) {
			matrix = matrix.map((row: any) => {
				if (typeof row === 'string') {
					// row may be a comma-joined list like 'true,false,...'
					if (row.indexOf(',') !== -1) {
						return row.split(',').map(normalizeCell).join('');
					}
					// row may already be '0101' or similar
					if (/^[01]+$/.test(row.trim())) return row.trim();
					// otherwise treat as single cell
					return normalizeCell(row as any);
				}
				if (Array.isArray(row)) {
					return row.map(normalizeCell).join('');
				}
				// Single boolean/number cell
				return normalizeCell(row as any);
			});
		}

		// Only send if it's an array of strings
		if (Array.isArray(matrix) && matrix.every((r: any) => typeof r === 'string')) {
			const target = event.source as any;
			try {
				if (target && typeof target.postMessage === 'function') {
					const origin = window.location.origin || '*';
					target.postMessage({ type: 'totp-qr-matrix', matrix }, origin);
				}
			} catch (err) {
				console.warn('Failed to postMessage totp-qr-matrix to popup:', err);
			}
		}
	}
});

function setupTwoFaButtonEvents() {
    const emailBtn = document.getElementById('enable-email-otp-btn') as HTMLButtonElement;
    const totpBtn = document.getElementById('enable-totp-btn') as HTMLButtonElement;
    const backupBtn = document.getElementById('generate-backup-btn') as HTMLButtonElement;

    if (emailBtn) {
        addListener(emailBtn, 'click', async () => {
            const enabled = emailBtn.classList.contains('button-danger');
            const allowed = await ensureTwoFaIfNeeded();
            if (!allowed) return;
			if (!enabled) {
				// Open the email OTP popup for setup (creation is handled there)
				let popupUrl = '/email_otp_popup';
				if (typeof allowed === 'string') {
					popupUrl += `?twoFaToken=${encodeURIComponent(allowed)}`;
				}
				window.open(popupUrl, 'email_otp_popup', 'width=420,height=520');
			} else {
                // Disable Email OTP
                let body: any = { changes: {} };
                const res = await fetch('/api/users/twofa/', { method: 'GET', credentials: 'include' });
                const data = res.ok ? await res.json() : {};
                const method = (data.twoFaMethods || []).find((m: any) => m.method_type === 0 && m.is_verified);
                if (!method) return;
                body.changes[method.id || method.method_id] = { disable: true };
                if (typeof allowed === 'string') body.token = allowed;
                await fetch('/api/users/twofa', {
                    method: 'PATCH',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json', 'accept-language': getUserLang() },
                    body: JSON.stringify(body)
                });
                updateTwoFaButtons();
            }
        });
    }
    if (totpBtn) {
        addListener(totpBtn, 'click', async () => {
            const enabled = totpBtn.classList.contains('button-danger');
            const allowed = await ensureTwoFaIfNeeded();
            if (!allowed) return;
            if (!enabled) {
                // Enable TOTP: call server first
                let body: any = { methods: [{ methodType: 1, label: 'Authenticator App' }] };
                if (typeof allowed === 'string') body.twoFaToken = allowed;
                const res = await fetch('/api/users/twofa/', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json', 'accept-language': getUserLang() },
                    body: JSON.stringify(body)
                });
                if (res.ok) {
                    const result = await res.json();
                    const methodId = result.results && result.results[0] && result.results[0].methodId;
                    const qrMatrix = result.results && result.results[0] && result.results[0].params && result.results[0].params.qrMatrix;
                    if (methodId && qrMatrix) {
						lastTotpQrMatrix = qrMatrix;
						window.open(`/totp_qr_popup?uuid=${encodeURIComponent(methodId)}`, 'totp_qr_popup', 'width=640,height=720');
                    }
                }
                updateTwoFaButtons();
            } else {
                // Disable TOTP
                let body: any = { changes: {} };
                const res = await fetch('/api/users/twofa/', { method: 'GET', credentials: 'include' });
                const data = res.ok ? await res.json() : {};
                const method = (data.twoFaMethods || []).find((m: any) => m.method_type === 1 && m.is_verified);
                if (!method) return;
                body.changes[method.id || method.method_id] = { disable: true };
                if (typeof allowed === 'string') body.token = allowed;
                await fetch('/api/users/twofa', {
                    method: 'PATCH',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json', 'accept-language': getUserLang() },
                    body: JSON.stringify(body)
                });
                updateTwoFaButtons();
            }
        });
    }
    if (backupBtn) {
        addListener(backupBtn, 'click', async () => {
            const enabled = backupBtn.getAttribute('data-translate-key') === 'settings.twofa.deleteBackupCodesButton';
            const allowed = await ensureTwoFaIfNeeded();
            if (!allowed) return;
            if (!enabled) {
                // Generate backup codes: call server first
                let body: any = { methods: [{ methodType: 2, label: 'Backup Codes' }] };
                if (typeof allowed === 'string') body.twoFaToken = allowed;
                const res = await fetch('/api/users/twofa/', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json', 'accept-language': getUserLang() },
                    body: JSON.stringify(body)
                });
                if (res.ok) {
                    const result = await res.json();
                    // Open backup codes popup, pass codes (result.results[0].params.codes)
                    window.open(`/backup_codes_popup?codes=${encodeURIComponent(JSON.stringify(result.results[0].params.codes))}`, 'backup_codes_popup', 'width=420,height=520');
                }
                updateTwoFaButtons();
            } else {
                // Delete backup codes
                let body: any = { changes: {} };
                const res = await fetch('/api/users/twofa/', { method: 'GET', credentials: 'include' });
                const data = res.ok ? await res.json() : {};
                const method = (data.twoFaMethods || []).find((m: any) => m.method_type === 2 && m.is_verified);
                if (!method) return;
                body.changes[method.id || method.method_id] = { disable: true };
                if (typeof allowed === 'string') body.token = allowed;
                await fetch('/api/users/twofa', {
                    method: 'PATCH',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json', 'accept-language': getUserLang() },
                    body: JSON.stringify(body)
                });
                updateTwoFaButtons();
            }
        });
    }
}

// ================================================
// 			User profile update handling
// ================================================

addListener(
	document.getElementById('profile-form'),
	'submit',
	async (e) => {
		e.preventDefault();
		
		const form = e.target as HTMLFormElement;
		const displayNameInput = form.querySelector<HTMLInputElement>(
			'input[name="display-name"]'
		);
		const bioInput = form.querySelector<HTMLTextAreaElement>(
			'textarea[name="bio"]'
		);
		const avatarUrlInput = form.querySelector<HTMLInputElement>(
			'input[name="avatar"]'
		);
		const avatarFileInput = form.querySelector<HTMLInputElement>(
			'input[name="avatar-file"]'
		);
		
		if (!displayNameInput || !bioInput || !avatarUrlInput) return;
		
		const displayName = displayNameInput.value.trim();
		const bio = bioInput.value.trim();
		const avatarUrl = avatarUrlInput.value.trim();
		
		let body: any = {};
		if (displayName) body.displayName = displayName;
		if (bio) body.bio = bio;
		
		// Handle avatar upload: file first, then URL
		try {
			if (avatarFileInput && avatarFileInput.files && avatarFileInput.files.length > 0) {
				const fd = new FormData();
				fd.append('file', avatarFileInput.files[0]);
				const upRes = await fetch('/api/users/data/imgs/avatar', {
					method: 'POST',
					credentials: 'include',
					body: fd,
				});
				const upData = await upRes.json().catch(() => ({}));
				if (!upRes.ok) {
					alert(upData.error || 'Failed to upload avatar file.');
					return;
				}
				if (upData.fileName) body.profilePicture = upData.fileName;
			} else if (avatarUrl) {
				// If avatar field looks like a remote URL, attempt server-side download
				if (/^https?:\/\//i.test(avatarUrl)) {
					
					const urlRes = await fetch('/api/users/data/imgs/avatar-url', {
						method: 'POST',
						credentials: 'include',
						headers: { 'Content-Type': 'application/json', 'accept-language': getUserLang() },
						body: JSON.stringify({ url: avatarUrl })
					});
					const urlData = await urlRes.json().catch(() => ({}));
					
					if (!urlRes.ok) {
						alert(urlData.error || 'Failed to download avatar from URL.');
						return;
					}
					if (urlData.fileName) body.profilePicture = urlData.fileName;
				} else {
					body.profilePicture = avatarUrl;
				}
			}
		} catch (err) {
			alert('Avatar upload failed.');
			return;
		}
		
		if (Object.keys(body).length === 0) {
			return;
		}
		
		// From here on, action is authorized
		try {
			const res = await fetch('/api/users/me', {
				method: 'PATCH',
				credentials: 'include',
				headers: {
					'Content-Type': 'application/json',
					'accept-language': getUserLang(),
				},
				body: JSON.stringify(body)
			});
			if (res.ok) {
				// Update displayed avatar if server returned a fileName
				if (body.profilePicture) {
					const currentAvatarContainer = document.getElementById('current-avatar-container');
					const currentAvatarImage = document.querySelector<HTMLImageElement>('#current-avatar');
					if (currentAvatarContainer && currentAvatarImage) {
						currentAvatarImage.src = `/api/users/data/imgs/${body.profilePicture}`;
						currentAvatarContainer.style.display = '';
					}
				} else {
					const currentAvatarContainer = document.getElementById('current-avatar-container');
					if (currentAvatarContainer) currentAvatarContainer.style.display = 'none';
				}
				// Fetch latest user data and update navbar
				try {
					const navRes = await fetch('/api/users/me', {
						method: 'GET',
						credentials: 'include',
						headers: { 'accept-language': getUserLang() }
					});
					if (navRes.ok) {
						const navData = await navRes.json();
						updateNavBar(navData);
					}
				} catch (err) {
					console.error('Failed to update navbar after profile update:', err);
				}
				alert('Profile updated successfully.');
				return;
			}
			
			const data = await res.json().catch(() => ({}));
			if (data.message === 'Invalid displayName (must be string, ≤50 chars)') {
				alert('Display name is invalid.');
				return;
			}
			alert('Failed to update profile.');
		} catch (err) {
			console.error('Profile update error:', err);
			alert('Failed to update profile.');
		}
	}
);


// ================================================
// 			User password update handling
// ================================================

addListener(
	document.getElementById('security-form'),
	'submit',
	async (e) => {
		e.preventDefault();
		
		const form = e.target as HTMLFormElement;
		const oldPasswordInput = form.querySelector<HTMLInputElement>(
			'input[name="current-password"]'
		);
		const newPasswordInput = form.querySelector<HTMLInputElement>(
			'input[name="new-password"]'
		);
		const repeatPasswordInput = form.querySelector<HTMLInputElement>(
			'input[name="repeat-password"]'
		);
		
		if (!oldPasswordInput || !newPasswordInput || !repeatPasswordInput) return;
		
		const oldPassword = oldPasswordInput.value;
		const newPassword = newPasswordInput.value;
		const repeatPassword = repeatPasswordInput.value;
		
		if (newPassword !== repeatPassword) {
			alert('New passwords do not match.');
			return;
		}
		
		const allowed = await ensureTwoFaIfNeeded();
		if (!allowed) return;
		
		let body = {
			old_password: oldPassword,
			new_password: newPassword
		};
		
		if (typeof allowed === 'string') {
			(body as any).twoFaToken = allowed;
		}
		
		// From here on, action is authorized
		fetch('/api/users/accounts/change-password', {
			method: 'POST',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json',
				'accept-language': getUserLang(),
			},
			body: JSON.stringify(body)
		})
		.then(async (res) => {
			if (res.ok) {
				alert('Password updated successfully.');
				return;
			}
			
			const data = await res.json();
			if (data.message === 'Old password incorrect') {
				alert('Current password is incorrect.');
				return;
			}
			
			if (data.message === 'New password invalid') {
				alert('New password is invalid.');
				return;
			}
			
			alert('Failed to update password.');
		});
	}
);

// ================================================
// 				2FA popup handling
// ================================================

async function ensureTwoFaIfNeeded(): Promise<string | true | false> {
	let methods = null as any[] | null;
	
	try {
		const res = await fetch('/api/users/twofa/', {
			method: 'GET',
			credentials: 'include',
			headers: {
				'accept-language': getUserLang()
			}
		});
		
		// No 2FA configured → do not block user
		if (res.status === 404)
			return true;
		
		if (!res.ok) {
			console.error('Failed to fetch 2FA methods:', res.status);
			return false;
		}
		
		const data = await res.json();
		methods = data.twoFaMethods ?? null;
	}
	catch (err) {
		console.error('2FA fetch error:', err);
		return false;
	}
	
	if (!methods || methods.length === 0)
		return true;
	
	// Only keep usable methods
	const validMethods = methods.filter(m => m && m.is_verified === true);
	
	// 2FA exists but none is usable → do not block user
	if (validMethods.length === 0)
		return true;
	
	// At least one valid method → require popup validation
	// Returns: string (validated token) | false (cancel/timeout/error)
	return await openTwoFaPopupAndWait();
}

function openTwoFaPopupAndWait(): Promise<string | false> {
	return new Promise((resolve) => {
		const requestId = crypto.randomUUID();
		let popup: Window | null = null;
		
		const popupUrl = `/twofa_popup?requestId=${requestId}`;
		
		popup = window.open(
			popupUrl,
			`twofa_popup_${requestId}`,
			'width=420,height=520,resizable=no'
		);
		
		if (!popup) {
			resolve(false);
			return;
		}
		
		const timeout = window.setTimeout(() => {
			cleanup();
			if (popup && !popup.closed)
				popup.close();
			resolve(false);
		}, 120000);
		
		const closePoll = window.setInterval(() => {
			if (popup && popup.closed) {
				cleanup();
				clearInterval(closePoll);
				resolve(false);
			}
		}, 300);
		
		function cleanup() {
			window.removeEventListener('message', onMessage);
			clearTimeout(timeout);
			clearInterval(closePoll);
		}
		
		function onMessage(e: MessageEvent) {
			if (e.origin !== window.location.origin)
				return;
			
			if (!e.data || !e.data.type)
				return;
			
			switch (e.data.type) {
				case 'TWOFA_SUCCESS': {
					// Expect the popup to send back the validated token
					const token = (typeof e.data.token === 'string') ? e.data.token : null;
					cleanup();
					if (popup && !popup.closed)
						popup.close();
					if (token)
						resolve(token);
					else
						resolve(false);
					break;
				}
				
				case 'TWOFA_CANCEL':
				cleanup();
				if (popup && !popup.closed)
					popup.close();
				resolve(false);
				break;
			}
		}
		
		addListener(window, 'message', onMessage as EventListener);
	});
}

// ================================================
// 				OAuth popup handling
// ================================================

const oauthButtons = document.querySelectorAll<HTMLAnchorElement>('.oauth-button');
const oauthPopups = new Map<string, Window>();
const oauthButtonsPressed = new Map<string, HTMLElement>();
const oauthInProgress = new Set<HTMLElement>(); // debounce per button

let usersOauthProviders: Record<string, any> = {};

fetch('/api/oauth/', {
	method: 'GET',
	credentials: 'include',
	headers: {
		'Content-Type': 'application/json',
		'accept-language': getUserLang()
	}
})
.then(async res => {
	const data = await res.json();
	if (res.ok) {
		usersOauthProviders = data.oauth.reduce((acc: Record<string, any>, curr: any) => {
			acc[curr.provider] = curr;
			return acc;
		}, {});
		oauthButtons.forEach((button) => {
			const provider = button.href.split('/').pop();
			if (!provider) return;
			const isLinked = data.oauth.some((acc: any) => acc.provider === provider);
			const textSpan = button.querySelector<HTMLElement>('.oauth-text');
			if (!textSpan) return;
			if (isLinked) {
				const currentKey = textSpan.dataset.translateKey;
				if (currentKey) {
					const newKey = currentKey.replace('link', 'unlink');
					textSpan.dataset.translateKey = newKey;
				}
				button.dataset.state = 'linked';
			} else {
				// Ensure it says "Link"
				const currentKey = textSpan.dataset.translateKey;
				if (currentKey) {
					const newKey = currentKey.replace('unlink', 'link');
					textSpan.dataset.translateKey = newKey;
				}
				button.dataset.state = 'unlinked';
			}
			translateElement(getUserLang(), textSpan);
		});
	} else
		throw new Error(data.message || `HTTP ${res.status}`);
})
.catch(err => {
	console.error('Register error:', err);
});

addListener(window, "message", (e) => {
	if (e.origin !== window.location.origin) return;
	if (!e.data || !e.data.requestId) return;
	
	const popup = oauthPopups.get(e.data.requestId);
	const button = oauthButtonsPressed.get(e.data.requestId);
	
	if (popup && !popup.closed) popup.close();
	
	oauthPopups.delete(e.data.requestId);
	oauthButtonsPressed.delete(e.data.requestId);
	
	if (button) oauthInProgress.delete(button);
	if (!(button instanceof HTMLElement)) return;
	
	const textSpan = button.querySelector<HTMLElement>('.oauth-text');
	if (textSpan) {
		const currentKey = textSpan.dataset.translateKey;
		if (currentKey) {
			textSpan.dataset.translateKey = currentKey.replace('unlink', 'link');
			translateElement(getUserLang(), textSpan);
		}
	}
	
	button.dataset.state = 'unlinked';
});

// Listen for TOTP/creation completion from popups to refresh UI
addListener(window, 'message', (e) => {
	if (e.origin !== window.location.origin) return;
	if (!e.data || e.data.type !== 'TWOFA_CREATION_SUCCESS') return;
	try {
		alert('Two-factor authentication configured successfully.');
	} catch {}
	try {
		updateTwoFaButtons();
	} catch (err) {
		console.warn('Failed to update 2FA buttons after creation message:', err);
	}
});

oauthButtons.forEach((button) => {
	addListener(button, "click", async (e) => {
		e.preventDefault();

		const allowed = await ensureTwoFaIfNeeded();
		if (!allowed) return;
		
		// From here on, action is authorized
		if (button.dataset.state === 'linked') {
			// ======================
			// Unlink flow
			// ======================
			const provider = button.href.split('/').pop();
			if (!provider) return;

			fetch(`/api/oauth/${provider}/unlink?providerUserId=${usersOauthProviders[provider]?.providerUserId}`, {
				method: 'GET',
				credentials: 'include',
				headers: {
					'Content-Type': 'application/json',
					'accept-language': getUserLang()
				}
			})
			.then(async res => {
				const data = await res.json();
				if (res.ok) {
					const textSpan = button.querySelector<HTMLElement>('.oauth-text');
					if (textSpan) {
						const currentKey = textSpan.dataset.translateKey;
						if (currentKey) {
							textSpan.dataset.translateKey = currentKey.replace('unlink', 'link');
							translateElement(getUserLang(), textSpan);
						}
					}
					button.dataset.state = 'unlinked';
				} else {
					throw new Error(data.message || `HTTP ${res.status}`);
				}
			})
			.catch(err => {
				console.error('Unlink error:', err);
			});
			return;
		}
		
		// ======================
		// Link flow
		// ======================
		if (oauthInProgress.has(button)) return;
		oauthInProgress.add(button);

		const requestId = crypto.randomUUID();
		const url = `${button.href}?requestId=${requestId}`;
		
		let popup: Window | null = window.open(
			url,
			"oauth_window_" + requestId,
			"width=500,height=600,resizable=yes,scrollbars=yes"
		);
		
		if (!popup) {
			oauthInProgress.delete(button);
			return;
		}
		
		oauthPopups.set(requestId, popup);
		oauthButtonsPressed.set(requestId, button);
		
		const timeout = window.setTimeout(() => {
			cleanup();
			if (popup && !popup.closed) popup.close();
		}, 120000);
		
		const closePoll = window.setInterval(() => {
			if (popup && popup.closed) {
				cleanup();
			}
		}, 300);
		
		function cleanup() {
			clearTimeout(timeout);
			clearInterval(closePoll);
			oauthPopups.delete(requestId);
			oauthButtonsPressed.delete(requestId);
			oauthInProgress.delete(button);
		}
	});
});

// Avatar input toggle logic
const avatarFileGroup = document.getElementById('avatar-file-group');
const avatarUrlGroup = document.getElementById('avatar-url-group');
const avatarModeRadios = document.querySelectorAll<HTMLInputElement>('input[name="avatar-mode"]');

avatarModeRadios.forEach(radio => {
	radio.addEventListener('change', () => {
		if (radio.checked) {
			const avatarFileInput = document.querySelector<HTMLInputElement>('input[name="avatar-file"]');
			const avatarUrlInput = document.querySelector<HTMLInputElement>('input[name="avatar"]');
			if (radio.value === 'file') {
				if (avatarFileGroup) avatarFileGroup.style.display = '';
				if (avatarUrlGroup) avatarUrlGroup.style.display = 'none';
				if (avatarFileInput) avatarFileInput.value = '';
			} else {
				if (avatarFileGroup) avatarFileGroup.style.display = 'none';
				if (avatarUrlGroup) avatarUrlGroup.style.display = '';
				if (avatarUrlInput) avatarUrlInput.value = '';
			}
		}
	});
});

// Initial section
showSection('profile');
setupTwoFaButtonEvents();