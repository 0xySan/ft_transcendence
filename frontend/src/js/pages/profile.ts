export {};

const params = new URLSearchParams(window.location.search);
const user: string | null = params.get("user");

interface ProfileData {
	user: {
		createdAt: string;
		profile: {
			bio?: string;
			profilePicture?: string;
			countryCode?: string;
			displayName?: string;
			username: string;
		};
	};
}

async function ensureAuthenticated(): Promise<void> {
  try {
	const res = await fetch('/api/users/me', {
		method: 'GET',
		credentials: 'include'
	});
	if (!res.ok) {
		throw new Error('Not authenticated');
	}
	
	const data = await res.json();
	const username = data.user?.profile?.username;

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
	if (flag && profile.countryCode) {
		flag.src = `/resources/imgs/svg/flags/${profile.countryCode.toLowerCase()}.svg`;
		flag.alt = profile.countryCode;
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
		
		// Update the UI with the fetched data
		updateProfileUI(profileData);
	}
	catch (err) {
		console.error(err);
		const content = document.getElementById('content');
		if (content) content.innerHTML = '<div style="text-align: center; padding: 40px; font-size: 18px; color: red;">Error 404: User not found</div>';
	}
}

function initializeProfilePage(): void {
	if (!user) 
		ensureAuthenticated();
	else
		fetchProfileData(user);
}

initializeProfilePage();