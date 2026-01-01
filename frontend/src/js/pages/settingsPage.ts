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

// When we arrive at the settings page, we have to update the display name and the bio fields to match current values
// This is because the user might have changed them elsewhere, and we want to show the latest values
fetch('/api/users/me', {
	method: 'GET',
	credentials: 'include',
	headers: {
		'accept-language': getUserLang()
	}
})
.then(async (res) => {
	if (!res.ok) {
		return;
	}
	
	const data = await res.json();
	const profile = data.user.profile;
	if (!profile) {
		return;
	}
	
	const displayNameInput = document.querySelector<HTMLInputElement>(
		'#profile-form input[name="display-name"]'
	);
	const bioInput = document.querySelector<HTMLTextAreaElement>(
		'#profile-form textarea[name="bio"]'
	);
	const currentAvatarImage = document.querySelector<HTMLImageElement>(
		'#current-avatar'
	);
	
	if (displayNameInput) displayNameInput.value = profile.displayName || '';
	if (bioInput) bioInput.value = profile.bio || '';
	if (currentAvatarImage) currentAvatarImage.src = `/api/users/data/imgs/${profile.profilePicture || ''}`;
})
.catch((err) => {
	console.error('Error fetching profile data:', err);
});

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
					const currentAvatarImage = document.querySelector<HTMLImageElement>('#current-avatar');
					if (currentAvatarImage) {
						currentAvatarImage.src = `/api/users/data/imgs/${body.profilePicture}`;
					}
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
			if (data.error === 'invalid_display_name' || data.message === 'Invalid displayName (must be string, ≤50 chars)') {
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
			console.log('Password change response:', res);
			if (res.ok) {
				alert('Password updated successfully.');
				return;
			}
			
			const data = await res.json();
			if (data.error === 'invalid_old_password') {
				alert('Current password is incorrect.');
				return;
			}
			
			if (data.error === 'invalid_new_password') {
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


fetch('/api/oauth/', {
	method: 'GET',
	headers: {
		'Content-Type': 'application/json',
		'accept-language': getUserLang()
	}
})
.then(async res => {
	const data = await res.json();
	if (res.ok) {
		oauthButtons.forEach((button) => {
			const provider = button.href.split('/').pop();
			if (!provider) return;
			const isLinked = false; // data.???.includes(provider); --- IGNORE ---
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
			translateElement(getUserLang(), textSpan)
		});
	} else
		throw new Error(data.message || `HTTP ${res.status}`);
})
.catch(err => {
	console.error('Register error:', err);
});

addListener(window, "message", (e) => {
	if (e.origin !== window.location.origin) return;
	if (!e.data || !e.data.requestId) return
	
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

oauthButtons.forEach((button) => {
	addListener(button, "click", async (e) => {
		e.preventDefault();
		
		// 🔐 1. Ensure 2FA first
		const allowed = await ensureTwoFaIfNeeded();
		if (!allowed) return;
		
		// From here on, action is authorized
		if (button.dataset.state === 'linked') {
			// ======================
			// Unlink flow
			// ======================
			const provider = button.href.split('/').pop();
			if (!provider) return;
			
			fetch(`/api/oauth/${provider}/unlink`, {
				method: 'GET',
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
