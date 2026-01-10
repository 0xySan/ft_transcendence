export {};

const params = new URLSearchParams(window.location.search);
const user: string | null = params.get("user");

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

let currentUserId: string | null = null;
let viewedUserId: string | null = null;

async function getCurrentUser(): Promise<ProfileData | null> {
	try {
		const res = await fetch('/api/users/me', {
			method: 'GET',
			credentials: 'include'
		});
		if (!res.ok) {
			throw new Error('Not authenticated');
		}
		const data = await res.json();
		currentUserId = data.user?.id || null;
		return data;
	} catch (err) {
		notify(`${err}`, { type: 'error' });
		return null;
	}
}

async function ensureAuthenticated(): Promise<void> {
  try {
	const data = await getCurrentUser();
	const username = data?.user?.profile?.username;

	if (username)
		window.loadPage(`/profile?user=${encodeURIComponent(username)}`);
	else
		throw new Error('Username not found');
  }
  catch (err) {
	notify(`${err}`, { type: 'error' });
	window.loadPage('/');
  }
}

function updateProfileUI(profileData: ProfileData): void {
	const profile = profileData.user?.profile;

	const profileInfoDiv = document.querySelector('.profile-info');
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
	await getCurrentUser();
	
	if (!user) 
		await ensureAuthenticated();
	else
		await fetchProfileData(user);
}

initializeProfilePage();