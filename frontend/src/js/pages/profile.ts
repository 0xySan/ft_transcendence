export {};

declare function getUserLang(): string;

const params = new URLSearchParams(window.location.search);
let user: string | null = params.get("user");

// Default avatar template
const DEFAULT_AVATAR = (() => {
	const template = document.querySelector<HTMLTemplateElement>('.profile-default-pfp-temp');
	return template
		? (template.content.cloneNode(true) as DocumentFragment)
		: document.createDocumentFragment();
})();

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

let currentUserId: string | null = null;
let viewedUserId: string | null = null;

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

function updateStatsUI(gameStats: GameStats): void {
	const { stats, recentGames } = gameStats;

	// Update stats display
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

			if (winspan) winspan.textContent = `🏆 Wins ${wins.toString()} / `;
			if (lossspan) lossspan.textContent = `💔 Losses ${losses.toString()}`;
			if (wlrspan) wlrspan.textContent = `📊 Win Rate ${winRate.toString()}% / `;
		}
	}

	// Show and update recent games
	const gamesContainer = document.querySelector('.profile-recent-games');
	if (gamesContainer) {
		gamesContainer.classList.remove('nondisplayable');
	}

	const gamesContent = document.querySelector('.profile-recent-games-content');
	if (gamesContent) {
		gamesContent.innerHTML = '';
		if (recentGames.length === 0) {
			const gamesTitle = document.querySelector('.profile-recent-games-title');
			if (gamesTitle) gamesTitle.textContent = 'There is no recent games :(';
		} else {
			const template = document.querySelector<HTMLTemplateElement>('.profile-game-item-temp');
			if (!template) {
				notify('Game item template not found', { type: 'error' });
				return;
			}
			recentGames.forEach(game => {
				const gameItem = template.content.cloneNode(true) as DocumentFragment;
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
				
				// Populate left player (first participant)
				if (game.participants[0]) {
					const pic1 = gameItem.querySelector('.profile-game-pic.pic1') as HTMLImageElement;
					const name1 = gameItem.querySelector('.profile-game-name.name1') as HTMLDivElement;
					const score1 = gameItem.querySelector('.profile-game-score.score1') as HTMLDivElement;
					
					if (pic1) {
						if (game.participants[0].profilePicture) {
							pic1.src = `/api/users/data/imgs/${game.participants[0].profilePicture}`;
							pic1.onerror = () => {
								const fallback = DEFAULT_AVATAR.cloneNode(true) as DocumentFragment;
								const svg = fallback.querySelector('svg');
								if (svg) {
									svg.classList.add('profile-game-pic', 'pic1');
									svg.classList.remove('profile-info-img');
								}
								pic1.replaceWith(fallback);
							};
						} else {
							const fallback = DEFAULT_AVATAR.cloneNode(true) as DocumentFragment;
							const svg = fallback.querySelector('svg');
							if (svg) {
								svg.classList.add('profile-game-pic', 'pic1');
								svg.classList.remove('profile-info-img');
							}
							pic1.replaceWith(fallback);
						}
					}
					if (name1) name1.textContent = game.participants[0].displayName || game.participants[0].username || game.participants[0].userId;
					if (score1) score1.textContent = `${game.participants[0].score}`;
				}
				
				// Populate right player (second participant)
				if (game.participants[1]) {
					const pic2 = gameItem.querySelector('.profile-game-pic.pic2') as HTMLImageElement;
					const name2 = gameItem.querySelector('.profile-game-name.name2') as HTMLDivElement;
					const score2 = gameItem.querySelector('.profile-game-score.score2') as HTMLDivElement;
					
					if (pic2) {
						if (game.participants[1].profilePicture) {
							pic2.src = `/api/users/data/imgs/${game.participants[1].profilePicture}`;
							pic2.onerror = () => {
								const fallback = DEFAULT_AVATAR.cloneNode(true) as DocumentFragment;
								const svg = fallback.querySelector('svg');
								if (svg) {
									svg.classList.add('profile-game-pic', 'pic2');
									svg.classList.remove('profile-info-img');
								}
								pic2.replaceWith(fallback);
							};
						} else {
							const fallback = DEFAULT_AVATAR.cloneNode(true) as DocumentFragment;
							const svg = fallback.querySelector('svg');
							if (svg) {
								svg.classList.add('profile-game-pic', 'pic2');
								svg.classList.remove('profile-info-img');
							}
							pic2.replaceWith(fallback);
						}
					}
					if (name2) name2.textContent = game.participants[1].displayName || game.participants[1].username || game.participants[1].userId;
					if (score2) score2.textContent = `${game.participants[1].score}`;
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
		// Show button only if viewing someone else's profile
		if (currentUserId && viewedUserId && currentUserId !== viewedUserId) {
			chatButton.classList.remove('nondisplayable');
			
			// Remove any existing event listeners by cloning
			const newButton = chatButton.cloneNode(true) as HTMLButtonElement;
			chatButton.parentNode?.replaceChild(newButton, chatButton);
			
			// Add click handler to create direct conversation
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

async function initializeProfilePage(): Promise<void> {
	// Always fetch current user data first
	await fetchCurrentUser();
	
	if (user)
		await fetchProfileData(user);
	else
		window.loadPage('/');
}

initializeProfilePage();