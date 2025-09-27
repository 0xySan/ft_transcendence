export {};

// Global listeners array to track dynamically added event listeners
declare global {
	var listeners: Listener[];
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
	initializeForms(forms);

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
		fetch(url.href, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
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
			fetch(url.href, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
				.then(res => res.text())
				.then(html => updatePage(url.href, html, 'replace'))
				.catch(err => console.error('Fetch error on popstate:', err));
		}
	});

	// Initialize forms already present in DOM
	const forms = document.querySelectorAll<HTMLFormElement>('form');
	initializeForms(forms);
}

// --- Update the #content div with new HTML and manage history ---
async function updatePage(url: string, html: string, mode: 'push' | 'replace'): Promise<void> {
	if (!contentDiv) return;

	clearAllListeners(); // Remove old listeners

	// Clear old scripts from previous load
	const oldScripts = contentDiv.querySelectorAll<HTMLScriptElement>('script[src]');
	oldScripts.forEach(script => script.remove());

	contentDiv.innerHTML = html;

	currentUrl = document.getElementById('currentUrl')?.textContent || url;

	// Update browser history
	if (mode === 'replace') {
		history.replaceState(null, '', currentUrl);
	} else {
		history.pushState(null, '', currentUrl);
	}

	// Execute new scripts
	await executeScripts(contentDiv);
}

// --- Attach dynamic AJAX submission for forms ---
function initializeForms(forms: NodeListOf<HTMLFormElement>): void {
	forms.forEach(form => {
		const submitHandler = (e: Event) => {
			e.preventDefault();

			// Collect form data as JSON
			const data: Record<string, string> = {};
			new FormData(form).forEach((value, key) => {
				data[key] = value.toString();
			});

			fetch(form.action, {
				method: form.method,
				body: JSON.stringify(data),
				headers: {
					'Content-Type': 'application/json',
					'X-Requested-With': 'XMLHttpRequest'
				}
			})
				.then(res => res.ok ? res.text() : Promise.reject(`HTTP ${res.status}`))
				.then(html => {
					updatePage(form.action, html, 'push');
				})
				.catch(err => console.error('Fetch error:', err));
		};

		form.addEventListener('submit', submitHandler);
		listeners.push({ element: form, type: 'submit', callback: submitHandler });
	});
}

// --- Start routing after DOM is loaded ---
document.addEventListener('DOMContentLoaded', setupDynamicRouting);
