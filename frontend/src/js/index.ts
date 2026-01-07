export {};

// ---- Types ----

/**
 * Animation path definitions
 * @contains :
 * 	- morph: Morph target values
 * 	- dur: Duration in seconds (optional)
 * 	- rot: Rotation from/to values
 */
type t_animMorph = {
	morph: string;
	dur?: number;
};

/**
 * Animation rotation definitions
 * @contains :
 * 	- rot: [from, to] rotation values
 * 	- morph: Morph target values
 */
type t_animRot = {
	rot: [string, string];
	morph: string;
};

/**
 * Animation paths for all 3 SVG paths
 * @contains :
 * 	- p1: Path 1 animation definitions
 * 	- p2: Path 2 animation definitions
 * 	- p3: Path 3 animation definitions
 */
type t_animPaths = {
	p1: t_animMorph;
	p2: t_animRot;
	p3: t_animRot;
};

/**
 * Animation definitions for "forward" (menu open) action
 */
const ANIM_FORWARD: t_animPaths = {
	p1: { morph: "M 17 21 A 4 4 90 0 0 25 21 A 4 4 90 0 0 17 21;M 1 21 A 4 4 90 0 0 41 21 A 4 4 90 0 0 1 21", dur: 0.2 },
	p2: { rot: ["0 21 21", "225 21 21"], morph: "M 17 9 C 17 13 21 13 21 13 C 25 13 25 9 25 9 C 25 5 21 5 21 5 C 17 5 17 9 17 9;M 18 9 C 18 9 18 33 18 33 C 18 37 24 37 24 33 C 24 33 24 9 24 9 C 24 4 18 4 18 9" },
	p3: { rot: ["0 21 21", "135 21 21"], morph: "M 17 33 C 17 37 21 37 21 37 C 25 37 25 33 25 33 C 25 29 21 29 21 29 C 17 29 17 33 17 33;M 18 33 C 18 38 24 38 24 33 C 24 33 24 9 24 9 C 24 4 18 4 18 9 C 18 9 18 33 18 33" },
};

// ---- Utils ----

/**
 * Reverses semicolon-separated SVG animation values
 * @param values - Semicolon-separated values string
 * @returns Reversed values string
 */
export function reverseValues(values: string): string {
	const parts = values.split(";");
	return parts.reverse().join(";");
}

/**
 * Waits for the end of an SVG animation or a timeout
 * @param animEl - SVGAnimationElement to wait for
 * @param durationSec - Duration in seconds to wait before timeout
 * @returns Promise that resolves when the animation ends or timeout occurs
 */
export function waitForEnd(animEl: SVGAnimationElement | null, durationSec: number): Promise<void> {
	return new Promise((resolve) => {
		if (!animEl) return resolve();
		let doneFlag = false;
		function endHandler() {
			if (doneFlag) return;
			doneFlag = true;
			resolve();
		}
		animEl.addEventListener("endEvent", endHandler);
		setTimeout(endHandler, Math.ceil(durationSec * 1000) + 60);
	});
}

// ---- Path class ----

/**
 * Class representing an SVG path with associated animations and color states
 */
class SvgPath {
	private readonly el: SVGPathElement;
	private readonly morphEl?: SVGAnimationElement;
	private readonly rotEl?: SVGAnimationElement;
	private readonly defaultVar: string;
	private readonly altVar: string;

	/**
	 * Constructor
	 * @param id - SVG path element ID
	 * @param colorDefault - Default color CSS variable
	 * @param colorAlt - Alternate color CSS variable
	 * @param morphId - SVG animation element ID for morphing (optional)
	 * @param rotId - SVG animation element ID for rotation (optional)
	 */
	constructor(id: string, colorDefault: string, colorAlt: string, morphId?: string, rotId?: string) {
		const elem = document.getElementById(id) as SVGPathElement | null;
		if (!elem) throw new Error(`SVG path element with id "${id}" not found`);
		this.el = elem;
		this.morphEl = morphId ? document.getElementById(morphId) as SVGAnimationElement | null ?? undefined : undefined;
		this.rotEl = rotId ? document.getElementById(rotId) as SVGAnimationElement | null ?? undefined : undefined;
		this.defaultVar = colorDefault;
		this.altVar = colorAlt;
		this.setColorDefault();
	}

	/**
	 * Gets the SVG path element
	 */
	get element(): SVGPathElement { return this.el; }

	/**
	 * Gets the SVG morph animation element
	 * @throws Error if morphEl is undefined
	 */
	get morph(): SVGAnimationElement {
		if (!this.morphEl) throw new Error(`SVG morph element not found`);
		return this.morphEl;
	}

	/**
	 * Gets the SVG rotation animation element
	 * @throws Error if rotEl is undefined
	 */
	get rot(): SVGAnimationElement {
		if (!this.rotEl) throw new Error(`SVG rotation element not found`);
		return this.rotEl;
	}

	/** Sets the path color to the default color */
	setColorDefault(): void { this.el.style.fill = `rgb(var(${this.defaultVar}))`; }
	/** Sets the path color to the alternate color */
	setColorAlt(): void { this.el.style.fill = `rgb(var(${this.altVar}))`; }

	/**
	 * Toggles the path color between default and alternate
	 * @param isAlt - If true, sets to alternate color; otherwise, sets to default color
	 */
	toggleColor(isAlt: boolean): void { isAlt ? this.setColorAlt() : this.setColorDefault(); }
}


// ---- Init ----

/**
 * Initializes the SVG menu animation and event listeners
 * @returns void
 */
function initAnimation(): void {
	const svg = document.getElementById("nav-menu-svg") as SVGSVGElement | null;
	const menuLinks = document.getElementById("nav-left-links") as HTMLDivElement | null;
	if (!svg || !menuLinks) return;

	const p1 = new SvgPath("nav-menu-p1", "--text", "--surface0", "nav-menu-p1-morph");
	const p2 = new SvgPath("nav-menu-p2", "--text", "--red", "nav-menu-p2-morph", "nav-menu-p2-rot");
	const p3 = new SvgPath("nav-menu-p3", "--text", "--red", "nav-menu-p3-morph", "nav-menu-p3-rot");

	let toggled = false;

	svg.addEventListener("click", async () => {
		if (!toggled) {
			menuLinks.classList.add("nav-links-visible");
			p1.toggleColor(!toggled);
			

			p1.morph?.setAttribute("values", ANIM_FORWARD.p1.morph);
			p2.rot?.setAttribute("from", ANIM_FORWARD.p2.rot[0]);
			p2.rot?.setAttribute("to", ANIM_FORWARD.p2.rot[1]);
			p3.rot?.setAttribute("from", ANIM_FORWARD.p3.rot[0]);
			p3.rot?.setAttribute("to", ANIM_FORWARD.p3.rot[1]);

			p1.morph?.beginElement();
			p2.rot?.beginElement();
			p3.rot?.beginElement();

			await Promise.all([waitForEnd(p2.rot, 0.2), waitForEnd(p3.rot, 0.2)]);

			p2.toggleColor(!toggled);
			p3.toggleColor(!toggled);

			p2.morph?.setAttribute("values", ANIM_FORWARD.p2.morph);
			p3.morph?.setAttribute("values", ANIM_FORWARD.p3.morph);

			p2.morph?.beginElement();
			p3.morph?.beginElement();

			await Promise.all([waitForEnd(p2.morph, 0.1), waitForEnd(p3.morph, 0.1)]);
		} else {
			menuLinks.classList.remove("nav-links-visible");
			p2.morph?.setAttribute("values", reverseValues(ANIM_FORWARD.p2.morph));
			p3.morph?.setAttribute("values", reverseValues(ANIM_FORWARD.p3.morph));

			p2.morph?.beginElement();
			p3.morph?.beginElement();

			await Promise.all([waitForEnd(p2.morph, 0.1), waitForEnd(p3.morph, 0.1)]);

			p2.toggleColor(!toggled);
			p3.toggleColor(!toggled);

			p2.rot?.setAttribute("from", ANIM_FORWARD.p2.rot[1]);
			p2.rot?.setAttribute("to", ANIM_FORWARD.p2.rot[0]);
			p3.rot?.setAttribute("from", ANIM_FORWARD.p3.rot[1]);
			p3.rot?.setAttribute("to", ANIM_FORWARD.p3.rot[0]);

			p2.rot?.beginElement();
			p3.rot?.beginElement();

			p1.morph?.setAttribute("values", reverseValues(ANIM_FORWARD.p1.morph));
			p1.morph?.beginElement();

			await waitForEnd(p1.morph, 0.2);

			p1.toggleColor(!toggled);
			
		}

		toggled = !toggled;
	});
}

initAnimation();

// =========================================================
// 				        CHAT INTEGRATION
// =========================================================

const chatContainer = document.getElementById("chat-index-container") as HTMLDivElement;
if (!chatContainer) throw new Error("Chat container not found");

const chatWindow = chatContainer.querySelector(".chat-window") as HTMLDivElement;
const chatBar = chatWindow.querySelector(".chat-window-bar") as HTMLDivElement;

// --- Resize ---
type ResizeType = "right" | "bottom" | "corner";

let isResizing = false;
let resizeType: ResizeType | null = null;
let startX = 0;
let startY = 0;
let startWidth = 0;
let startHeight = 0;

function startResize(e: MouseEvent, type: ResizeType): void {
	e.preventDefault();
	isResizing = true;
	resizeType = type;

	startX = e.clientX;
	startY = e.clientY;

	const rect = chatContainer.getBoundingClientRect();
	startWidth = rect.width;
	startHeight = rect.height;

	document.addEventListener("mousemove", resizeMove);
	document.addEventListener("mouseup", stopResize);
}

function resizeMove(e: MouseEvent): void {
	if (!isResizing || !resizeType) return;

	const minWidth = 260;
	const minHeight = 220;

	if (resizeType === "right" || resizeType === "corner") {
		const newWidth = Math.max(minWidth, startWidth + (e.clientX - startX));
		chatContainer.style.width = `${newWidth}px`;
	}

	if (resizeType === "bottom" || resizeType === "corner") {
		const newHeight = Math.max(minHeight, startHeight + (e.clientY - startY));
		chatContainer.style.height = `${newHeight}px`;
	}
}

function stopResize(): void {
	isResizing = false;
	resizeType = null;
	document.removeEventListener("mousemove", resizeMove);
	document.removeEventListener("mouseup", stopResize);
}

// Assign resize handlers
const rightHandle = chatContainer.querySelector(".resize-right");
const bottomHandle = chatContainer.querySelector(".resize-bottom");
const cornerHandle = chatContainer.querySelector(".resize-corner");

rightHandle?.addEventListener("mousedown", e => startResize(e as MouseEvent, "right"));
bottomHandle?.addEventListener("mousedown", e => startResize(e as MouseEvent, "bottom"));
cornerHandle?.addEventListener("mousedown", e => startResize(e as MouseEvent, "corner"));

// --- Drag ---
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let containerStartLeft = 0;
let containerStartTop = 0;

chatBar.addEventListener("mousedown", (e: MouseEvent) => {
	e.preventDefault();
	isDragging = true;
	dragStartX = e.clientX;
	dragStartY = e.clientY;

	const rect = chatContainer.getBoundingClientRect();
	containerStartLeft = rect.left;
	containerStartTop = rect.top;

	document.addEventListener("mousemove", dragMove);
	document.addEventListener("mouseup", stopDrag);
});

function keepChatInBounds() {
	const rect = chatContainer.getBoundingClientRect();

	// limites max
	const maxLeft = window.innerWidth - rect.width;
	const maxTop = window.innerHeight - 40;

	// Check if chat exceeds window bounds
	if (rect.width > window.innerWidth)
		chatContainer.style.width = `${window.innerWidth}px`;
	if (rect.height > window.innerHeight - 40)
		chatContainer.style.height = `${window.innerHeight - 40}px`;

	chatContainer.dataset.prevWidth = `${chatContainer.offsetWidth}`;
	chatContainer.dataset.prevHeight = `${chatContainer.offsetHeight}`;

	let newLeft = Math.min(Math.max(0, rect.left), maxLeft);
	let newTop = Math.min(Math.max(0, rect.top), maxTop);

	if (newLeft !== rect.left) chatContainer.style.left = `${newLeft}px`;
	if (newTop !== rect.top) chatContainer.style.top = `${newTop}px`;
}

window.addEventListener("resize", keepChatInBounds); // keep chat in bounds on window resize

function dragMove(e: MouseEvent): void {
	if (!isDragging) return;

	const dx = e.clientX - dragStartX;
	const dy = e.clientY - dragStartY;

	// Calculate new position
	let newLeft = containerStartLeft + dx;
	let newTop = containerStartTop + dy;

	// Stop from going out of bounds
	const maxLeft = window.innerWidth - chatContainer.offsetWidth;
	const maxTop = window.innerHeight - 40; // 40px = title bar height

	newLeft = Math.min(Math.max(0, newLeft), maxLeft);
	newTop = Math.min(Math.max(0, newTop), maxTop);

	chatContainer.style.left = `${newLeft}px`;
	chatContainer.style.top = `${newTop}px`;
}

function stopDrag(): void {
	isDragging = false;
	document.removeEventListener("mousemove", dragMove);
	document.removeEventListener("mouseup", stopDrag);
}

// --- Minimize / Maximize ---
chatWindow.querySelectorAll<HTMLButtonElement>(".chat-window-btn").forEach(btn => {
	btn.addEventListener("click", () => {
		const action = btn.dataset.action;
		if (!action) return;

		if (action === "minimize")
			chatWindow.classList.toggle("minimized");
		else if (action === "maximize") {
			if (!chatContainer.dataset.prevWidth) {
				const rect = chatContainer.getBoundingClientRect();
				chatContainer.dataset.prevWidth = `${rect.width}`;
				chatContainer.dataset.prevHeight = `${rect.height}`;
				chatContainer.dataset.prevLeft = `${rect.left}`;
				chatContainer.dataset.prevTop = `${rect.top}`;
			}

			if (chatContainer.classList.toggle("maximized")) {
				chatContainer.style.width = "100%";
				chatContainer.style.height = "calc(100% - 5rem)";
				chatContainer.style.left = "0";
				chatContainer.style.top = "5rem";
			} else {
				chatContainer.style.width = `${chatContainer.dataset.prevWidth}px`;
				chatContainer.style.height = `${chatContainer.dataset.prevHeight}px`;
				chatContainer.style.left = `${chatContainer.dataset.prevLeft}px`;
				chatContainer.style.top = `${chatContainer.dataset.prevTop}px`;
			}
		}
	});
});


// =========================================================
// 						THEME  CHANGER
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
	const switcher = document.querySelector<HTMLDivElement>('#theme-switcher');
	if (!switcher) return;

	switcher.addEventListener('click', (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		const btn = target.closest<HTMLElement>('.theme-btn');
		if (!btn) return;

		const buttons = switcher.querySelectorAll<HTMLElement>('.theme-btn');
		buttons.forEach((b) => b.classList.remove('active'));

		btn.classList.add('active');
		const selectedTheme = btn.getAttribute('data-theme');
		if (selectedTheme)
			document.documentElement.setAttribute('data-theme', selectedTheme);
	});

	const observer = new MutationObserver(() => {
		const currentTheme = document.documentElement.getAttribute('data-theme');
		const buttons = switcher.querySelectorAll<HTMLElement>('.theme-btn');
		buttons.forEach((btn) => {
			if (btn.getAttribute('data-theme') === currentTheme)
				btn.classList.add('active');
			else
				btn.classList.remove('active');
		});
	});

	observer.observe(switcher, { childList: true, subtree: true });
});
