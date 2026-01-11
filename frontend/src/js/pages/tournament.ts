/**
 * ### Tournament Page Script
 * This script handles the interactive map functionality for the tournament page,
 * including panning and zooming features.
 */

/** ### addListener
 * Adds an event listener to a target element if the target is not null.
 * @param target - The target element to which the event listener will be added.
 * @param event - The event type to listen for.
 * @param handler - The event handler function.
 */
declare function addListener(target: EventTarget | null, event: string, handler: EventListenerOrEventListenerObject): void;

/**
 * ### Element Selection
 */

/** ### mapContainer
 * The container element for the tournament map.
 */
const mapContainer: HTMLDivElement | null = document.getElementById("tournament-map-container") as HTMLDivElement | null;

/** ### tournamentMap
 * The tournament map element.
 */
const tournamentMap: HTMLDivElement | null = document.getElementById("tournament-map") as HTMLDivElement | null;

if (!mapContainer || !tournamentMap)
	throw new Error("Missing element for tournament page");

/* ==================================================================
								Interfaces
   ================================================================== */

/** ### DragState
 * Interface representing the state of dragging.
 * Contains:
 * - **isDragging**: `boolean` indicating if dragging is active.
 * - **startX**: `number` representing the starting X coordinate.
 * - **startY**: `number` representing the starting Y coordinate.
 * - **offsetX**: `number` representing the current X offset.
 * - **offsetY**: `number` representing the current Y offset.
 */
interface DragState {
	isDragging: boolean;
	startX: number;
	startY: number;
	offsetX: number;
	offsetY: number;
}


/** ### ZoomState
 * Interface representing the state of zooming.
 * Contains:
 * - **scale**: `number` representing the current zoom scale.
 * - **minScale**: `number` representing the minimum zoom scale.
 * - **maxScale**: `number` representing the maximum zoom scale.
 */
interface ZoomState {
	scale:		number;
	minScale:	number;
	maxScale:	number;
}

/** ### mapState
 * Interface representing the overall state of the map.
 * Contains:
 * - **container**: `HTMLDivElement` representing the map container element.
 * - **map**: `HTMLDivElement` representing the map element.
 * - **drag**: `DragState` representing the dragging state.
 * - **zoom**: `ZoomState` representing the zooming state.
 */
interface mapState {
	container:	HTMLDivElement,
	map:		HTMLDivElement,
	drag:		DragState;
	zoom:		ZoomState;
}

// ----------------------- Pinch State for Mobile --------------------------------

/** ### PinchState
 * Interface representing the state of a pinch gesture.
 * Contains:
 * - **isPinching**: `boolean` indicating if a pinch gesture is active.
 * - **initialDistance**: `number` representing the initial distance between touch points.
 * - **initialScale**: `number` representing the initial zoom scale at the start of the pinch.
 * - **initialOffsetX**: `number` representing the initial X offset at the start of the pinch.
 * - **initialOffsetY**: `number` representing the initial Y offset at the start of the pinch.
 * - **initialCenterX**: `number` representing the initial center X coordinate of the pinch.
 * - **initialCenterY**: `number` representing the initial center Y coordinate of the pinch.
 */
interface PinchState {
	isPinching: boolean;
	initialDistance: number;
	initialScale: number;
	initialOffsetX: number;
	initialOffsetY: number;
	initialCenterX: number;
	initialCenterY: number;
}

// ----------------------- Tournament interfaces --------------------------------

/** ### tournamentPlayer
 * Interface representing a player in the tournament.
 * Contains:
 * - **id**: `number` representing the player's ID.
 * - **name**: `string` representing the player's name.
 * - **rank**: `number` representing the player's rank.
 */
interface tournamentPlayer {
	id:		number;
	name:	string;
	rank:	number;
}

/** ### MatchSlot
 * Interface representing a match slot in the tournament bracket.
 * Contains:
 * - **p1**: `tournamentPlayer | null` representing the first player in the match.
 * - **p2**: `tournamentPlayer | null` representing the second player in the match.
 * - **number**: `number` representing the match number within the round (1-based).
 * - **globalId**: `number` representing the unique global match ID (1-based).
 */
type MatchSlot = {
	p1: tournamentPlayer | null;
	p2: tournamentPlayer | null;
	number: number;		// number within this round (1-based)
	globalId: number;	// unique global match id (1-based)
};

// ----------------------- Player drag interfaces --------------------------------

/** ### PlayerDragState
 * Interface representing the drag-and-drop state of the player list.
 * Contains all runtime data required to manage a reorder interaction.
 * - **isDragging**: `boolean` indicating if a drag operation is in progress.
 * - **dragStarted**: `boolean` indicating if the drag has officially started (after threshold).
 * - **draggedIndex**: `number` representing the index of the player being dragged.
 * - **pointerId**: `number | null` representing the pointer ID for the drag operation.
 * - **startY**: `number` representing the starting Y coordinate of the drag.
 * - **offsetY**: `number` representing the Y offset between pointer and element top.
 * - **lastPointerY**: `number` representing the last recorded Y coordinate of the pointer.
 * - **ghostElem**: `HTMLLIElement | null` representing the floating ghost element during drag.
 * - **placeholderElem**: `HTMLLIElement | null` representing the placeholder element in the list.
 */
interface PlayerDragState {
	isDragging: boolean;
	dragStarted: boolean;
	draggedIndex: number;
	pointerId: number | null;
	startY: number;
	offsetY: number;
	lastPointerY: number;
	ghostElem: HTMLLIElement | null;
	placeholderElem: HTMLLIElement | null;
}

/* ==================================================================
							PAN & ZOOM FUNCTIONS
   ================================================================== */

/** ### mapState Object
 * Object implementing the `mapState` interface to hold the current state of the map.
 */
const mapState: mapState = {
	container:	mapContainer,
	map:		tournamentMap,
	drag: 		{
					isDragging: false,
					startX: 0,
					startY: 0,
					offsetX: 0,
					offsetY: 0,
				},
	zoom:		{
					scale: 1,
					minScale: 0.2,
					maxScale: 5,
				},
};

/** ### applyTransform
 * Applies the current translation and scaling to the tournament map element.
 * Uses CSS transforms to update the map's position and zoom level.
 * With matrix(a, b, c, d, e, f):
 * - a = scaleX
 * - b = skewY
 * - c = skewX
 * - d = scaleY
 * - e = translateX
 * - f = translateY
 *
 * This function is called whenever the drag or zoom state changes.
 */
function applyTransform(): void {
	mapState.map.style.transformOrigin = "0 0";
	mapState.map.style.transform =
		`matrix(${mapState.zoom.scale}, 0, 0,
		${mapState.zoom.scale},
		${mapState.drag.offsetX},
		${mapState.drag.offsetY})`;
}


/** ### startDrag
 * Initiates dragging of the map.
 * @param event - The mouse or touch event that started the drag.
 */
function startDrag(event: Event): void {
	event.preventDefault();

	const e = event instanceof MouseEvent
		? event
		: (event as TouchEvent).touches[0];

	mapState.drag.isDragging = true;
	mapState.drag.startX = e.clientX;
	mapState.drag.startY = e.clientY;
}

/** ### onDrag
 * Handles the dragging of the map.
 * @param event - The mouse or touch event during the drag.
 */
function onDrag(event: Event): void {
	if (!mapState.drag.isDragging)
		return;

	event.preventDefault();

	const e = event instanceof MouseEvent
		? event
		: (event as TouchEvent).touches[0];

	const dx = e.clientX - mapState.drag.startX;
	const dy = e.clientY - mapState.drag.startY;

	mapState.drag.offsetX += dx;
	mapState.drag.offsetY += dy;

	mapState.drag.startX = e.clientX;
	mapState.drag.startY = e.clientY;

	applyTransform();
}

/** ### endDrag
 * Ends the dragging of the map.
 */
function endDrag() {
	mapState.drag.isDragging = false;
}

/** ### onZoom
 * Handles zooming of the map.
 * - Zooms in or out based on the mouse wheel delta.
 * - Adjusts the map's offset to keep the zoom centered around the mouse position.
 * @param event - The wheel event for zooming.
 */
function onZoom(event: Event): void {
	event.preventDefault();

	const e = event as WheelEvent;
	const rect = mapState.container.getBoundingClientRect();

	const mouseX = e.clientX - rect.left;
	const mouseY = e.clientY - rect.top;

	const oldScale = mapState.zoom.scale;
	const zoomFactor = 1.1;
	const direction = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;

	let newScale = oldScale * direction;
	newScale = Math.min(
		Math.max(newScale, mapState.zoom.minScale),
		mapState.zoom.maxScale
	);

	if (newScale === oldScale)
		return;

	/**
	 *	PANZOOM FORMULA:
	 *		newOffset = mouse - (mouse - oldOffset) * (newScale / oldScale)
	*/
	mapState.drag.offsetX =
		mouseX - (mouseX - mapState.drag.offsetX) * (newScale / oldScale);
	mapState.drag.offsetY =
		mouseY - (mouseY - mapState.drag.offsetY) * (newScale / oldScale);

	mapState.zoom.scale = newScale;

	applyTransform();
}

// ------------------------------- Mobile Adapations ----------------------------------

/** ### pinchState
 * Object holding the state of pinch gestures.
 */
const pinchState: PinchState = {
	isPinching: false,
	initialDistance: 0,
	initialScale: 1,
	initialOffsetX: 0,
	initialOffsetY: 0,
	initialCenterX: 0,
	initialCenterY: 0
};

/** ### getDistance
 * Calculates the distance between two touch points.
 * 
 * @param touch1 - The first touch point.
 * @param touch2 - The second touch point.
 * @returns The distance between the two touch points.
 */
function getDistance(touch1: Touch, touch2: Touch): number {
	const dx = touch2.clientX - touch1.clientX;
	const dy = touch2.clientY - touch1.clientY;
	return Math.sqrt(dx * dx + dy * dy);
}

/** ### getMidpoint
 * Calculates the midpoint between two touch points relative to the container.
 * 
 * @param touch1 - The first touch point.
 * @param touch2 - The second touch point.
 * @returns The midpoint coordinates relative to the container.
 */
function getMidpoint(touch1: Touch, touch2: Touch): { x: number, y: number } {
	const rect = mapState.container.getBoundingClientRect();
	return {
		x: ((touch1.clientX + touch2.clientX) / 2) - rect.left,
		y: ((touch1.clientY + touch2.clientY) / 2) - rect.top
	};
}

/** ### onTouchStart
 * Handles the touch start event for mobile devices.
 * 
 * @param event - The touch event.
 */
function onTouchStart(event: Event): void {
	const touchEvent = event as TouchEvent;
	
	if (touchEvent.touches.length === 2) {
		// Start pinch gesture
		event.preventDefault();
		
		const touch1 = touchEvent.touches[0];
		const touch2 = touchEvent.touches[1];
		
		pinchState.isPinching = true;
		pinchState.initialDistance = getDistance(touch1, touch2);
		pinchState.initialScale = mapState.zoom.scale;
		pinchState.initialOffsetX = mapState.drag.offsetX;
		pinchState.initialOffsetY = mapState.drag.offsetY;
		
		const midpoint = getMidpoint(touch1, touch2);
		pinchState.initialCenterX = midpoint.x;
		pinchState.initialCenterY = midpoint.y;
		
		// Disable dragging during pinch
		mapState.drag.isDragging = false;
	} else if (touchEvent.touches.length === 1) {
		// Start drag gesture
		startDrag(event);
	}
}

/** ### onTouchMove
 * Handles the touch move event for mobile devices.
 * 
 * @param event - The touch event.
 */
function onTouchMove(event: Event): void {
	const touchEvent = event as TouchEvent;
	
	if (pinchState.isPinching && touchEvent.touches.length === 2) {
		event.preventDefault();
		
		const touch1 = touchEvent.touches[0];
		const touch2 = touchEvent.touches[1];
		
		// Calculate current distance and midpoint
		const currentDistance = getDistance(touch1, touch2);
		const currentMidpoint = getMidpoint(touch1, touch2);
		
		// Avoid division by zero and very small distances
		if (currentDistance < 10 || pinchState.initialDistance < 10) return;
		
		// Calculate scale factor based on distance ratio
		const scaleFactor = currentDistance / pinchState.initialDistance;
		const newScale = Math.min(
			Math.max(pinchState.initialScale * scaleFactor, mapState.zoom.minScale),
			mapState.zoom.maxScale
		);
		
		// Calculate the difference from initial midpoint
		const deltaX = currentMidpoint.x - pinchState.initialCenterX;
		const deltaY = currentMidpoint.y - pinchState.initialCenterY;
		
		// Apply the same panzoom formula but account for initial state
		mapState.drag.offsetX = pinchState.initialOffsetX + deltaX;
		mapState.drag.offsetY = pinchState.initialOffsetY + deltaY;
		
		// Adjust offset for zoom centered on initial midpoint
		mapState.drag.offsetX = pinchState.initialCenterX - 
			(pinchState.initialCenterX - mapState.drag.offsetX) * 
			(newScale / pinchState.initialScale);
		mapState.drag.offsetY = pinchState.initialCenterY - 
			(pinchState.initialCenterY - mapState.drag.offsetY) * 
			(newScale / pinchState.initialScale);
		
		mapState.zoom.scale = newScale;
		applyTransform();
	} else if (touchEvent.touches.length === 1 && mapState.drag.isDragging) {
		// Continue drag gesture
		onDrag(event);
	} else if (touchEvent.touches.length === 1) {
		// Single touch but not dragging (just moving)
		event.preventDefault();
	}
}

/** ### onTouchEnd
 * Handles the touch end event for mobile devices.
 * 
 * @param event - The touch event.
 */
function onTouchEnd(event: Event): void {
	const touchEvent = event as TouchEvent;
	
	if (pinchState.isPinching && touchEvent.touches.length < 2) {
		// End pinch gesture
		pinchState.isPinching = false;
		pinchState.initialDistance = 0;
		pinchState.initialScale = 1;
		pinchState.initialOffsetX = 0;
		pinchState.initialOffsetY = 0;
		pinchState.initialCenterX = 0;
		pinchState.initialCenterY = 0;
	}
	
	if (touchEvent.touches.length === 0) {
		// No more touches, end drag
		endDrag();
	} else if (touchEvent.touches.length === 1) {
		// Still one touch (could be dragging or about to drag)
		// Reset drag state to allow new drag to start
		mapState.drag.isDragging = false;
	}
}

/** ### onTouchCancel
 * Handles the touch cancel event for mobile devices.
 * 
 * @param event - The touch event.
 */
function onTouchCancel(event: Event): void {
	pinchState.isPinching = false;
	endDrag();
}


/* ==================================================================
						PLAYER LIST FUNCTIONS
   ================================================================== */

/** ### playerListElem
 * The unordered list element for displaying tournament players.
 */
const playerListElem: HTMLUListElement | null = document.getElementById("tournament-player-list") as HTMLUListElement | null;

/** ### playerListTemplate
 * The HTML template element for a tournament player list item.
 */
const playerListTemplate: HTMLTemplateElement | null = document.getElementById("player-list-item-template") as HTMLTemplateElement | null;

if (!playerListElem || !playerListTemplate)
	throw new Error("Missing player list element for tournament page");

/** ### updatePlayerList
 * Updates the player list in the tournament page.
 * @param players - An array of `tournamentPlayer` objects representing the players.
 */
function updatePlayerList(players: tournamentPlayer[]): void {
	playersState = players.slice();
	playerListElem!.innerHTML = "";

	playersState.forEach((player, index) => {
		const fragment = playerListTemplate!.content.cloneNode(true) as HTMLElement;
		const item = fragment.querySelector(".player-list-item") as HTMLLIElement;

		const nameElem = item.querySelector(".player-name") as HTMLElement;
		const rankElem = item.querySelector(".player-rank") as HTMLElement;

		nameElem.textContent = player.name;
		rankElem.textContent = `Rank: ${player.rank}`;

		item.dataset.index = String(index);

		addListener(item, "pointerdown", onPlayerPointerDown);
		playerListElem!.appendChild(item);
	});
}

/* ==================================================================
						BRACKET MATCH FUNCTIONS
   ================================================================== */

   
/** ### roundTemplate
 * The HTML template element for a tournament round.
 */
const roundTemplate: HTMLTemplateElement | null = document.getElementById("round-template") as HTMLTemplateElement | null;

/** ### bracketMatchTemplate
 * The HTML template element for a bracket match.
 */
const bracketMatchTemplate: HTMLTemplateElement | null = document.getElementById("match-bracket-template") as HTMLTemplateElement | null;

/** ### connectorSvgTemplate
 * The HTML template element for the SVG connectors.
 */
const connectorSvgTemplate: HTMLTemplateElement | null = document.getElementById("connector-svg-template") as HTMLTemplateElement | null;

/** ### roundsWrapper
 * The div element that wraps all tournament rounds.
 */
const roundsWrapper: HTMLDivElement | null = document.getElementById("rounds-wrapper") as HTMLDivElement | null;

if (!roundTemplate || !bracketMatchTemplate || !connectorSvgTemplate || !roundsWrapper)
	throw new Error("Missing bracket template element for tournament page");

/** ### createBracketMatch
 * Creates a bracket match element.
 * @param slot - The `MatchSlot` object containing player information.
 * @param placeholderLeft - Optional placeholder text for the left player if absent.
 * @param placeholderRight - Optional placeholder text for the right player if absent.
 * @returns The created match HTMLElement.
 */
function createBracketMatch(slot: MatchSlot, placeholderLeft?: string, placeholderRight?: string): HTMLElement {
	const matchElem = bracketMatchTemplate!.content.cloneNode(true) as HTMLElement;
	const container = matchElem.querySelector(".match-bracket") as HTMLElement;

	// ensure score spans exist in template: .match-score1 / .match-score2
	const player1Elem = container.querySelector(".match-player1") as HTMLElement;
	const player2Elem = container.querySelector(".match-player2") as HTMLElement;
	const score1Elem = container.querySelector(".match-score1") as HTMLElement | null;
	const score2Elem = container.querySelector(".match-score2") as HTMLElement | null;

	// set names or placeholders
	if (slot.p1) player1Elem.textContent = slot.p1.name;
	else player1Elem.textContent = placeholderLeft ?? "TBD";

	if (slot.p2) player2Elem.textContent = slot.p2.name;
	else player2Elem.textContent = placeholderRight ?? "TBD";

	// default scores
	if (score1Elem) score1Elem.textContent = "-";
	if (score2Elem) score2Elem.textContent = "-";

	// match global number at left
	const numberElem = document.createElement("span");
	numberElem.className = "match-number";
	numberElem.textContent = String(slot.globalId);
	container.prepend(numberElem);

	return container;
}

/** ### nextPowerOfTwo
 * Calculates the next power of two greater than or equal to the given number.
 * @param v - The input number.
 * @returns The next power of two.
 */
function nextPowerOfTwo(v: number): number {
	let n = 1;
	while (n < v) n <<= 1;
	return n;
}

/** ### createRoundElement
 * Creates a round element for the tournament bracket.
 * @param index - The index of the round.
 * @param title - Optional title for the round.
 * @returns The created round HTMLElement.
 */
function createRoundElement(index: number, title?: string): HTMLElement {
	const roundClone = roundTemplate!.content.cloneNode(true) as HTMLElement;
	const roundElem = roundClone.querySelector(".tournament-round") as HTMLElement;
	roundElem.dataset.roundIndex = String(index);
	const titleElem = roundElem.querySelector(".round-title") as HTMLElement;
	titleElem.textContent = title ?? `Round ${index + 1}`;
	return roundElem;
}

/** ### ensureConnectorSvg
 * Ensures that the SVG element for bracket connectors exists.
 * If it doesn't exist, it creates and appends it to the map.
 * @returns The SVGSVGElement for bracket connectors.
 */
function ensureConnectorSvg(): SVGSVGElement {
	let svg = mapState.map.querySelector<SVGSVGElement>(".bracket-connectors");
	if (svg) return svg;

	if (connectorSvgTemplate) {
		const clone = connectorSvgTemplate.content.cloneNode(true) as HTMLElement;
		mapState.map.appendChild(clone);
		svg = mapState.map.querySelector<SVGSVGElement>(".bracket-connectors")!;
	} else {
		const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		el.classList.add("bracket-connectors");
		el.setAttribute("width", "100%");
		el.setAttribute("height", "100%");
		mapState.map.appendChild(el);
		svg = el;
	}
	svg.style.position = "absolute";
	svg.style.left = "0";
	svg.style.top = "0";
	svg.style.pointerEvents = "none";
	return svg;
}

/** ### drawConnectors
 * Draws SVG connectors between bracket matches.
 * Connects matches from one round to the next using cubic Bezier curves.
 */
function drawConnectors(): void {
	const svg = ensureConnectorSvg();
	while (svg.firstChild) svg.removeChild(svg.firstChild);

	const rounds = Array.from(mapState.map.querySelectorAll<HTMLElement>(".tournament-round"))
		.sort((a, b) => Number(a.dataset.roundIndex) - Number(b.dataset.roundIndex));

	const circleRadius = 4; // end circle

	for (let r = 0; r < rounds.length - 1; r++) {
		const thisMatches = Array.from(rounds[r].querySelectorAll<HTMLElement>(".match-bracket"));
		const nextMatches = Array.from(rounds[r + 1].querySelectorAll<HTMLElement>(".match-bracket"));

		thisMatches.forEach((mElem, idx) => {
			const targetIdx = Math.floor(idx / 2);
			const nextMatch = nextMatches[targetIdx];
			if (!nextMatch) return;

			const a = mElem.getBoundingClientRect();
			const b = nextMatch.getBoundingClientRect();
			const containerRect = mapState.map.getBoundingClientRect();

			// Calculate start and end points relative to SVG container
			const startX = a.right - containerRect.left;
			const startY = a.top + a.height / 2 - containerRect.top;
			const endX = b.left - containerRect.left;
			const endY = b.top + b.height / 2 - containerRect.top;

			const midX = startX + (endX - startX) / 2;

			// Create svg path for connector
			const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
			const d = `
				M ${startX} ${startY}
				L ${midX} ${startY}
				L ${midX} ${endY}
				L ${endX - circleRadius} ${endY}
			`;
			path.setAttribute("d", d);
			path.setAttribute("class", "bracket-line");
			path.setAttribute("fill", "none");
			path.setAttribute("stroke-width", "2");
			svg.appendChild(path);

			// Little circle at the end
			const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
			circle.setAttribute("class", "bracket-end-circle");
			circle.setAttribute("cx", String(endX));
			circle.setAttribute("cy", String(endY));
			circle.setAttribute("r", String(circleRadius));
			svg.appendChild(circle);
		});
	}
}

/** ### InitializeBracket
 * Initializes the tournament bracket with the given players.
 * Creates rounds and matches, and draws connectors between them.
 * @param players - An array of `tournamentPlayer` objects representing the players.
 */
function InitializeBracket(players: tournamentPlayer[]): void {
	roundsWrapper!.innerHTML = "";

	const count = players.length;
	const bracketSize = nextPowerOfTwo(Math.max(1, count)); // >=1 safeguard

	// pad players to power of two (null = BYE)
	const padded: (tournamentPlayer | null)[] = [...players];
	for (let i = count; i < bracketSize; i++) padded.push(null);

	// roundsMatches[r] = array of MatchSlot for round r
	const roundsMatches: MatchSlot[][] = [];

	// first round: create matches from padded players (pairs)
	let globalCounter = 1;
	const firstRoundMatches: MatchSlot[] = [];
	for (let i = 0; i < padded.length; i += 2) {
		firstRoundMatches.push({
			p1: padded[i],
			p2: padded[i + 1],
			number: (i / 2) + 1,    // 1-based within round
			globalId: globalCounter++,
		});
	}
	roundsMatches.push(firstRoundMatches);

	// subsequent rounds placeholders
	let prevMatches = firstRoundMatches.length;
	while (prevMatches > 1) {
		const curMatches: MatchSlot[] = [];
		for (let i = 0; i < prevMatches; i += 2) {
			curMatches.push({
				p1: null,
				p2: null,
				number: (i / 2) + 1,
				globalId: globalCounter++,
			});
		}
		roundsMatches.push(curMatches);
		prevMatches = curMatches.length;
	}

	// Render each round
	for (let r = 0; r < roundsMatches.length; r++) {
		const roundMatches = roundsMatches[r];
		const roundElem = createRoundElement(r, r === 0 ? "Round 1" : `Round ${r + 1}`);
		const matchesContainer = roundElem.querySelector(".round-matches") as HTMLElement;

		for (let mi = 0; mi < roundMatches.length; mi++) {
			const slot = roundMatches[mi];

			// If this is not first round, compute placeholders from previous round numbers
			let placeholderLeft: string | undefined;
			let placeholderRight: string | undefined;
			if (r > 0) {
				const prev = roundsMatches[r - 1];
				const leftMatch = prev[mi * 2];
				const rightMatch = prev[mi * 2 + 1];
				// if previous match exists, refer to its per-round number:
				if (leftMatch) placeholderLeft = `Winner of ${leftMatch.globalId}`;
				if (rightMatch) placeholderRight = `Winner of ${rightMatch.globalId}`;
			}

			const matchElem = createBracketMatch(slot, placeholderLeft, placeholderRight);
			const wrapper = document.createElement("div");
			wrapper.className = "match-wrapper";
			wrapper.style.display = "flex";
			wrapper.style.justifyContent = "center";
			wrapper.appendChild(matchElem);
			matchesContainer.appendChild(wrapper);
		}

		roundsWrapper!.appendChild(roundElem);
	}

	// create svg overlay and draw connectors after layout
	ensureConnectorSvg();
	// draw after layout to have bounding rects correct
	setTimeout(drawConnectors, 0);
}

/* ==================================================================
						PLAYER DRAG & DROP
   ================================================================== */

/** ### playersState
 * Array holding the current state of players in the tournament.
 */
let playersState: tournamentPlayer[] = [];

/** ### playerDragState
 * Object holding the current drag state for the player list.
 */
const playerDragState: PlayerDragState = {
	isDragging: false,
	dragStarted: false,
	draggedIndex: -1,
	pointerId: null,
	startY: 0,
	offsetY: 0,
	lastPointerY: 0,
	ghostElem: null,
	placeholderElem: null,
};


/** The minimum pointer movement (in pixels) required to start a drag operation for player reordering. */
const DRAG_THRESHOLD = 6;

/** The margin (in pixels) from the top/bottom of the player list to trigger auto-scrolling during drag. */
const SCROLL_MARGIN = 40;

/** The speed (in pixels per frame) at which the player list auto-scrolls during drag. */
const SCROLL_SPEED = 16;


/** ### getPlayerListItems
 * Returns all player list items currently in the DOM.
 */
function getPlayerListItems(): HTMLLIElement[] {
	return Array.from(
		playerListElem!.querySelectorAll<HTMLLIElement>(
			"li.player-list-item"
		)
	);
}

/** ### onPlayerPointerDown
 * Initializes the drag state when a pointer is pressed on a player item.
 * @param event - Pointer event triggered on a list item.
 */
function onPlayerPointerDown(event: Event): void {
	const e = event as PointerEvent;
	const target = e.currentTarget as HTMLLIElement;

	e.preventDefault();

	playerDragState.isDragging = true;
	playerDragState.dragStarted = false;

	playerDragState.startY = e.clientY;
	playerDragState.lastPointerY = e.clientY;
	playerDragState.draggedIndex = Number(target.dataset.index);
	playerDragState.pointerId = e.pointerId;

	target.setPointerCapture(e.pointerId);
}

/** ### startPlayerDrag
 * Converts a list item into a draggable ghost element and inserts
 * a placeholder in the list.
 * @param target - The list item being dragged.
 * @param event - The triggering pointer event.
 */
function startPlayerDrag(
	target: HTMLLIElement,
	event: PointerEvent
): void {
	playerDragState.dragStarted = true;

	const rect = target.getBoundingClientRect();
	playerDragState.offsetY = event.clientY - rect.top;

	const ghost = target.cloneNode(true) as HTMLLIElement;
	ghost.classList.add("drag-ghost");
	document.body.appendChild(ghost);

	ghost.style.width = `${rect.width}px`;
	ghost.style.left = `${rect.left}px`;
	ghost.style.top = `${rect.top}px`;

	const placeholder = document.createElement("li");
	placeholder.className = "player-placeholder";
	placeholder.style.height = `${rect.height}px`;

	playerListElem!.insertBefore(placeholder, target);
	target.remove();

	playerDragState.ghostElem = ghost;
	playerDragState.placeholderElem = placeholder;
}

/** ### onPlayerPointerMove
 * Handles pointer movement during a drag operation.
 * @param event - Global pointer move event.
 */
function onPlayerPointerMove(event: Event): void {
	if (!playerDragState.isDragging)
		return;

	const e = event as PointerEvent;
	if (e.pointerId !== playerDragState.pointerId)
		return;

	const dy = Math.abs(e.clientY - playerDragState.startY);

	if (!playerDragState.dragStarted) {
		if (dy < DRAG_THRESHOLD)
			return;

		const target = getPlayerListItems()[playerDragState.draggedIndex];
		if (!target)
			return;

		startPlayerDrag(target, e);
	}

	const ghost = playerDragState.ghostElem;
	const placeholder = playerDragState.placeholderElem;
	if (!ghost || !placeholder)
		return;

	e.preventDefault();
	playerDragState.lastPointerY = e.clientY;

	const listRect = playerListElem!.getBoundingClientRect();
	const ghostHeight = ghost.offsetHeight;

	const minY = listRect.top;
	const maxY = listRect.bottom - ghostHeight;

	const desiredY = e.clientY - playerDragState.offsetY;
	const clampedY = Math.min(Math.max(desiredY, minY), maxY);

	ghost.style.top = `${clampedY}px`;

	const items = getPlayerListItems();
	let inserted = false;

	for (const item of items) {
		const r = item.getBoundingClientRect();
		const mid = r.top + r.height / 2;

		if (e.clientY < mid) {
			playerListElem!.insertBefore(placeholder, item);
			inserted = true;
			break;
		}
	}

	if (!inserted)
		playerListElem!.appendChild(placeholder);

	handlePlayerAutoScroll();
}

/** ### handlePlayerAutoScroll
 * Automatically scrolls the player list when dragging near its edges.
 */
function handlePlayerAutoScroll(): void {
	const rect = playerListElem!.getBoundingClientRect();

	if (playerDragState.lastPointerY < rect.top + SCROLL_MARGIN)
		playerListElem!.scrollTop -= SCROLL_SPEED;
	else if (playerDragState.lastPointerY > rect.bottom - SCROLL_MARGIN)
		playerListElem!.scrollTop += SCROLL_SPEED;
}

/** ### onPlayerPointerUp
 * Finalizes the drag operation and updates player order.
 * @param event - Global pointer up or cancel event.
 */
function onPlayerPointerUp(event: Event): void {
	const e = event as PointerEvent;
	if (e.pointerId !== playerDragState.pointerId)
		return;

	playerDragState.isDragging = false;

	if (!playerDragState.dragStarted) {
		resetPlayerDrag();
		return;
	}

	let toIndex = 0;

	for (const child of Array.from(playerListElem!.children)) {
		if (child === playerDragState.placeholderElem)
			break;
		if (child.classList.contains("player-list-item"))
			toIndex++;
	}

	const moved = playersState.splice(playerDragState.draggedIndex, 1)[0];
	playersState.splice(toIndex, 0, moved);

	playersState.forEach((player, index) => {
		player.rank = index + 1;
	});

	resetPlayerDrag();
	updatePlayerList(playersState);
}

/** ### resetPlayerDrag
 * Cleans up DOM elements and resets drag state.
 */
function resetPlayerDrag(): void {
	if (playerDragState.ghostElem)
		playerDragState.ghostElem.remove();
	if (playerDragState.placeholderElem)
		playerDragState.placeholderElem.remove();

	playerDragState.ghostElem = null;
	playerDragState.placeholderElem = null;
	playerDragState.pointerId = null;
	playerDragState.draggedIndex = -1;
	playerDragState.dragStarted = false;
}


/* ==================================================================
						INITIALIZATION
   ================================================================== */

// Add event listeners for panzoom
addListener(mapContainer, "mousedown", startDrag);
addListener(mapContainer, "touchstart", onTouchStart);

addListener(document, "mousemove", onDrag);
addListener(document, "touchmove", onTouchMove);

addListener(document, "mouseup", endDrag);
addListener(document, "touchend", onTouchEnd);
addListener(document, "touchcancel", onTouchCancel);

// Add event listener for zooming
addListener(mapContainer, "wheel", onZoom);

// Add global event listeners for player drag & drop
addListener(document, "pointermove", onPlayerPointerMove);
addListener(document, "pointerup", onPlayerPointerUp);
addListener(document, "pointercancel", onPlayerPointerUp);

// Add event listener with timeout to redraw connectors on window resize
let resizeTimeout: number | null = null;
addListener(window, "resize", () => {
	if (resizeTimeout !== null) {
		clearTimeout(resizeTimeout);
	}
	resizeTimeout = window.setTimeout(() => {
		drawConnectors();
		resizeTimeout = null;
	}, 200);
});

// Example usage (this will be replaced with actual data fetching logic)
let examplePlayers: tournamentPlayer[] = [
	{ id: 1, name: "PlayerOne", rank: 1 },
	{ id: 2, name: "PlayerTwo", rank: 2 },
	{ id: 3, name: "PlayerThree", rank: 3 },
	{ id: 4, name: "PlayerFour", rank: 4 },
	{ id: 5, name: "PlayerFive", rank: 5 },
	{ id: 6, name: "PlayerSix", rank: 6 },
	{ id: 7, name: "PlayerSeven", rank: 7 },
	{ id: 8, name: "PlayerEight", rank: 8 },
];

// Initialize player list (with example data)
updatePlayerList(examplePlayers);

// Initialize bracket (with example data)
InitializeBracket(examplePlayers);
