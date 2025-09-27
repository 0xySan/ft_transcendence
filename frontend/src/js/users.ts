interface User {
	id: number;
	username: string;
	created_at?: string;
}

// Utility to render users into the UL element
function renderUsers(users: User[]) {
	const list = document.getElementById("userList");
	if (!list) return;

	// Clear previous content
	list.innerHTML = "";

	// Populate list with user items
	users.forEach((user) => {
		const li = document.createElement("li");
		li.textContent = user.username;
		list.appendChild(li);
	});
}

// Fetch users from backend API
async function fetchUsers() {
	try {
		const response = await fetch("/api/users");
		if (!response.ok) {
			throw new Error(`HTTP error ${response.status}`);
		}
		const data: User[] = await response.json();
		renderUsers(data);
	} catch (err) {
		console.error("Failed to fetch users:", err);
	}
}

fetchUsers();
