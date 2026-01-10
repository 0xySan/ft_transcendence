export {};

import { getUserLang } from "./translationModule.js";

type CleanupFn = () => void | Promise<void>;

// Global listeners array to track dynamically added event listeners
declare global {
	var listeners: Listener[];
	interface Window {
		loadPage: typeof loadPage;
	}

	var dynamicCleanups: CleanupFn[];
	var registerDynamicCleanup: (fn: CleanupFn) => void;
}

window.dynamicCleanups = [];

window.registerDynamicCleanup = (fn: CleanupFn): void => {
	window.dynamicCleanups.push(fn);
};

async function runDynamicCleanups(): Promise<void> {
	for (const cleanup of window.dynamicCleanups) {
		try {
			await cleanup();
		} catch (err) {
			console.error('Cleanup error:', err);
		}
	}
	window.dynamicCleanups.length = 0;
}

const contentDiv = document.getElementById('content') as HTMLElement;
let currentUrl: string = window.location.href;

// Whitelist for links that should not trigger dynamic navigation
const whitelist: RegExp[] = [/\.jpg$/];

// Keep track of dynamically added listeners for cleanup
interface Listener {
	element: EventTarget;
	type: string;
	callback: EventListenerOrEventListenerObject;
	options?: boolean | AddEventListenerOptions;
}

// --- Utility: Remove all previously attached listeners ---
/* Avoid accumulating listeners on dynamic content reloads, 
 * since we dynamically fetch the content and execute scripts
 * the same one can be executed multiple times accumulating listeners.
 */
function clearAllListeners(): void {
	for (const { element, type, callback, options } of listeners) {
		element.removeEventListener(type, callback, options);
	}
	listeners.length = 0;
}


// --- Execute all <script src="..."> scripts inside a container ---
async function executeScripts(container: HTMLElement): Promise<void> {
	// Reinitialize all forms in the new content
	const forms = container.querySelectorAll<HTMLFormElement>('form');
	// initializeForms(forms);

	// Select all <script> elements that have a `src` attribute
	const scripts = container.querySelectorAll<HTMLScriptElement>('script[src]');

	for (const script of scripts) {
		const src = script.getAttribute('src');
		const type = script.type || 'text/javascript';

		if (!src) continue; // Skip inline scripts

		try {
			const response = await fetch(src);
			if (!response.ok) throw new Error(`Failed to fetch script: ${src}`);
			const code = await response.text();
			if (type === 'module') { // For module scripts, create a Blob URL and dynamically import it
				// Wrap the code in a Blob and import as module
				const blob = new Blob([code], { type: 'text/javascript' });
				const blobUrl = URL.createObjectURL(blob);
				await import(blobUrl);
				URL.revokeObjectURL(blobUrl);
			} else { // For classic scripts, fetch and execute using eval()
				eval(code);
			}
		} catch (err) {
			console.error(`Error executing script ${src}:`, err);
		}

		// Remove the old <script> element from the DOM
		script.remove();
	}
}

// --- Initialize dynamic navigation and form handling ---
function setupDynamicRouting(): void {
	// Initial URL setup
	currentUrl = document.getElementById('currentUrl')?.textContent || window.location.href;
	history.replaceState(null, '', currentUrl);

	// Intercept all link clicks
	document.addEventListener('click', (event: MouseEvent) => {
		const link = (event.target as HTMLElement).closest('a') as HTMLAnchorElement | null;
		// Ignore if no link, whitelisted, or marked to skip dynamic loading
		if (!link || whitelist.some(regex => regex.test(link.href)) || link.classList.contains('no-dynamic-load')) {
			return;
		}

		event.preventDefault();
		const url = new URL(link.href);

		// Fetch page content dynamically
		fetch(url.href, { headers: { 'X-Requested-With': 'XMLHttpRequest', 'accept-language': getUserLang() } })
			.then(res => res.ok ? res.text() : Promise.reject(`HTTP ${res.status}`))
			.then(html => {
				updatePage(url.href, html, 'push');
			})
			.catch(err => console.error('Fetch error:', err));
	});

	// Handle browser back/forward buttons
	window.addEventListener('popstate', () => {
		const url = new URL(window.location.href);
		if (url.pathname === '/' && !url.searchParams.has('song')) {
			if (contentDiv) contentDiv.innerHTML = '';
		} else {
			fetch(url.href, { headers: { 'X-Requested-With': 'XMLHttpRequest', 'accept-language': getUserLang() } })
				.then(res => res.text())
				.then(html => updatePage(url.href, html, 'replace'))
				.catch(err => console.error('Fetch error on popstate:', err));
		}
	});

	// Initialize forms already present in DOM
	const forms = document.querySelectorAll<HTMLFormElement>('form');
	// initializeForms(forms);
}

// --- Update the #content div with new HTML and manage history ---
async function updatePage(url: string, html: string, mode: 'push' | 'replace'): Promise<void> {
	if (!contentDiv) return;

	await runDynamicCleanups(); // Run registered cleanup functions

	clearAllListeners(); // Remove old listeners

	// Clear old scripts from previous load
	const oldScripts = contentDiv.querySelectorAll<HTMLScriptElement>('script[src]');
	oldScripts.forEach(script => script.remove());

	contentDiv.innerHTML = html;

	currentUrl = document.getElementById('currentUrl')?.textContent || url;

	const targetUrl = window.location.pathname;
	if ((targetUrl == '/lobby' || targetUrl == '/pong-board') && (!currentUrl.includes('lobby') && !currentUrl.includes('pong-board'))) {
		resetLobby();
	}

	// Update browser history
	if (mode === 'replace')
		history.replaceState(null, '', currentUrl);
	else
		history.pushState(null, '', currentUrl);

	// Execute new scripts
	await executeScripts(contentDiv);
}

export function loadPage(url: string): void {
	fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest', 'accept-language': getUserLang() } })
		.then(res => res.ok ? res.text() : Promise.reject(`HTTP ${res.status}`))
		.then(html => {
			updatePage(url, html, 'push');
		})
		.catch(err => console.error('Fetch error:', err));
}

function resetLobby() {
	if (window.socket) {
		window.socket.close();
	}
	window.socket = undefined;

	window.localPlayerId = undefined;
	window.lobbyGameId = undefined;
	window.pendingGameStart = undefined;
	window.lobbySettings = undefined;

	window.token = "";
	window.playerSyncData = null;

	window.currentUserReady = Promise.resolve();

	window.joinLobby = async () => {};
	window.selectLobbyMode = () => {};
}

// --- Start routing after DOM is loaded ---
document.addEventListener('DOMContentLoaded', setupDynamicRouting);
window.loadPage = loadPage;