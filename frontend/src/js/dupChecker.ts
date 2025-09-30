export {};

declare global {
	interface Window {
		/**
		 * Flag indicating if the full page (HTML, head, body, scripts) has been loaded.
		 * This variable is set in the base page template.
		 * It allows us to detect if the current content was loaded dynamically (via AJAX)
		 * or if the full page has been rendered by the browser.
		 */
		isFullPageLoaded?: boolean;
	}
}

/**
 * On DOMContentLoaded, check whether the full page was loaded or just dynamic content.
 * 
 * Why this matters:
 * - If the user duplicates a tab (right click → duplicate), the browser may restore
 *   the URL but only inject the dynamic AJAX content, not the full page as it copies with headers the last request.
 * - In that case, some scripts or CSS might be missing, causing broken UI or errors.
 * - By checking `window.isFullPageLoaded`, we can detect this situation and force a full reload
 *   to ensure the page is properly initialized.
 */
document.addEventListener('DOMContentLoaded', () => {
	if (!window.isFullPageLoaded) {
		// Force a full page reload to make sure all assets, scripts, and head content are loaded
		window.location.reload();
	}
});
