declare global {
	interface Window {
		pongTimer: PongTimer;
	}
};

/** ### assertElement
 * Assert that an HTMLElement exists and return it typed.
 * Throws a user-facing error if not found.
 */
function assertElement<T extends HTMLElement | SVGElement>(element: HTMLElement | null, message?: string): T {
	if (!element) {
		window.notify(message || "Element not found", { type: "error" });
		throw new Error(message || "Element not found");
	}
	return (element as T);
}

/* -------------------------------------------------------------------------- */
/*									  TIMER									  */
/* -------------------------------------------------------------------------- */

/** ### PongTimer
 * - interface defining the PongTimer object
 * - includes properties and methods for timer functionality
 * @property seconds total seconds elapsed
 * @property startTimer function to start the timer
 * @property stopTimer function to stop the timer
 * @property updateDisplayFromSeconds function to update the display based on total seconds
 */
export interface PongTimer {
	seconds: number;
	startTimer: () => void;
	stopTimer: () => void;
	updateDisplayFromSeconds: (totalSeconds: number) => void;
}

// MM:SS morphing timer — uses colon squares and JS-controlled blink,

/** ### digitSegments
 * - defines the 7-segment line coordinates for digits 0–9
 * - each digit maps to an array of 7 segments, each segment defined by two points [[x1,y1],[x2,y2]]
 */
const digitSegments: {
	[key: number]: number[][][]
} = {0:[[[0,0],[1,0]],[[1,0],[1,1]],[[1,1],[1,2]],[[1,2],[0,2]],[[0,2],[0,1]],[[0,1],[0,0]],[[0,0],[1,0]]],1:[[[1,0],[1,0]],[[1,0],[1,1]],[[1,1],[1,2]],[[1,2],[1,2]],[[1,2],[1,1]],[[1,1],[1,0]],[[1,0],[1,0]]],2:[[[1,0],[0,0]],[[1,0],[1,1]],[[0,1],[1,1]],[[1,2],[0,2]],[[0,2],[0,1]],[[1,1],[1,0]],[[1,0],[0,0]]],3:[[[1,0],[0,0]],[[1,0],[1,1]],[[1,1],[0,1]],[[0,2],[1,2]],[[1,2],[1,1]],[[1,1],[1,0]],[[1,0],[0,0]]],4:[[[1,0],[1,0]],[[0,0],[0,1]],[[1,1],[0,1]],[[1,2],[1,2]],[[1,2],[1,1]],[[1,1],[1,0]],[[1,0],[1,0]]],5:[[[1,0],[0,0]],[[0,0],[0,1]],[[1,1],[0,1]],[[0,2],[1,2]],[[1,2],[1,1]],[[1,0],[1,0]],[[1,0],[0,0]]],6:[[[1,0],[0,0]],[[0,0],[0,2]],[[1,1],[0,1]],[[0,2],[1,2]],[[1,2],[1,1]],[[0,0],[0,0]],[[1,0],[0,0]]],7:[[[0,0],[1,0]],[[1,0],[1,1]],[[1,1],[1,1]],[[1,2],[1,2]],[[1,2],[1,1]],[[0,0],[0,0]],[[0,0],[1,0]]],8:[[[0,0],[1,0]],[[1,0],[1,2]],[[1,1],[0,1]],[[1,2],[0,2]],[[0,2],[0,1]],[[0,1],[0,0]],[[0,0],[0,0]]],9:[[[0,0],[1,0]],[[1,0],[1,2]],[[1,1],[0,1]],[[1,2],[0,2]],[[0,1],[0,1]],[[0,1],[0,0]],[[0,0],[0,0]]]};

/* configuration */
const NUM_DIGITS = 4;					// MMSS
const COLON_X = 6.2;					// colon translate x
const COLON_MID_Y = 0.9;				// center between top/bottom colon dots (dots at 0 and 1.4)
const DIGIT_VERTICAL_CENTER = 0.5;		// digits internal center (their coordinate mid)
const VERTICAL_ADJUST = COLON_MID_Y - DIGIT_VERTICAL_CENTER; // shift to center digits on colon
const DIGIT_OFFSETS = [-4, -2, 2, 4];	// horizontal offsets relative to colon X
const DISPLAY_SCALE = 1.6;				// scale each digit group

/* DOM refs */
const digitsContainer = assertElement<SVGGElement>(document.getElementById("digits"), "Digits container not found");
const colon = assertElement<SVGElement>(document.getElementById("colon"), "Colon element not found");

/** ### createDigits
 * - initializes the 4-digit SVG display structure
 * - creates groups and segment paths for each digit
 * - sets initial segment shapes to "0"
 */
function createDigits() {
	digitsContainer.innerHTML = "";

	for (let i = 0; i < NUM_DIGITS; i++) {
		// Create a group (<g>) for this digit
		const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
		g.classList.add("digit");

		// Compute the horizontal offset using pre-calculated spacing
		const offsetX = COLON_X + DIGIT_OFFSETS[i];

		// Vertically align the digit relative to the colon
		g.setAttribute(
			"transform",
			`translate(${offsetX} ${VERTICAL_ADJUST}) scale(${DISPLAY_SCALE})`
		);

		// Create the 7 path segments for the digit
		for (let s = 0; s < 7; s++) {
			const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
			p.classList.add("seg" + s); // For debugging / color distinction

			// Initialize each segment to the "0" digit shape
			const init =
				digitSegments[0] && digitSegments[0][s]
					? digitSegments[0][s]
					: [
							[0, 0],
							[0, 0]
						];

			p.setAttribute(
				"d",
				`M${init[0][0]} ${init[0][1]} L${init[1][0]} ${init[1][1]}`
			);
			g.appendChild(p);
		}

		// Add the digit group to the main container
		digitsContainer.appendChild(g);
	}
}


/** ### secondsToMMSS
 * - converts a total number of seconds into a "MMSS" string format
 * @param sec total seconds to convert
 * @returns string in "MMSS" format representing minutes and seconds
 */
function secondsToMMSS(sec: number): string {
	const minutes = Math.floor(sec / 60);
	const seconds = sec % 60;
	return String(minutes).padStart(2, "0") + String(seconds).padStart(2, "0");
}

/** ### updateDisplayFromSeconds
 * - updates the 4-digit SVG display based on a total seconds value
 * @param totalSeconds total seconds to display (0–5999)
 */
function updateDisplayFromSeconds(totalSeconds: number) {
	const mmss = secondsToMMSS(totalSeconds);

	const groups = digitsContainer.querySelectorAll("g.digit");
	// Update each group (each digit)
	groups.forEach((g, idx) => {
		// Get the numeric value of this digit
		const ch = Number(mmss[idx]);

		// Get segment definitions for this digit, fallback to "0"
		const segDefs = digitSegments[ch] || digitSegments[0];

		// Select all segment <path> elements in the group
		const paths = g.querySelectorAll("path");

		// Update each segment line according to the target digit
		paths.forEach((p, sIdx) => {
			const seg = segDefs[sIdx] || [
				[0, 0],
				[0, 0]
			];
			const d = `M${seg[0][0]} ${seg[0][1]} L${seg[1][0]} ${seg[1][1]}`;
			p.setAttribute("d", d);
		});
	});
}

/** ### colonTimeout
 * - timeout ID for colon blink removal
 */
let colonTimeout: number | null = null;

/** ### blinkColon
 * - blinks the colon element by toggling its "active" class
 * @param ms duration in milliseconds for the blink @default 600
 */
function blinkColon(ms = 600) {
	if (!colon) return;
	colon.classList.add("active");
	if (colonTimeout) clearTimeout(colonTimeout);
	colonTimeout = setTimeout(() => colon.classList.remove("active"), ms);
}

// timer state
/** total seconds elapsed for the timer */
let seconds = 0;
/** interval ID for the timer */
let timerId: number | null = null;
/** whether the timer is currently paused */
let paused = false;

/** ### startTimer
 * - starts the timer interval and marks it as running
 */
function startTimer() {
	if (timerId) return;
	timerId = setInterval(() => {
		seconds = (seconds + 1) % 6000;
		updateDisplayFromSeconds(seconds);
		blinkColon();
	}, 1000);
	paused = false;
}

/** ### stopTimer
 * - stops the timer interval and marks it as paused
 */
function stopTimer() {
	if (timerId) {
		clearInterval(timerId);
		timerId = null;
	}
	paused = true;
}

// Initialize the digit display structure
createDigits();

// Export the PongTimer object
export const pongTimer: PongTimer = {
	seconds,
	startTimer,
	stopTimer,
	updateDisplayFromSeconds
};

window.pongTimer = pongTimer;
