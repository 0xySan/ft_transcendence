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

// Add event listeners for dragging
addListener(mapContainer, "mousedown", startDrag);
addListener(mapContainer, "touchstart", startDrag);
addListener(document, "mousemove", onDrag);
addListener(document, "touchmove", onDrag);
addListener(document, "mouseup", endDrag);
addListener(document, "touchend", endDrag);

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
