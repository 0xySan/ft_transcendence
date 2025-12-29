export {};

const params = new URLSearchParams(window.location.search);
const user: string | null = params.get("user");

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

async function fetchProfileData(username: string): Promise<void> {
	try {
		const res = await fetch(`/api/users/username?username=${encodeURIComponent(username)}`, {
			method: 'GET',
			credentials: 'include'
		});
		if (!res.ok)
			throw new Error('Failed to fetch profile data');
		const profileData = await res.json();
		console.log('Profile Data:', profileData);
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

function handleEditProfile(): void {
	// Placeholder for future edit profile functionality
	console.log('Edit Profile button clicked');
}

const editProfileButton = document.getElementById('edit-profile-button');
if (editProfileButton) {
	editProfileButton.addEventListener('click', handleEditProfile);
}

//initializeProfilePage();