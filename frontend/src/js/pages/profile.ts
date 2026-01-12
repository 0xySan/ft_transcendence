/**
 * @file profile.ts
 * @description Handles the user profile page functionality including:
 * - Fetching and displaying user profile information
 * - Displaying user game statistics and recent games
 * - Managing profile image and background display
 * - Handling direct chat initialization
 */
export {};

declare function getUserLang(): string;

// Extract username from URL query parameters
const params = new URLSearchParams(window.location.search);
let user: string | null = params.get("user");

// Default avatar template
// Clones a pre-defined SVG template to use as a fallback when profile pictures are unavailable
const DEFAULT_AVATAR = (() => {
	const template = document.querySelector<HTMLTemplateElement>('.profile-default-pfp-temp');
	return template
		? (template.content.cloneNode(true) as DocumentFragment)
		: document.createDocumentFragment();
})();

/**
 * Interface for complete user profile data including user metadata and profile details
 */
interface ProfileData {
	user: {
		id: string;
		createdAt: string;
		profile: {
			username: string;
			displayName: string | null;
			profilePicture: string | null;
			backgroundPicture: string | null;
			bio: string | null;
			country: {
				id: string;
				name: string;
				code: string;
				flag: string;
			} | null
		}
	}
}

/**
 * Interface for game statistics and recent game data
 * Contains overall stats and an array of recent games with participant details
 */
interface GameStats {
	stats: {
		gamesPlayed: number;
		gamesWon: number;
		gamesLost: number;
		eloRating: number;
		level: number;
		rank: number;
		totalPlayTime: number;
		winRate: number;
	};
	recentGames: Array<{
		id: number;
		createdAt: string;
		duration: number | null;
		mode: string;
		status: string;
		scoreLimit: number;
		winnerId: string | null;
		participants: Array<{
			userId: string;
			username: string | null;
			displayName: string | null;
			profilePicture: string | null;
			team: number | null;
			score: number;
			result: string | null;
		}>;
	}>;
}

// Global variables to track the currently logged-in user and the user being viewed
let currentUserId: string | null = null;
let viewedUserId: string | null = null;

/**
 * Fetches the current logged-in user's data
 * Sets currentUserId and initializes the user parameter if not already set
 * @returns {Promise<ProfileData | null>} The current user's profile data or null on error
 */
async function fetchCurrentUser(): Promise<ProfileData | null> {
	try {
		const res = await fetch('/api/users/me', {
			method: 'GET',
			credentials: 'include'
		});
		if (!res.ok) {
			throw new Error('Failed to fetch current user data as user is not logged in');
		}
		const data = await res.json();
		currentUserId = data.user?.id || null;
		if (!user)
			user = data.user?.profile?.username || null;
		return data;
	} catch (err) {
		notify(`${err}`, { type: 'warning' });
		return null;
	}
}

/**
 * Fetches game statistics for a specific user from the backend
 * Retrieves the last 10 games and overall statistics
 * @param {string} userId - The ID of the user to fetch stats for
 * @returns {Promise<void>}
 */
async function updateGameStats(userId: string): Promise<void> {
	try {
		if (!currentUserId)
			return ;
		const res = await fetch('/api/game/stats?limit=10', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify({ userId })
		});

		if (!res.ok)
			throw new Error('Failed to fetch game stats');

		const data: GameStats = await res.json();
		updateStatsUI(data);
	} catch (err) {
		notify(`${err}`, { type: 'error' });
	}
}

/**
 * Updates the UI with game statistics and recent games
 * Populates the stats display and renders game cards for 2-player and 4-player modes
 * @param {GameStats} gameStats - The game statistics and recent games data
 * @returns {void}
 */
function updateStatsUI(gameStats: GameStats): void {
	const { stats, recentGames } = gameStats;

	// Update stats display with wins, losses, and win rate
	const statsContainer = document.querySelector('.profile-info-stats') as HTMLDivElement;
	if (statsContainer) {
		const wlrDiv = statsContainer.querySelector('.profile-stats-wlr') as HTMLDivElement;
		if (wlrDiv) {
			const wins = stats.gamesWon;
			const losses = stats.gamesLost;
			const winRate = stats.winRate;
			const winspan = wlrDiv.querySelector('.profile-stat-wins') as HTMLSpanElement;
			const lossspan = wlrDiv.querySelector('.profile-stat-losses') as HTMLSpanElement;
			const wlrspan = wlrDiv.querySelector('.profile-stat-winrate') as HTMLSpanElement;

			if (winspan) winspan.textContent = `Wins ${wins.toString()}`;
			if (lossspan) lossspan.textContent = `Losses ${losses.toString()}`;
			if (wlrspan) wlrspan.textContent = `Win Rate ${winRate.toString()}%`;
		}
	}

	// Show and display recent games section
	const gamesContainer = document.querySelector('.profile-recent-games');
	if (gamesContainer) {
		gamesContainer.classList.remove('nondisplayable');
	}

	// Render recent games with appropriate templates based on player count
	const gamesContent = document.querySelector('.profile-recent-games-content');
	if (gamesContent) {
		gamesContent.innerHTML = '';
		if (recentGames.length === 0) {
			const gamesTitle = document.querySelector('.profile-recent-games-title');
			if (gamesTitle) gamesTitle.textContent = 'There is no recent games :(';
		} else {
			const template2p = document.querySelector<HTMLTemplateElement>('.profile-game-item-temp');
			const template4p = document.querySelector<HTMLTemplateElement>('.profile-game-item-4p-temp');
			if (!template2p || !template4p) {
				notify('Game item template not found', { type: 'error' });
				return;
			}
			recentGames.forEach(game => {
				const playerCount = game.participants.length;
				const template = playerCount <= 2 ? template2p : template4p;
				const gameItem = template.content.cloneNode(true) as DocumentFragment;
				
				// Format the game date/time according to user's language preference
				const date = new Date(game.createdAt).toLocaleDateString(getUserLang(), {
					year: 'numeric',
					month: 'short',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit'
				});
				
				const modeSpan = gameItem.querySelector('.profile-game-mode') as HTMLSpanElement;
				const dateSpan = gameItem.querySelector('.profile-game-date') as HTMLSpanElement;
				const statusSpan = gameItem.querySelector('.profile-game-status') as HTMLSpanElement;
				const resultSpan = gameItem.querySelector('.profile-game-result') as HTMLSpanElement;
				
				if (modeSpan) modeSpan.textContent = game.mode.toUpperCase();
				if (dateSpan) dateSpan.textContent = date;
				if (statusSpan) statusSpan.textContent = game.status;
				
				// Populate game item based on player count (2-player vs 4-player modes)
				if (playerCount <= 2) {
					// 2-player game: populate individual players
					const populatePlayer = (index: number) => {
						if (!game.participants[index]) return;
						
						const participant = game.participants[index];
						const picClass = `pic${index + 1}`;
						const nameClass = `name${index + 1}`;
						const scoreClass = `score${index + 1}`;
						
						const pic = gameItem.querySelector(`.profile-game-pic.${picClass}`) as HTMLImageElement;
						const name = gameItem.querySelector(`.profile-game-name.${nameClass}`) as HTMLDivElement;
						const score = gameItem.querySelector(`.profile-game-score.${scoreClass}`) as HTMLDivElement;
						
						if (pic) {
							if (participant.profilePicture) {
								pic.src = `/api/users/data/imgs/${participant.profilePicture}`;
								pic.onerror = () => {
									const fallback = DEFAULT_AVATAR.cloneNode(true) as DocumentFragment;
									const svg = fallback.querySelector('svg');
									if (svg) {
										svg.classList.add('profile-game-pic', picClass);
										svg.classList.remove('profile-info-img');
									}
									pic.replaceWith(fallback);
								};
							} else {
								const fallback = DEFAULT_AVATAR.cloneNode(true) as DocumentFragment;
								const svg = fallback.querySelector('svg');
								if (svg) {
									svg.classList.add('profile-game-pic', picClass);
									svg.classList.remove('profile-info-img');
								}
								pic.replaceWith(fallback);
							}
						}
						if (name) name.textContent = participant.displayName || participant.username || participant.userId;
						if (score) score.textContent = `${participant.score}`;
					};
					
					for (let i = 0; i < Math.min(playerCount, 2); i++) {
						populatePlayer(i);
					}
				} else {
					// 4-player game: populate mini player cards and calculate team scores
					// Teams: Left (players 0+1), Right (players 2+3)
					const populatePlayerMini = (index: number) => {
						if (!game.participants[index]) return;
						
						const participant = game.participants[index];
						const picClass = `pic${index + 1}`;
						const nameClass = `name${index + 1}`;
						
						const pic = gameItem.querySelector(`.profile-game-pic-mini.${picClass}`) as HTMLImageElement;
						const name = gameItem.querySelector(`.profile-game-name-mini.${nameClass}`) as HTMLDivElement;
						
						if (pic) {
							if (participant.profilePicture) {
								pic.src = `/api/users/data/imgs/${participant.profilePicture}`;
								pic.onerror = () => {
									const fallback = DEFAULT_AVATAR.cloneNode(true) as DocumentFragment;
									const svg = fallback.querySelector('svg');
									if (svg) {
										svg.classList.add('profile-game-pic-mini', picClass);
										svg.classList.remove('profile-info-img');
									}
									pic.replaceWith(fallback);
								};
							} else {
								const fallback = DEFAULT_AVATAR.cloneNode(true) as DocumentFragment;
								const svg = fallback.querySelector('svg');
								if (svg) {
									svg.classList.add('profile-game-pic-mini', picClass);
									svg.classList.remove('profile-info-img');
								}
								pic.replaceWith(fallback);
							}
						}
						if (name) name.textContent = participant.displayName || participant.username || participant.userId;
					};
					
					// Populate all 4 players
					for (let i = 0; i < Math.min(playerCount, 4); i++) {
						populatePlayerMini(i);
					}
					
					// Calculate team scores (team 1: players 1&2, team 2: players 3&4)
					let leftScore = 0;
					let rightScore = 0;
					
					if (game.participants[0]) leftScore += game.participants[0].score;
					if (game.participants[1]) leftScore += game.participants[1].score;
					if (game.participants[2]) rightScore += game.participants[2].score;
					if (game.participants[3]) rightScore += game.participants[3].score;
					
					const scoreLeftSpan = gameItem.querySelector('.profile-game-team-score.score-left') as HTMLSpanElement;
					const scoreRightSpan = gameItem.querySelector('.profile-game-team-score.score-right') as HTMLSpanElement;
					
					if (scoreLeftSpan) scoreLeftSpan.textContent = `${leftScore}`;
					if (scoreRightSpan) scoreRightSpan.textContent = `${rightScore}`;
				}
				
				const resultuser = game.participants.find(p => p.userId === viewedUserId);
				if (resultuser && resultSpan) {
					const result = resultuser.result || 'N/A';
					resultSpan.textContent = result.toUpperCase();
					resultSpan.className = `profile-game-result result-${result.toLowerCase()}`;
				}
				
				gamesContent.appendChild(gameItem);
			});
		}
	}
}

/**
 * Updates the main profile UI with user information
 * Loads profile image, display name, bio, country flag, and background image
 * Handles "Add to Chat" button visibility based on user context
 * @param {ProfileData} profileData - The user's profile data
 * @returns {void}
 */
function updateProfileUI(profileData: ProfileData): void {
	const profile = profileData.user?.profile;

	const profileInfoDiv = document.querySelector('.profile-info') as HTMLDivElement;
	if (!profileInfoDiv) {
		notify('Profile info div not found', { type: 'error' });
		return;
	}

	profileInfoDiv.classList.remove('nondisplayable');

	if (!profile) {
		notify('No profile data available', { type: 'error' });
		return;
	}

	// Update profile image
	const profileImg = document.querySelector('.profile-info-img') as HTMLImageElement;
	if (profileImg) {
		if (profile.profilePicture) {
			profileImg.src = `/api/users/data/imgs/${profile.profilePicture}`;
			profileImg.onerror = () => {
				// Replace img with SVG fallback on error
				const fallback = DEFAULT_AVATAR.cloneNode(true) as DocumentFragment;
				profileImg.replaceWith(fallback);
				notify('Failed to load profile picture', { type: 'error' });
			};
		}
		else {
			// Replace img with SVG fallback if no picture
			const fallback = DEFAULT_AVATAR.cloneNode(true) as DocumentFragment;
			profileImg.replaceWith(fallback);
		}
	}
	else
		console.warn('Profile image element not found');

	// Update display name
	const displayName = document.querySelector('.profile-display-name');
	if (displayName) {
		displayName.textContent = profile.displayName || profile.username;
	}

	// Update username
	const username = document.querySelector('.profile-info-username');
	if (username)
		username.textContent = `@${profile.username}`;

	// Update flag
	const flag = document.querySelector('.profile-info-flag') as HTMLImageElement;
	if (flag && profile.country?.code ) {
		flag.src = `/resources/imgs/svg/flags/${profile.country.code.toLowerCase()}.svg`;
		flag.alt = profile.country.code;
	}
	else if (flag)
		flag.style.display = 'none';

	// Update bio
	const bioText = document.querySelector('.profile-info-bio p');
	if (bioText)
	{
		while (bioText.firstChild)
			bioText.removeChild(bioText.firstChild);
		const labelSpan = document.createElement('span');

		labelSpan.className = 'profile-info-bio-label';
		labelSpan.textContent = 'Bio :';
		bioText.appendChild(labelSpan);
		bioText.appendChild(document.createElement('br'));
		const bioContent = document.createTextNode(profile.bio || 'No bio available.');
		bioText.appendChild(bioContent);
	}

	// Fetch and update game stats
	if (viewedUserId)
		updateGameStats(viewedUserId);

	// Update background image
	const backgroundImg = document.querySelector('#profile-div') as HTMLImageElement;
	if (backgroundImg) {
		if (profile.backgroundPicture) {
			backgroundImg.style.backgroundImage = `url(/api/users/data/imgs/${profile.backgroundPicture})`;
			backgroundImg.onerror = () => {
				backgroundImg.style.backgroundImage = 'none';
				notify('Failed to load background image', { type: 'error' });
			};
		} else {
			backgroundImg.style.backgroundImage = 'none';
		}
	}

	// Update "Add to chat" button visibility
	const chatButton = document.querySelector('.profile-chat-button') as HTMLButtonElement;
	if (chatButton) {
		// Show button only if viewing someone else's profile and not your own
		if (currentUserId && viewedUserId && currentUserId !== viewedUserId) {
			chatButton.classList.remove('nondisplayable');
			
			// Remove any existing event listeners by cloning
			const newButton = chatButton.cloneNode(true) as HTMLButtonElement;
			chatButton.parentNode?.replaceChild(newButton, chatButton);
			
			// Add click handler to create direct conversation with the viewed user
			newButton.addEventListener('click', async () => {
				try {
					const res = await fetch('/api/chat/direct', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						credentials: 'include',
						body: JSON.stringify({ targetUserId: viewedUserId })
					});

					if (!res.ok)
						throw new Error('Failed to create conversation');

					window.loadPage('/chat');
				} catch (err) {
					notify('Failed to create chat. Please try again.', { type: 'error' });
				}
			});
		}
		else
			chatButton.classList.add('nondisplayable');
	}
}

/**
 * Fetches profile data for a specific username from the backend
 * Updates the viewedUserId and renders the profile UI
 * Displays error message if user is not found (404)
 * @param {string} username - The username to fetch profile data for
 * @returns {Promise<void>}
 */
async function fetchProfileData(username: string): Promise<void> {
	try {
		const res = await fetch(`/api/users/username?username=${encodeURIComponent(username)}`, {
			method: 'GET',
			credentials: 'include'
		});
		if (!res.ok)
			throw new Error('Failed to fetch profile data');
		const profileData: ProfileData = await res.json();
		
		// Store the viewed user's ID
		viewedUserId = profileData.user?.id || null;
		
		// Update the UI with the fetched data
		updateProfileUI(profileData);
	}
	catch (err) {
		notify(`${err}`, { type: 'error' });
		const profileDiv = document.querySelector<HTMLDivElement>('#profile-div');

		if (profileDiv) {
			const errorDiv = document.createElement('div');
			errorDiv.className = 'profile-error-message';
			errorDiv.textContent = 'Error 404: User not found';
			profileDiv.appendChild(errorDiv);
		}
	}
}

/**
 * Initializes the profile page on load
 * Fetches current user data first, then loads the requested user's profile
 * Redirects to home if no user is specified
 * @returns {Promise<void>}
 */
async function initializeProfilePage(): Promise<void> {
	// Always fetch current user data first to establish authentication context
	await fetchCurrentUser();
	
	// Load the requested user's profile or redirect to home if none specified
	if (user)
		await fetchProfileData(user);
	else
		window.loadPage('/');
}

// Execute profile page initialization on script load
initializeProfilePage();