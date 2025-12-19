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
// 				OAuth popup handling
// ================================================

const oauthButtons = document.querySelectorAll<HTMLLinkElement>(".oauth-button");

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

const oauthPopups = new Map();
const oauthButtonsPressed = new Map();

addListener(window, "message", (e) => {
	e.preventDefault();

	if (e.origin !== window.location.origin) return;
	if (!e.data || !e.data.requestId) return;
	
	console.log("OAuth result:", e.data);
	
	// Get the popup and close it
	const popup = oauthPopups.get(e.data.requestId);
	const button = oauthButtonsPressed.get(e.data.requestId);
	
	if (popup && !popup.closed) popup.close();
	oauthPopups.delete(e.data.requestId);
	oauthButtonsPressed.delete(e.data.requestId);
	
	if (!(button instanceof HTMLElement)) return;
	
	// Success - update button state
	const textSpan = button.querySelector<HTMLElement>('.oauth-text');
	
	if (textSpan) {
		const currentKey = textSpan.dataset.translateKey;
		if (currentKey) {
			const newKey = currentKey.replace('unlink', 'link');
			textSpan.dataset.translateKey = newKey;
			translateElement(getUserLang(), textSpan);
		}
	}
	
	button.dataset.state = 'unlinked';
});

oauthButtons.forEach((button) => {
	addListener(button, "click", (e) => {
		e.preventDefault();
		
		if (button.dataset.state === 'linked') {
			// Unlink flow
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
					// Success - update button state
					const textSpan = button.querySelector<HTMLElement>('.oauth-text');
					if (textSpan) {
						const currentKey = textSpan.dataset.translateKey;
						if (currentKey) {
							const newKey = currentKey.replace('unlink', 'link');
							textSpan.dataset.translateKey = newKey;
							translateElement(getUserLang(), textSpan);
						}
					}
					button.dataset.state = 'unlinked';
				} else
					throw new Error(data.message || `HTTP ${res.status}`);
			})
			.catch(err => {
				console.error('Unlink error:', err);
			});
			return;
		}
		else {
			const requestId = crypto.randomUUID();
			const url = `${button.href}?requestId=${requestId}`;
			
			const popup = window.open(
				url,
				"oauth_window_" + requestId,
				"width=500,height=600,resizable=yes,scrollbars=yes"
			);
			
			oauthPopups.set(requestId, popup);
			oauthButtonsPressed.set(requestId, button);
			
			setTimeout(() => {
				if (popup && !popup.closed) popup.close();
				oauthPopups.delete(requestId);
				oauthButtonsPressed.delete(requestId);
			}, 120000);
		}
	});
});

// Initial section
showSection('profile');
