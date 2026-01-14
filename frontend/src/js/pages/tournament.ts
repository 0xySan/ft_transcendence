
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
declare function loadPage(url: string): void;
declare function addListener(
	target: EventTarget | null,
	event: string,
	handler: any,
): void;
declare function registerDynamicCleanup(cleanup: () => void): void;

import type { Settings } from "../global";
import { gameStartAckPayload } from "./lobbySocket";

declare global {
	interface Window {
		lobbySettings?: Settings;
		tournamentMode: "online" | "offline";
		tournamentState?: TournamentState;
		gameResults?: {
			scores: Record<string, number>;
			winner?: string;
			ended: boolean;
		};
		playerList?: tournamentPlayer[];
		tournamentId?: string;
		tournamentCode?: string;
		pendingGameStart?: gameStartAckPayload;
		localPlayerId?: string;
		isGameOffline: boolean;
		playerNames?: Record<string, string>;
	}
}

export {};

/** ### loadPage
 * - Loads a new page by URL.
 * - Use the dynamic page loader to ensure proper cleanup.
 * @param url - The URL of the page to load.
 */
declare function loadPage(url: string): void;

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

/** ### debounce
 * Returns a debounced version of the function.
 */
function debounce<F extends (...args: any[]) => void>(fn: F, delay: number): F {
	let timeout: number | null = null;
	return function(this: any, ...args: any[]) {
		if (timeout !== null) clearTimeout(timeout);
		timeout = window.setTimeout(() => fn.apply(this, args), delay);
	} as F;
}

/* ==================================================================
					Tournament Initialization
   ================================================================== */

// Load tournament data from sessionStorage
let tournamentId = sessionStorage.getItem('tournamentId');
let tournamentCode = sessionStorage.getItem('tournamentCode');

type CurrentMatchInfo = {
	matchId: string;
	gameId: string | null;
	yourReady: boolean;
	opponentReady: boolean;
};

let currentMatchInfo: CurrentMatchInfo | null = null;
let waitingForOpponentPoll: number | null = null;

// Determine if online or offline based on tournamentId existence
const isOnlineTournament = !!tournamentId;

if (tournamentId) {
	window.tournamentId = tournamentId;
	window.tournamentCode = tournamentCode || undefined;
	window.tournamentMode = 'online';
} else {
	window.tournamentMode = 'offline';
}

/* ==================================================================
				Tournament API Functions
   ================================================================== */

/** ### fetchTournamentStatus
 * Fetch the current tournament status including players and bracket.
 * @param tId - The tournament ID
 * @returns Tournament status data
 */
async function fetchTournamentStatus(tId: string): Promise<any> {
	const res = await fetch(`/api/tournament/${tId}/status`, {
		method: "GET",
		headers: { "Content-Type": "application/json" },
	});

	if (!res.ok) {
		console.error('Failed to fetch tournament status:', res.status);
		return null;
	}

	return await res.json();
}

/** ### leaveTournament
 * Leave the current tournament.
 * @param tId - The tournament ID
 * @returns Response indicating success or failure
 */
async function leaveTournament(tId: string): Promise<void> {
	const res = await fetch(`/api/tournament/leave`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({"tournamentId": tId }),
	});

	if (!res.ok) {
		const error = await res.json();
		throw new Error(error.message || "Failed to leave tournament");
	}
}

/** ### displayTournamentCode
 * Display the tournament code in the player list section.
 * @param code - The tournament code
 */
function displayTournamentCode(code: string | null): void {
	const codeDisplay = document.getElementById('tournament-code-display') as HTMLDivElement | null;
	const codeValue = document.getElementById('tournament-code-value') as HTMLSpanElement | null;

	if (!codeDisplay || !codeValue) return;

	if (code) {
		codeValue.textContent = code;
		codeDisplay.style.display = 'block';
	} else {
		codeDisplay.style.display = 'none';
	}
}

/** ### initializeTournament
 * Initialize the tournament by fetching data and setting up the UI.
 */
async function initializeTournament(): Promise<void> {
	if (!tournamentId) return;

	// Display code if available
	if (tournamentCode) {
		displayTournamentCode(tournamentCode);
	}

	// Fetch tournament status (this will set lobby settings)
	await refreshTournamentStatus();
	
	// Verify lobby settings were loaded
	if (!window.lobbySettings) {
		console.error("Failed to load lobby settings from tournament");
	}
	
	// Check if returning from a tournament game
	checkReturnFromGame();
}

/** ### checkReturnFromGame
 * Check if returning from a tournament game and clean up session storage.
 */
function checkReturnFromGame(): void {
	const gameId = sessionStorage.getItem('tournamentGameId');
	const returnTournamentId = sessionStorage.getItem('tournamentReturnId');
	
	if (gameId && returnTournamentId === tournamentId) {
		// Clear the session storage
		sessionStorage.removeItem('tournamentGameId');
		sessionStorage.removeItem('tournamentGameAuthToken');
		sessionStorage.removeItem('tournamentReturnId');
		
		console.log('Returned from tournament game:', gameId);
		
		// Refresh tournament status to update results
		refreshTournamentStatus();
	}
}

/** ### refreshTournamentStatus
 * Refresh the tournament status by fetching from backend.
 */
async function refreshTournamentStatus(): Promise<void> {
	if (!tournamentId) return;

	const status = await fetchTournamentStatus(tournamentId);
	if (status) {
		// Extract and set lobby settings from tournament config
		if (status.config) {
			window.lobbySettings = status.config;
			console.log('Loaded tournament lobby settings:', window.lobbySettings);
		}
		
		// Use players from backend
		const backendPlayers: tournamentPlayer[] = (status.players || []).map((p: any) => ({
			id: p.id,
			name: p.name,
			rank: p.rank,
		}));
		
		updatePlayerList(backendPlayers);
		
		// Track current match for ready UI and store player names
		if (status.yourCurrentMatch) {
			currentMatchInfo = {
				matchId: status.yourCurrentMatch.matchId,
				gameId: status.yourCurrentMatch.gameId,
				yourReady: status.yourCurrentMatch.yourReady,
				opponentReady: status.yourCurrentMatch.opponentReady,
			};
			
			// Extract player names from the bracket/match info
			if (status.yourCurrentMatch.players) {
				// Store player names for the game to use
				window.playerNames = window.playerNames || {};
				for (const player of status.yourCurrentMatch.players) {
					window.playerNames[player.id] = player.name;
				}
			}
		} else {
			currentMatchInfo = null;
			clearPendingGame();
		}
		
		// Initialize bracket if status is in-progress
		if (status.status === 'in-progress') {
			console.log('Tournament is in-progress! Building bracket from backend data');
			
			// Organize bracket into rounds based on backend data
			if (status.bracket && Array.isArray(status.bracket)) {
				// Group matches by round
				const matchesByRound: Record<number, any[]> = {};
				let maxRound = 0;
				
				for (const match of status.bracket) {
					const round = match.round || 0;
					if (!matchesByRound[round]) matchesByRound[round] = [];
					matchesByRound[round].push(match);
					maxRound = Math.max(maxRound, round);
				}
				
				// Build tournament state from backend bracket
				// Build lookup map for player display names (userId or id -> name)
				const playerNameById: Record<string, string> = {};
				for (const p of backendPlayers) {
					if ((p as any).userId) playerNameById[(p as any).userId] = p.name;
					if ((p as any).id) playerNameById[(p as any).id] = p.name;
				}

				const rounds: StoredMatch[][] = [];
				for (let r = 0; r <= maxRound; r++) {
					const roundMatches = matchesByRound[r] || [];
					const storedMatches: StoredMatch[] = roundMatches.map((match: any, idx: number) => {
						const p1 = match.player1Id
							? { id: match.player1Id, name: match.player1Name || playerNameById[match.player1Id] || 'Player', rank: 0 }
							: null;
						const p2 = match.player2Id
							? { id: match.player2Id, name: match.player2Name || playerNameById[match.player2Id] || 'Player', rank: 0 }
							: null;
						
						// Determine score based on winner
						let score: { left: number; right: number } | undefined = undefined;
						if (match.winner) {
							// Winner gets 1 point, loser gets 0
							if (match.winner === match.player1Id) {
								score = { left: 1, right: 0 };
							} else if (match.winner === match.player2Id) {
								score = { left: 0, right: 1 };
							}
						}
						// Safe numbering to avoid NaN if matchId format changes
						const parsedMatchNumber = match.matchId ? Number(match.matchId.split('-').pop()) : NaN;
						const number = Number.isFinite(parsedMatchNumber) ? parsedMatchNumber : idx + 1;
						const globalId = r * 100 + idx; // stable unique id per slot
						
						return {
							p1,
							p2,
							number,
							globalId,
							played: !!match.winner,
							score,
						};
					});
					rounds.push(storedMatches);
				}
				
				// Create tournament state and render
				window.tournamentState = { rounds, currentMatch: null };
				saveTournamentState();
				renderBracketFromState(window.tournamentState);
			}
		}
		
		// Update ready button state
		updateReadyButtonState();
	}
}

/** ### updateReadyButtonState
 * Update the ready button state based on current match info.
 */
function updateReadyButtonState(): void {
	const readyBtn = document.getElementById("tournament-ready-btn") as HTMLButtonElement | null;
	if (!readyBtn || window.tournamentMode !== 'online') return;
	
	if (!currentMatchInfo) {
		readyBtn.disabled = true;
		readyBtn.textContent = "No Match Available";
	} else if (currentMatchInfo.yourReady) {
		readyBtn.disabled = true;
		readyBtn.textContent = "Waiting for opponent...";
	} else {
		readyBtn.disabled = false;
		readyBtn.textContent = "Ready for Match";
	}
}

function persistPendingGame(gameId: string, matchId: string, authToken: string, shouldStart: boolean = false): void {
	sessionStorage.setItem('tournamentGameId', gameId);
	sessionStorage.setItem('tournamentMatchId', matchId);
	sessionStorage.setItem('tournamentGameAuthToken', authToken);
	sessionStorage.setItem('tournamentShouldStart', String(shouldStart));
	sessionStorage.setItem('tournamentReturnId', tournamentId || '');
}

function clearPendingGame(): void {
	sessionStorage.removeItem('tournamentGameId');
	sessionStorage.removeItem('tournamentMatchId');
	sessionStorage.removeItem('tournamentGameAuthToken');
	sessionStorage.removeItem('tournamentReturnId');
}

/** ### readyForMatch
 * Mark the current player as ready for a tournament match.
 * @param tId - The tournament ID
 * @param matchId - The match ID
 * @returns Response with game info
 */
async function readyForMatch(tId: string, matchId: string): Promise<any> {
	const res = await fetch(`/api/tournament/ready`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ tournamentId: tId, matchId: matchId }),
	});

	if (!res.ok) {
		const error = await res.json();
		throw new Error(error.error || "Failed to ready for match");
	}

	return await res.json();
}

/** ### recordTournamentMatchResult
 * Record the result of a tournament match (online mode).
 * @param tId - The tournament ID
 * @param matchId - The match ID
 * @param winnerId - The winning player ID (userId)
 * @returns Response from the server
 */
async function recordTournamentMatchResult(tId: string, matchId: string, winnerId: string): Promise<any> {
	const res = await fetch(`/api/tournament/result`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ tournamentId: tId, matchId: matchId, winnerId: winnerId }),
	});

	if (!res.ok) {
		const error = await res.json();
		throw new Error(error.error || "Failed to record match result");
	}

	return await res.json();
}

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

// ----------------------- Tournament state --------------------------------


type StoredMatch = MatchSlot & {
	played?: boolean;
	score?: { left: number; right: number } | null;
	// p1/p2 keep tournamentPlayer or null
};

export interface TournamentState {
	rounds: StoredMatch[][];
	currentMatch?: { roundIndex: number; matchIndex: number } | null;
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
const playerListElem: HTMLUListElement | null = document.getElementById("player-list-ul") as HTMLUListElement | null;

/** ### playerListTemplate
 * The HTML template element for a tournament player list item.
 */
const playerListTemplate: HTMLTemplateElement | null = document.getElementById("player-list-item-template") as HTMLTemplateElement | null;

if (!playerListElem || !playerListTemplate)
	throw new Error("Missing player list element for tournament page");

/** ### updatePlayerName
 * Updates the player name in the state and re-renders the bracket.
 */
const updatePlayerName = debounce((index: number, newName: string) => {
	playersState[index].name = newName;

	// If offline and no match has been played yet, keep the "original" snapshot
	// up-to-date with the most-recent user edits so it can be restored later.
	if (window.tournamentMode === 'offline' && !anyMatchPlayed(window.tournamentState || loadTournamentState())) {
		try {
			saveOriginalPlayerNames(playersState.map(p => p.name));
		} catch (e) {
			// ignore save errors
		}
	}

	// Re-render bracket with updated names
	InitializeBracket(playersState);
	window.playerList = playersState;
	saveTournamentState();
}, 200);

/** ### updatePlayerList
 * Updates the player list depending on tournament mode.
 * - Offline: uses input fields to allow name editing.
 * - Online: uses spans to display names.
 * 
 * @param players - An array of `tournamentPlayer` objects representing the players.
 */
function updatePlayerList(players: tournamentPlayer[]): void {
	playersState = players.slice();
	playerListElem!.innerHTML = "";

	// compute whether inputs should be disabled (used to avoid attaching drag listeners)
	const inputsDisabled = window.tournamentMode === 'offline' && anyMatchPlayed(window.tournamentState || loadTournamentState());

	// If no match has been played and we don't have a snapshot yet, keep a snapshot
	// of the current entered names so they can be restored after the first match.
	if (window.tournamentMode === 'offline' && !inputsDisabled) {
		// snapshot if missing
		snapshotEnteredPlayerNamesIfMissing();
	} else if (window.tournamentMode === 'offline' && inputsDisabled) {
		// match played: try to restore original names
		try {
			const originalNames = loadOriginalPlayerNames();
			if (originalNames && originalNames.length === playersState.length) {
				playersState.forEach((p, idx) => {
					p.name = originalNames[idx];
				});
			}
		} catch (e) {
			console.warn("Failed to restore original player names after match played:", e);
		}
	}

	playersState.forEach((player, index) => {
		const li = document.createElement("li");
		li.className = "player-list-item";
		li.dataset.index = String(index);

		if (window.tournamentMode === "offline" && !inputsDisabled) { // even in offline, disable if match played
			// Offline: editable input
			const input = document.createElement("input");
			input.type = "text";
			input.className = "player-name-input";
			input.value = player.name;

			// reflect disabled state immediately so the input isn't editable
			input.disabled = inputsDisabled;

			// debounce name updates
			input.addEventListener("input", () => {
				updatePlayerName(index, input.value);
			});

			li.appendChild(input);

			// optional: allow drag even in offline unless inputs are disabled (match played)
			if (!inputsDisabled) addListener(li, "pointerdown", onPlayerPointerDown);
		} else {
			// Online: plain span
			const nameSpan = document.createElement("span");
			nameSpan.className = "player-name";
			nameSpan.textContent = player.name;

			const rankSpan = document.createElement("span");
			rankSpan.className = "player-rank";
			rankSpan.textContent = `Rank: ${player.rank}`;

			li.appendChild(nameSpan);
			li.appendChild(rankSpan);

			// optional: still allow drag in online mode if needed
			addListener(li, "pointerdown", onPlayerPointerDown);
		}

		playerListElem!.appendChild(li);
	});

	window.playerList = playersState;
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
    // If inputs are disabled due to played matches, ignore drag attempts
    if (window.tournamentMode === 'offline' && anyMatchPlayed(window.tournamentState || loadTournamentState())) return;
	const e = event as PointerEvent;
	const target = e.currentTarget as HTMLLIElement;
	const isInput = (event.target as HTMLElement).tagName === "INPUT";

	if (!isInput)
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



/* ========================= TOURNAMENT STATE HELPERS ========================= */

/**
 * Key used in localStorage to persist offline tournament state
 */
const TOURNAMENT_STORAGE_KEY = "ft_tournament_offline_state_v1";

/** Key to persist the snapshot of player names entered before the first match */
const ORIGINAL_NAMES_KEY = "ft_tournament_offline_original_names_v1";

/**
 * Save tournament state to localStorage (only in offline mode).
 */
function saveTournamentState(): void {
	if (window.tournamentMode !== "offline" || !window.tournamentState) return;
	try {
		localStorage.setItem(TOURNAMENT_STORAGE_KEY, JSON.stringify(window.tournamentState));
	} catch (err) {
		console.warn("Could not save tournament state:", err);
	}
}


/**
 * Load tournament state from localStorage.
 * Returns null if none or invalid.
 */
function loadTournamentState(): TournamentState | null {
	try {
		const raw = localStorage.getItem(TOURNAMENT_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as TournamentState;
		// basic validation
		if (!parsed || !Array.isArray(parsed.rounds)) return null;
		return parsed;
	} catch (err) {
		console.warn("Could not read tournament state:", err);
		return null;
	}
}

/**
 * Check whether at least one match in the given state has been played.
 * Returns true if any match has `played === true` or a non-null `score`.
 */
function anyMatchPlayed(state?: TournamentState | null): boolean {
	if (!state || !Array.isArray(state.rounds)) return false;
	for (const round of state.rounds) {
		for (const match of round) {
			if (match && (match.played === true)) return true;
			if (match && match.score && (typeof match.score.left === 'number' || typeof match.score.right === 'number')) return true;
		}
	}
	return false;
}

/**
 * Enable or disable player name input elements in the player list UI.
 */
function setPlayerInputsDisabled(disabled: boolean): void {
	if (!playerListElem) return;
	const inputs = Array.from(playerListElem.querySelectorAll<HTMLInputElement>('span.player-name'));

	if (disabled) {
		// Restore snapshot of entered names (if available) before locking
		const snap = loadOriginalPlayerNames();
		if (snap && snap.length) {
			inputs.forEach((inp, idx) => {
				if (typeof snap[idx] === 'string') inp.value = snap[idx];
				inp.disabled = true;
			});
			return;
		}
	}

	// default behavior
	inputs.forEach(i => i.disabled = disabled);
}

function saveOriginalPlayerNames(names: string[]): void {
	try {
		localStorage.setItem(ORIGINAL_NAMES_KEY, JSON.stringify(names));
		(window as any).__originalTournamentPlayerNames = names.slice();
	} catch (e) {
		console.warn('Could not save original player names', e);
	}
}

function loadOriginalPlayerNames(): string[] | null {
	try {
		const win = (window as any).__originalTournamentPlayerNames as string[] | undefined;
		if (win) return win.slice();
		const raw = localStorage.getItem(ORIGINAL_NAMES_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as string[];
	} catch (e) {
		console.warn('Could not load original player names', e);
		return null;
	}
}

/**
 * Snapshot the current (user-entered) player names so we can restore them
 * after the first match. Only saves if not already present.
 */
function snapshotEnteredPlayerNamesIfMissing(): void {
	const existing = loadOriginalPlayerNames();
	if (existing && existing.length) return;
	// prefer playersState (keeps edits), fallback to DOM inputs
	try {
		if (playersState && playersState.length) {
			saveOriginalPlayerNames(playersState.map(p => p.name));
			return;
		}
		const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input.player-name-input'));
		if (inputs && inputs.length) {
			saveOriginalPlayerNames(inputs.map(i => i.value));
		}
	} catch (e) {
		// ignore
	}
}

/**
 * Build initial TournamentState from a flat player list.
 * Players must be ordered by seed/rank (players[i].rank should be set).
 */
function buildInitialTournamentState(players: tournamentPlayer[]): TournamentState {
	const count = players.length;
	const bracketSize = nextPowerOfTwo(Math.max(1, count));

	// pad players array with nulls
	const padded: (tournamentPlayer | null)[] = players.slice();
	for (let i = count; i < bracketSize; i++) padded.push(null);

	// create first round matches
	let globalCounter = 1;
	const rounds: StoredMatch[][] = [];
	const firstRound: StoredMatch[] = [];
	for (let i = 0; i < padded.length; i += 2) {
		firstRound.push({
			p1: padded[i],
			p2: padded[i + 1],
			number: (i / 2) + 1,
			globalId: globalCounter++,
			played: false,
			score: null
		});
	}
	rounds.push(firstRound);

	// subsequent rounds placeholders
	let prevMatches = firstRound.length;
	while (prevMatches > 1) {
		const cur: StoredMatch[] = [];
		for (let i = 0; i < prevMatches; i += 2) {
			cur.push({
				p1: null,
				p2: null,
				number: (i / 2) + 1,
				globalId: globalCounter++,
				played: false,
				score: null
			});
		}
		rounds.push(cur);
		prevMatches = cur.length;
	}

	// find first unplayed match (first round first match)
	const firstCurrent = { roundIndex: 0, matchIndex: 0 };

	return {
		rounds,
		currentMatch: firstCurrent
	};
}

/**
 * Find next match to play in the TournamentState.
 * Strategy: scan rounds from round 0 upwards, match 0..n and return first
 * match that is not played AND which has two participants (p1 && p2).
 */
function findNextMatch(state: TournamentState): { roundIndex: number; matchIndex: number } | null {
	for (let r = 0; r < state.rounds.length; r++) {
		for (let m = 0; m < state.rounds[r].length; m++) {
			const match = state.rounds[r][m];
			if (!match.played && match.p1 && match.p2) {
				return { roundIndex: r, matchIndex: m };
			}
		}
	}
	return null;
}

/**
 * Render bracket from TournamentState (replaces InitializeBracket usage
 * when a stored state exists).
 */
function renderBracketFromState(state: TournamentState): void {
	roundsWrapper!.innerHTML = "";

	for (let r = 0; r < state.rounds.length; r++) {
		const roundMatches = state.rounds[r];
		const roundElem = createRoundElement(r, r === 0 ? "Round 1" : `Round ${r + 1}`);
		const matchesContainer = roundElem.querySelector(".round-matches") as HTMLElement;

		for (let mi = 0; mi < roundMatches.length; mi++) {
			const slot = roundMatches[mi];
			const matchElem = createBracketMatch(slot, undefined, undefined);

			// show score if played
			const score1 = matchElem.querySelector<HTMLElement>(".match-score1");
			const score2 = matchElem.querySelector<HTMLElement>(".match-score2");
			if (slot.score) {
				if (score1) score1.textContent = String(slot.score.left);
				if (score2) score2.textContent = String(slot.score.right);
			} else {
				if (score1) score1.textContent = "-";
				if (score2) score2.textContent = "-";
			}

			// mark played and highlight winner
			if (slot.played) {
				matchElem.classList.add("played-match");
				// Highlight the winner
				if (slot.score) {
					const player1Elem = matchElem.querySelector(".match-player1") as HTMLElement | null;
					const player2Elem = matchElem.querySelector(".match-player2") as HTMLElement | null;
					if (slot.score.left > slot.score.right && player1Elem) {
						player1Elem.classList.add("winner");
						if (player2Elem) player2Elem.classList.remove("winner");
					} else if (slot.score.right > slot.score.left && player2Elem) {
						player2Elem.classList.add("winner");
						if (player1Elem) player1Elem.classList.remove("winner");
					}
				}
			}
			// attach data attrs for click handlers
			(matchElem as HTMLElement).dataset.roundIndex = String(r);
			(matchElem as HTMLElement).dataset.matchIndex = String(mi);

			const wrapper = document.createElement("div");
			wrapper.className = "match-wrapper";
			wrapper.style.display = "flex";
			wrapper.style.justifyContent = "center";
			wrapper.appendChild(matchElem);
			matchesContainer.appendChild(wrapper);
		}

		roundsWrapper!.appendChild(roundElem);
	}

	// draw connectors after layout
	ensureConnectorSvg();
	setTimeout(drawConnectors, 0);
}

/**
 * Helper: set current match in state and save.
 */
function setCurrentMatch(roundIndex: number, matchIndex: number | null): void {
	if (!window.tournamentState) return;
	if (matchIndex === null) window.tournamentState.currentMatch = null;
	else window.tournamentState.currentMatch = { roundIndex, matchIndex };
	saveTournamentState();
}

/* ========================= LAUNCH / RESULT FLOW ========================= */

/** ### launchOnlineTournamentMatch
 * Launch an online tournament match by calling the ready API.
 */
async function launchOnlineTournamentMatch(): Promise<void> {
	if (!tournamentId || !currentMatchInfo) {
		notify("No current match to launch", { type: "error" });
		return;
	}

	// Ensure lobby settings are available before launching
	if (!window.lobbySettings) {
		console.log("Lobby settings not found, refreshing tournament status...");
		await refreshTournamentStatus();
		
		if (!window.lobbySettings) {
			notify("Failed to load tournament settings", { type: "error" });
			return;
		}
	}

	try {
		// Clear any old pendingGameStart from previous rounds to avoid reusing stale data
		window.pendingGameStart = undefined;
		
		// Call ready API
		const response = await readyForMatch(tournamentId, currentMatchInfo.matchId);
		
		if (!response.gameId || !response.authToken) {
			notify("Failed to get game info", { type: "error" });
			return;
		}

		// Store game info for joining
		persistPendingGame(
			response.gameId,
			response.matchId,
			response.authToken,
			response.start || false
		);
		
		// Store player userIds for result recording later
		if (currentMatchInfo.yourReady === false && currentMatchInfo.opponentReady === false) {
			// Just marked ready, now should store player info from current status
			// The player info should be in the tournament status we fetched earlier
			if (window.playerNames) {
				// playerNames maps userId to display name, but we need to get the actual userIds
				// For now, we'll store them in session when the game starts
			}
		}

		// Update current match info
		currentMatchInfo.gameId = response.gameId;
		currentMatchInfo.yourReady = true;

		if (response.start) {
			// Both players ready, navigate to game
			notify("Both players ready! Starting match...", { type: "success" });
			// Navigate to pong board (it will handle joining via stored auth token)
			loadPage("pong-board");
		} else {
			// Waiting for opponent - start polling
			notify("Ready! Waiting for opponent...", { type: "info" });
			updateReadyButtonState();
			startWaitingForOpponentPoll();
		}
	} catch (error) {
		console.error("Failed to ready for match:", error);
		notify((error as Error).message || "Failed to ready for match", { type: "error" });
	}
}

/** ### startWaitingForOpponentPoll
 * Start polling to check if opponent is ready.
 */
function startWaitingForOpponentPoll(): void {
	if (waitingForOpponentPoll) {
		clearInterval(waitingForOpponentPoll);
	}

	// Poll every 2 seconds to check if both players are ready
	waitingForOpponentPoll = window.setInterval(async () => {
		if (!tournamentId || !currentMatchInfo) {
			stopWaitingForOpponentPoll();
			return;
		}

		try {
			// Check if we have a stored game that should start
			const shouldStart = sessionStorage.getItem('tournamentShouldStart') === 'true';
			if (shouldStart) {
				notify("Opponent ready! Starting match...", { type: "success" });
				stopWaitingForOpponentPoll();
				loadPage("pong-board");
				return;
			}

			// Call ready API again to check status
			const response = await readyForMatch(tournamentId, currentMatchInfo.matchId);
			
			if (response.start) {
				// Update stored auth token with start flag
				persistPendingGame(
					response.gameId,
					response.matchId,
					response.authToken,
					true
				);
				
				notify("Opponent ready! Starting match...", { type: "success" });
				stopWaitingForOpponentPoll();
				loadPage("pong-board");
			}
		} catch (error) {
			console.error("Error polling for opponent:", error);
			// Continue polling on error
		}
	}, 2000);
}

/** ### stopWaitingForOpponentPoll
 * Stop polling for opponent.
 */
function stopWaitingForOpponentPoll(): void {
	if (waitingForOpponentPoll) {
		clearInterval(waitingForOpponentPoll);
		waitingForOpponentPoll = null;
	}
}

/**
 * Prepare window.pendingGameStart and other globals, then load the pong board.
 * - expects TournamentState.currentMatch to be set and valid.
 * - maps players to user1 / user2 and sets sides (left/right).
 */
function launchCurrentMatch(): void {
	if (!window.tournamentState || !window.tournamentState.currentMatch) {
		console.warn("No current match selected");
		return;
	}

	const { roundIndex, matchIndex } = window.tournamentState.currentMatch;
	const match = window.tournamentState.rounds[roundIndex][matchIndex];
	if (!match || !match.p1 || !match.p2) {
		console.warn("Current match has missing players");
		return;
	}

	// Ensure lobby settings exist
	if (!window.lobbySettings) {
		notify("Lobby settings required to start offline match", { type: "error" });
		return;
	}

	// Build pendingGameStart with simple mapping:
	// user1 -> p1 (left), user2 -> p2 (right)
	(window as any).isGameOffline = true;

	// Snapshot entered names before first match so we can restore them later
	snapshotEnteredPlayerNamesIfMissing();
	
	// Clear any old pendingGameStart from previous rounds to ensure fresh state
	window.pendingGameStart = undefined;
	
	window.pendingGameStart = {
		action: "start",
		playerSides: {
			user1: "left",
			user2: "right"
		},
		startTime: Date.now() + 1200
	};

	// Initialize gameResults for tracking
	window.gameResults = {
		scores: {
			user1: 0,
			user2: 0
		},
		ended: false
	};

	// Save current match identity so we can map scores back to players
	// Store player mapping: user1=left=p1, user2=right=p2
	(window as any)._currentTournamentMatch = { 
		roundIndex, 
		matchIndex, 
		p1Id: match.p1.id, 
		p2Id: match.p2.id,
		// Map userIds to players for score resolution
		playerMapping: {
			user1: match.p1,
			user2: match.p2
		}
	};

	// set player names mapping used by pong page UI
	(window as any).playerNames = (window as any).playerNames || {};
	(window as any).playerNames["user1"] = match.p1.name;
	(window as any).playerNames["user2"] = match.p2.name;

	// localPlayerId for controlling player (defaults to user1 = left side)
	window.localPlayerId = "user1";

	// persist state (so if user goes back we still have it)
	saveTournamentState();

	// finally, load pong page
	loadPage("pong-board");
}

/**
 * Handler called when a match finishes.
 * Converts scores from user1/user2 format to left/right format and processes the result.
 */
function handleMatchResult(scores: Record<string, number>): void {
	// pull the active match info we stored prior to launch
	const cur = (window as any)._currentTournamentMatch as { 
		roundIndex: number; 
		matchIndex: number; 
		p1Id: number; 
		p2Id: number;
		playerMapping?: Record<string, tournamentPlayer>;
	} | undefined;
	
	if (!cur || !window.tournamentState) {
		console.warn("No current tournament match stored");
		return;
	}

	const { roundIndex, matchIndex } = cur;
	const state = window.tournamentState;
	const match = state.rounds[roundIndex][matchIndex];

	// Convert scores from user1/user2 to left/right
	// user1 is on left (p1), user2 is on right (p2)
	const leftScore = scores.user1 || scores.left || 0;
	const rightScore = scores.user2 || scores.right || 0;

	// mark played and set score
	match.played = true;
	match.score = { left: leftScore, right: rightScore };

	// determine winner player object
	let winnerPlayer: tournamentPlayer | null = null;
	if (leftScore > rightScore) winnerPlayer = match.p1!;
	else if (rightScore > leftScore) winnerPlayer = match.p2!;
	// tie -> none, treat as no propagation

	// propagate winner to next round
	const nextRoundIndex = roundIndex + 1;
	if (winnerPlayer && state.rounds[nextRoundIndex]) {
		const nextMatchIndex = Math.floor(matchIndex / 2);
		const nextMatch = state.rounds[nextRoundIndex][nextMatchIndex];
		if (nextMatch) {
			// place in p1 if this matchIndex is even, else p2
			if (matchIndex % 2 === 0) nextMatch.p1 = winnerPlayer;
			else nextMatch.p2 = winnerPlayer;
		}
	}

	// clear running metadata
	delete (window as any)._currentTournamentMatch;
	window.gameResults = { scores: {}, ended: true };

	// save & re-render
	saveTournamentState();
	renderBracketFromState(state);

	// ensure player name inputs are disabled after a match result is recorded
	setPlayerInputsDisabled(true);

	// set next current match automatically if any
	const next = findNextMatch(state);
	if (next) {
		setCurrentMatch(next.roundIndex, next.matchIndex);
		highlightCurrentMatchInDOM(next.roundIndex, next.matchIndex);
	} else {
		setCurrentMatch(0, null); // none left
	}

	// optionally notify user
	notify("Match result recorded. Next match ready.", { type: "success" });
}

/**
 * Highlight currently selected match in DOM (adds `current-match` class).
 */
function highlightCurrentMatchInDOM(roundIndex: number, matchIndex: number): void {
	// remove previous
	Array.from(document.querySelectorAll(".match-bracket.current-match")).forEach(el => el.classList.remove("current-match"));

	const target = roundsWrapper!.querySelector<HTMLElement>(`.tournament-round[data-round-index="${roundIndex}"] .match-bracket`);
	// more robust lookup:
	const roundElem = roundsWrapper!.querySelector<HTMLElement>(`.tournament-round[data-round-index="${roundIndex}"]`);
	if (!roundElem) return;
	const matchWrappers = Array.from(roundElem.querySelectorAll<HTMLElement>(".match-wrapper"));
	const wrapper = matchWrappers[matchIndex];
	if (!wrapper) return;
	const matchBracket = wrapper.querySelector<HTMLElement>(".match-bracket");
	if (matchBracket) matchBracket.classList.add("current-match");
}

/* ========================= BOOTSTRAP: wire up next-match ========================= */

/**
 * Build or load tournament state and render.
 * Call this once on page init (instead of calling InitializeBracket(players) when offline).
 */
function bootstrapTournamentOffline(playersInput: tournamentPlayer[]): void {
	// restore saved state or create new
	let state = loadTournamentState();
	if (!state) {
		state = buildInitialTournamentState(playersInput);
		window.tournamentState = state;
		saveTournamentState();
	} else {
		window.tournamentState = state;
		// handle match result if any (returning from a game)
		if (window.gameResults && window.gameResults.ended) {
			const cur = (window as any)._currentTournamentMatch as { roundIndex: number; matchIndex: number; p1Id: number; p2Id: number } | undefined;
			if (cur && window.gameResults.scores) {
				handleMatchResult(window.gameResults.scores);
			}
		}
	}

	// ensure window.playerList reflects players
	window.playerList = playersInput.slice();

	// render UI
	updatePlayerList(playersInput);
	renderBracketFromState(window.tournamentState);

	// set current match (if null, find one)
	if (!window.tournamentState.currentMatch) {
		const next = findNextMatch(window.tournamentState);
		if (next) setCurrentMatch(next.roundIndex, next.matchIndex);
		else setCurrentMatch(0, null);
	}

	// highlight
	if (window.tournamentState.currentMatch) {
		const c = window.tournamentState.currentMatch;
		highlightCurrentMatchInDOM(c.roundIndex, c.matchIndex);
	}

	// Add / bind next match button
	let nextBtn = document.getElementById("next-match-button") as HTMLButtonElement | null;
	if (!nextBtn) {
		nextBtn = document.createElement("button");
		nextBtn.id = "next-match-button";
		nextBtn.textContent = "Play next match";
		playerListElem!.appendChild(nextBtn);
	}
	addListener(nextBtn, "click", () => {
		// Ensure game is offline
		window.isGameOffline = true;
		
		// find next match to play
		const state = window.tournamentState!;
		const next = findNextMatch(state);
		if (!next) {
			notify("No next match available. Tournament complete!", { type: "info" });
			return;
		}
		// set it as current and launch
		setCurrentMatch(next.roundIndex, next.matchIndex);
		highlightCurrentMatchInDOM(next.roundIndex, next.matchIndex);
		launchCurrentMatch();
	});
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

// Add refresh button listener for online tournaments
if (isOnlineTournament) {
	const refreshBtn = document.getElementById("tournament-refresh-btn") as HTMLButtonElement | null;
	if (refreshBtn) {
		addListener(refreshBtn, "click", () => {
			refreshTournamentStatus();
		});
	}
	
	// Add leave button listener
	const leaveBtn = document.getElementById('tournament-leave-btn') as HTMLButtonElement | null;
	if (leaveBtn) {
		let isLeaving = false;
		addListener(leaveBtn, 'click', async () => {
			if (!tournamentId || isLeaving) return;
			isLeaving = true;
			leaveBtn.disabled = true;
			try {
				await leaveTournament(tournamentId);
				clearPendingGame();
				// Clear tournament data
				sessionStorage.removeItem('tournamentId');
				sessionStorage.removeItem('tournamentCode');
				sessionStorage.removeItem('tournamentMode');
				// Navigate back to lobby
				window.loadPage('lobby');
			} catch (error) {
				console.error('Failed to leave tournament:', error);
				isLeaving = false;
				leaveBtn.disabled = false;
			}
		});
	}
	else {
		// Hide leave button for offline tournaments
		const leaveBtn = document.getElementById('tournament-leave-btn') as HTMLButtonElement | null;
		if (leaveBtn) leaveBtn.style.display = 'none';
	}
}

// Cleanup function to stop polling on page unload
function cleanupTournamentPage(): void {
	stopWaitingForOpponentPoll();
}

registerDynamicCleanup(cleanupTournamentPage);

// Example usage (this will be replaced with actual data fetching logic)
let players: tournamentPlayer[];

if (window.tournamentMode === "offline") {
	players = [
		{ id: 1, name: "PlayerOne", rank: 1 },
		{ id: 2, name: "PlayerTwo", rank: 2 },
		{ id: 3, name: "PlayerThree", rank: 3 },
		{ id: 4, name: "PlayerFour", rank: 4 },
		{ id: 5, name: "PlayerFive", rank: 5 },
		{ id: 6, name: "PlayerSix", rank: 6 },
		{ id: 7, name: "PlayerSeven", rank: 7 },
		{ id: 8, name: "PlayerEight", rank: 8 },
	];
	
	// Bootstrap offline tournament (handles player list, bracket, and next match button)
	bootstrapTournamentOffline(players);
} else {
	console.log("Initializing online tournament from backend.");
	players = [];
	updatePlayerList(players);
	await initializeTournament();
	
	// Use existing ready button for online tournaments
	const readyBtn = document.getElementById("tournament-ready-btn") as HTMLButtonElement | null;
	if (readyBtn) {
		readyBtn.style.display = 'block';
		
		// Set initial button state
		updateReadyButtonState();
		
		addListener(readyBtn, "click", async () => {
			if (!currentMatchInfo) {
				notify("No current match available", { type: "info" });
				return;
			}
			
			if (currentMatchInfo.yourReady) {
				notify("You are already ready. Waiting for opponent...", { type: "info" });
				return;
			}
			
			readyBtn.disabled = true;
			readyBtn.textContent = "Readying...";
			
			try {
				await launchOnlineTournamentMatch();
			} finally {
				// Update button state based on current status
				updateReadyButtonState();
			}
			
			// Refresh status after a short delay to see if opponent is ready
			setTimeout(() => refreshTournamentStatus(), 1000);
		});
	} else {
		console.warn("Ready button not found in online tournament mode");
	}
}