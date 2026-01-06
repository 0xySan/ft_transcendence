export {};

const params = new URLSearchParams(window.location.search);
const user: string | null = params.get("user");

interface ProfileData {
	user: {
		id: string;
		email: string;
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
		console.error(err);
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
	console.error(err);
	window.loadPage('/');
  }
}

function updateProfileUI(profileData: ProfileData): void {
	const profile = profileData.user?.profile;

	const profileInfoDiv = document.querySelector('.profile-info');
	if (!profileInfoDiv) {
		console.error('Profile info div not found');
		return;
	}

	profileInfoDiv.classList.remove('hidden');

	if (!profile) {
		console.error('No profile data available');
		return;
	}

	// Update profile image
	const profileImg = document.querySelector('.profile-info-img') as HTMLImageElement;
	if (profileImg) {
		console.log('Setting profile picture to:', profile.profilePicture);
		if (profile.profilePicture) {
			profileImg.src = `/api/users/data/imgs/${profile.profilePicture}`;
			profileImg.onerror = () => {
				console.error('Failed to load profile picture from:', profile.profilePicture);
				profileImg.src = '/resources/imgs/default-avatar.svg'; // fallback
			};
			console.log('Profile picture set to:', profile.profilePicture);
		} else {
			profileImg.src = '/resources/imgs/default-avatar.svg'; // fallback
		}
	} else {
		console.warn('Profile image element not found');
	}

	// Update display name
	const displayName = document.querySelector('.profile-display-name');
	if (displayName) {
		displayName.textContent = profile.displayName || profile.username;
	}

	// Update username
	const username = document.querySelector('.profile-info-username');
	if (username) {
		username.textContent = `@${profile.username}`;
	}

	// Update flag
	const flag = document.querySelector('.profile-info-flag') as HTMLImageElement;
	if (flag && profile.country?.code ) {
		flag.src = `/resources/imgs/svg/flags/${profile.country.code.toLowerCase()}.svg`;
		flag.alt = profile.country.code;
	} else if (flag) {
		flag.style.display = 'none';
	}

	// Update bio
	const bioText = document.querySelector('.profile-info-bio p');
	if (bioText) {
		if (profile.bio) {
			bioText.innerHTML = `<span class="profile-info-bio-label">Bio :</span><br>${profile.bio}`;
		} else {
			bioText.innerHTML = '<span class="profile-info-bio-label">Bio :</span><br>No bio available.';
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

					if (!res.ok) {
						throw new Error('Failed to create conversation');
					}

					const data = await res.json();
					// Navigate to chat page with the conversation ID
					window.loadPage('/chat');
				} catch (err) {
					console.error('Error creating chat:', err);
					alert('Failed to create chat. Please try again.');
				}
			});
		} else {
			chatButton.classList.add('hidden');
		}
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
		console.log('Profile Data:', profileData);
		
		// Store the viewed user's ID
		viewedUserId = profileData.user?.id || null;
		
		// Update the UI with the fetched data
		updateProfileUI(profileData);
	}
	catch (err) {
		console.error(err);
		const content = document.getElementById('content');
		if (content) content.innerHTML = '<div style="text-align: center; padding: 40px; font-size: 18px; color: red;">Error 404: User not found</div>';
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