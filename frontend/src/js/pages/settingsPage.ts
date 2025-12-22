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

// ================================================
// 				2FA popup handling
// ================================================

async function ensureTwoFaIfNeeded(): Promise<boolean> {
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
	return await openTwoFaPopupAndWait();
}

function openTwoFaPopupAndWait(): Promise<boolean> {
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
				case 'TWOFA_SUCCESS':
				cleanup();
				if (popup && !popup.closed)
					popup.close();
				resolve(true);
				break;
				
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
			const isLinked = data.linkedProviders.includes(provider);
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
	if (!e.data || !e.data.requestId) return;
	
	console.log("OAuth result:", e.data);
	
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

// Initial section
showSection('profile');
