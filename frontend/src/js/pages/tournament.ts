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
	playerListElem!.innerHTML = ""; // Clear existing list

	players.forEach((player) => {
		const listItem = playerListTemplate!.content.cloneNode(true) as HTMLElement;
		const nameElem = listItem.querySelector(".player-name") as HTMLElement;
		const rankElem = listItem.querySelector(".player-rank") as HTMLElement;

		nameElem.textContent = player.name;
		rankElem.textContent = `Rank: ${player.rank}`;

		playerListElem!.appendChild(listItem);
	});
}

/* ==================================================================
						BRACKET MATCH FUNCTIONS
   ================================================================== */

/** ### bracketMatchTemplate
 * The HTML template element for a bracket match.
 */
const bracketMatchTemplate: HTMLTemplateElement | null = document.getElementById("match-bracket-template") as HTMLTemplateElement | null;

/** ### createBracketMatch
 * Creates a bracket match element.
 * @param player1 - The first player in the match.
 * @param player2 - The second player in the match.
 * @returns The created bracket match element.
 */
function createBracketMatch(player1: tournamentPlayer, player2: tournamentPlayer): HTMLElement {
	const matchElem = bracketMatchTemplate!.content.cloneNode(true) as HTMLElement;
	const player1Elem = matchElem.querySelector(".match-player1") as HTMLElement;
	const player2Elem = matchElem.querySelector(".match-player2") as HTMLElement;

	player1Elem.textContent = player1.name;
	player2Elem.textContent = player2.name;

	return matchElem;
}

/** ### InitializeBracket */
function InitializeBracket(players: tournamentPlayer[]): void {
	tournamentMap!.innerHTML = ""; // Clear existing bracket

	// Example: Create matches for the first round
	for (let i = 0; i < players.length; i += 2) {
		if (i + 1 < players.length) {
			const matchElem = createBracketMatch(players[i], players[i + 1]);
			tournamentMap!.appendChild(matchElem);
		}
	}
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

// Example usage (this will be replaced with actual data fetching logic)
const examplePlayers: tournamentPlayer[] = [
	{ id: 1, name: "PlayerOne", rank: 1 },
	{ id: 2, name: "PlayerTwo", rank: 2 },
	{ id: 3, name: "PlayerThree", rank: 3 },
];

// Initialize player list (with example data)
updatePlayerList(examplePlayers);

// Initialize bracket (with example data)
InitializeBracket(examplePlayers);
