// chatPage.ts
export {};

// -------------------------------------
// CONFIG
// -------------------------------------
interface Message {
	sender: string;
	text: string;
	timestamp: Date;
	hidden?: boolean;
	// optional: message type for richer UI (invite/system/etc)
	type?: 'text' | 'invite' | 'system';
	// for invites: 'pending' | 'accepted' | 'declined' | 'cancelled'
	inviteState?: 'pending' | 'accepted' | 'declined' | 'cancelled';
	// invited game: 'pong' or 'tetris'
	game?: 'pong' | 'tetris';
}

interface Conversation {
	[username: string]: Message[];
}

const MESSAGES_PAGE = 100; // page size for incremental loading
const NAVIGATION_DELAY = 150;
const KEYBOARD_ADJUST_DELAY = 50;
const SCROLL_THRESHOLD = 100; // px from bottom to consider "near bottom"
const LOAD_MORE_THRESHOLD = 20; // px from top to trigger loading more messages

const conversations: Conversation = {};
let activeUser: string | null = null;

const blockedUsers: Set<string> = new Set(); // track blocked users

// track for each conversation where the visible window starts (index into conversation array)
const visibleStart: Record<string, number> = {};

// Drafts: keep per-conversation drafts in-memory and persist to sessionStorage
const DRAFTS_KEY = 'chat_drafts';
const drafts: Record<string, string> = (() => {
	try {
		return JSON.parse(sessionStorage.getItem(DRAFTS_KEY) || '{}');
	}
	catch (e) {
		return {};
	}
})();

function saveDraft(user: string | null, text: string)
{
	if (!user) return;
	drafts[user] = text;
	try { sessionStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts)); } catch (e) { /* ignore */ }
}

function clearDraft(user: string | null)
{
	if (!user) return;
	delete drafts[user];
	try { sessionStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts)); } catch (e) { /* ignore */ }
}

const userListDiv = document.querySelector<HTMLDivElement>(".user-list")!;
const chatBlock = document.querySelector<HTMLDivElement>(".chat-block")!;

// Single global handler to hide the invite menu when clicking outside.
// This avoids adding/removing listeners on every `renderChat()` call and
// prevents accumulating duplicate listeners (memory leak / performance).
function globalHideInviteMenu(event: MouseEvent) {
	const inviteMenu = document.querySelector<HTMLDivElement>('.invite-menu');
	const inviteBtn = document.querySelector<HTMLButtonElement>('.chat-invite-btn');
	if (!inviteMenu) return;
	// only act when the menu is currently visible
	if (inviteMenu.style.display === 'block') {
		const target = event.target as Node | null;
		if (target && !inviteMenu.contains(target) && !(inviteBtn && inviteBtn.contains(target))) {
			inviteMenu.style.display = 'none';
		}
	}
}
document.addEventListener('click', globalHideInviteMenu);

// New: track whether the user list is hidden (for mobile/full chat)
let userListHidden = false;

// Set CSS variable --vh to avoid 100vh issues on mobile when virtual keyboard opens.
function updateVh()
{
	document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`); // 1% of the viewport height
}
// initial
updateVh();
// update on resize/orientation change
window.addEventListener('resize', updateVh);
window.addEventListener('orientationchange', updateVh);

// When the chat input receives focus on mobile, update vh again to account for keyboard.
document.addEventListener('focusin', (e) => {
	const target = e.target as HTMLElement | null;
	if (!target) return;
	if (target.closest && target.closest('.chat-input'))
		setTimeout(updateVh, KEYBOARD_ADJUST_DELAY); // small timeout to allow browser to adjust viewport first
});

// Persistent toggle button placed into the user list (moved out of chat header)
const headerToggleBtn = document.querySelector<HTMLButtonElement>(".chat-header-toggle-users")!;
function updateToggleBtnText() {
	headerToggleBtn.setAttribute("aria-pressed", String(userListHidden));
	headerToggleBtn.title = userListHidden ? "Show users" : "Hide users";
}
updateToggleBtnText();

headerToggleBtn.addEventListener("click", (e) => {
	e.preventDefault();
	e.stopPropagation();
	userListHidden = !userListHidden;

	// physically hide/show the user list element
	if (userListHidden)
		userListDiv.classList.add('hidden');
	else
		userListDiv.classList.remove('hidden');

	updateToggleBtnText();
});

// -------------------------------------
// DUMMY DATA SETUP
// -------------------------------------
const users: string[] = [];
for (let i = 0; i < 6; i++) {
	users.push("user" + i);
}

const profilepics: string[] = [];
for (let _ = 0; _ < 6; _++) {
	profilepics.push(`https://cdn.discordapp.com/embed/avatars/${Math.floor(Math.random() * 10) % 5}.png`);
}

// -------------------------------------
// SEED DUMMY CONVERSATIONS
// -------------------------------------
users.forEach((name, i) => {
	const base = Date.now() - (i + 1) * 6000000;
	const list: Message[] = [];
	// create many messages for testing possibly exceeding page
	const count = Math.floor(Math.random() * 1000); // random length up to 1000
	for (let j = 0; j < count; j++) {
		let random = Math.floor(Math.random() * 3);
		list.push({
			sender: (random === 0) ? name : "me",
			text: `msg ${j} from ${(random === 0) ? name : "me"}`,
			timestamp: new Date(base + j),
		});
	}
	// ensure at least a few messages
	if (list.length === 0) {
		list.push({ sender: name, text: "Hey! This is a placeholder message.", timestamp: new Date(base) });
		list.push({ sender: "me", text: "Nice, just testing the chat UI!", timestamp: new Date(base + 1) });
	}
	conversations[name] = list;
});

conversations["user4"] = [
	{ sender: "user4", type: 'invite', inviteState: 'pending', game: 'tetris', text: "Wanna play Tetris?", timestamp: new Date(Date.now() + 1) },
	{ sender: "user4", type: 'invite', inviteState: 'pending', game: 'pong', text: "Wanna play Pong?", timestamp: new Date(Date.now() + 2) },
	{ sender: "user4", text: "This is a longer message to test how the chat UI handles wrapping and multiple lines. Let's see how it looks when the message exceeds the typical length of a chat bubble. Hopefully, it wraps nicely and remains readable!", timestamp: new Date(Date.now() + 3) },
	{ sender: "me", text: "Indeed, it seems to be working well!\nNew line test.", timestamp: new Date(Date.now() + 4) },
];

conversations["user2"] = []; // empty conversation for testing

conversations["Dummy"] = [
	{ sender: "Dummy", text: "Hi there!", timestamp: new Date(Date.now() + 5) },
	{ sender: "me", text: "Hello Dummy, how are you?", timestamp: new Date(Date.now() + 6) },
	{ sender: "me", type: 'invite', inviteState: 'accepted', game: 'pong', text: "Wanna play Pong?", timestamp: new Date(Date.now() + 7) },
];

users.push("Dummy");
profilepics.push("https://i.ibb.co/VcQ5RQwX/dummy.png");

// -------------------------------------
// SORTING HELPERS + RENDER USER LIST
// -------------------------------------
function getLastTimestamp(name: string): number
{
	const msgs = conversations[name] || [];
	if (msgs.length === 0) return 0;
	return Math.max(...msgs.map((m) => m.timestamp.getTime()));
}

function renderUserList()
{
	const sortedUsers = Object.keys(conversations).sort((a, b) => {
		return getLastTimestamp(b) - getLastTimestamp(a); // descending: newest first
	});

	sortedUsers.forEach((name) => {
		const userItem = document.createElement('div');
		userItem.className = 'user-item';
		userItem.dataset.username = name;
		if (name === activeUser) userItem.classList.add('selected');
		if (blockedUsers.has(name)) userItem.classList.add('blocked');

		const img = document.createElement('img');
		img.className = 'img_profile';
		img.src = profilepics[users.indexOf(name) % profilepics.length];
		img.alt = '';

		const txt = document.createElement('p');
		txt.className = 'name_profile';
		txt.textContent = name;

		userItem.appendChild(img);
		userItem.appendChild(txt);

		userItem.addEventListener("click", () => {
			activeUser = name;
			// initialize visibleStart so only last page is shown
			const msgs = conversations[name] || [];
			visibleStart[name] = Math.max(0, msgs.length - MESSAGES_PAGE);
			reorderUserList(name);
			renderChat();
		});

		userListDiv.appendChild(userItem);
	});
}

// Reorder existing DOM nodes for the user list without rebuilding everything.
function reorderUserList(movedUser: string)
{
	// find existing DOM node for this user
	const selector = `.user-item[data-username="${CSS.escape(movedUser)}"]`;
	const item = userListDiv.querySelector<HTMLDivElement>(selector);
	if (!item) return;
	// update selection state
	userListDiv.querySelectorAll<HTMLDivElement>('.user-item.selected').forEach((el) => {
		if (el !== item) el.classList.remove('selected');
	});
	if (activeUser === movedUser)
		item.classList.add('selected');
	else
		item.classList.remove('selected');

	if (blockedUsers.has(movedUser))
		item.classList.add('blocked');
	else
		item.classList.remove('blocked');
	// Insert the item into the correct position to keep list sorted by last activity (newest first).
	// This moves the existing node rather than rebuilding the whole list.
	const existingItems = Array.from(userListDiv.querySelectorAll<HTMLDivElement>('.user-item'));
	const movedTs = getLastTimestamp(movedUser);
	let inserted = false;
	for (const other of existingItems)
	{
		if (other === item) continue;
		const otherName = other.dataset.username || '';
		const otherTs = getLastTimestamp(otherName);
		// place item before the first user with a smaller timestamp (so newest appear first)
		if (otherTs < movedTs)
		{
			userListDiv.insertBefore(item, other);
			inserted = true;
			break;
		}
	}
	if (!inserted)
		userListDiv.appendChild(item); // if we didn't find a smaller timestamp, put it at the end (oldest position)
}

// initial render of user list
renderUserList();

// -------------------------------------
// RENDER CHAT PANEL (messages + input)
// -------------------------------------
function renderChat() {
	if (!activeUser) return;

	// capture previous messagesDiv state to decide auto-scroll behavior & preserve position on prepend
	const oldMessagesDiv = chatBlock.querySelector<HTMLDivElement>(".chat-messages");
	let wasNearBottom = true;
	let prevScrollTop = 0;
	let prevScrollHeight = 0;
	if (oldMessagesDiv) {
		prevScrollTop = oldMessagesDiv.scrollTop;
		prevScrollHeight = oldMessagesDiv.scrollHeight;
		const distanceFromBottom = oldMessagesDiv.scrollHeight - oldMessagesDiv.scrollTop - oldMessagesDiv.clientHeight;
		wasNearBottom = distanceFromBottom < SCROLL_THRESHOLD; // consider near bottom if within 100px
	}

	// Build the chat UI using DOM APIs instead of innerHTML to avoid
	// invalid nesting (which can move the form outside the container).
	chatBlock.innerHTML = "";

	const header = document.createElement("div");
	header.className = "chat-header";

	const profileLink = document.createElement("a");
	profileLink.className = "chat-header-profile-pic";
	profileLink.href = `/profile/${encodeURIComponent(activeUser)}`;
	const profileLinkBtn = document.createElement("button");
	profileLinkBtn.className = "chat-header-btn";
	profileLinkBtn.title = `View ${activeUser}'s profile`;
	profileLinkBtn.textContent = "Profile";
	profileLinkBtn.setAttribute("profile-button", "true");
	profileLink.appendChild(profileLinkBtn);

	const profileImg = document.createElement("img");
	profileImg.src = profilepics[users.indexOf(activeUser) % profilepics.length];
	profileImg.alt = `${activeUser}'s profile picture`;
	profileImg.className = "img_profile";
	profileImg.setAttribute("chat-header", "true");
	header.appendChild(profileImg);

	const titleSpan = document.createElement("span");
	titleSpan.textContent = activeUser;
	titleSpan.className = "chat-header-title";
	header.appendChild(titleSpan);
	header.appendChild(profileLink);

	// Block/unblock button moved to chat header (not next to each username)
	const headerBlockBtn = document.createElement("button");
	headerBlockBtn.className = "chat-header-btn";
	headerBlockBtn.textContent = blockedUsers.has(activeUser) ? "Unblock" : "Block";
	headerBlockBtn.setAttribute("aria-pressed", String(blockedUsers.has(activeUser)));
	headerBlockBtn.setAttribute("block-button", "true");

	// Hide block button when viewing yourself (optional)
	if (activeUser === "me") {
		headerBlockBtn.hidden = true;
	}

	headerBlockBtn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		if (blockedUsers.has(activeUser!)) blockedUsers.delete(activeUser!);
		else
		{
			blockedUsers.add(activeUser!);
			if (activeUser)
			{
				conversations[activeUser].forEach(element => {
					element.hidden = true;
				});
			}
		}
		// update both sides (only the affected user)
		reorderUserList(activeUser!);
		renderChat();
	});


	header.appendChild(headerBlockBtn);

	// Invite button + small menu to choose game (Pong or Tetris)
	const inviteBtn = document.createElement("button");
	inviteBtn.className = "chat-invite-btn";
	inviteBtn.textContent = "+";
	inviteBtn.title = activeUser ? `Invite ${activeUser} to play` : "Invite to play";
	inviteBtn.setAttribute("invite-button", "true");
	if (activeUser === "me") inviteBtn.hidden = true; // don't show for self
	if (blockedUsers.has(activeUser!)) // hide invite button entirely when the conversation partner is blocked
	{
		inviteBtn.hidden = true;
		inviteBtn.title = `Cannot invite ${activeUser} (blocked)`;
	}

	// menu container (hidden by default)
	const inviteMenu = document.createElement('div');
	inviteMenu.className = 'invite-menu';
	inviteMenu.style.display = 'none';
	inviteMenu.setAttribute('role', 'menu');

	const btnTetris = document.createElement('button');
	btnTetris.type = 'button';
	btnTetris.className = 'invite-menu-btn';
	btnTetris.textContent = 'Invite Tetris';
	btnTetris.addEventListener('click', (ev) => {
		ev.preventDefault(); ev.stopPropagation();
		if (!activeUser) return;
		if (blockedUsers.has(activeUser)) return; // don't allow inviting blocked users
		sendInvite(activeUser, 'tetris');
		inviteMenu.style.display = 'none';
	});

	const btnPong = document.createElement('button');
	btnPong.type = 'button';
	btnPong.className = 'invite-menu-btn';
	btnPong.textContent = 'Invite Pong';
	btnPong.addEventListener('click', (ev) => {
		ev.preventDefault(); ev.stopPropagation();
		if (!activeUser) return;
		if (blockedUsers.has(activeUser)) return; // don't allow inviting blocked users
		sendInvite(activeUser, 'pong');
		inviteMenu.style.display = 'none';
	});

	// Append Tetris then Pong so Tetris appears above Pong in the popup box
	inviteMenu.appendChild(btnTetris);
	inviteMenu.appendChild(btnPong);

	inviteBtn.addEventListener('click', (e) => {
		e.preventDefault(); e.stopPropagation();
		if (activeUser === 'me' || blockedUsers.has(activeUser!)) return;
		inviteMenu.style.display = inviteMenu.style.display === 'none' ? 'block' : 'none';
	});

	const messagesDiv = document.createElement("div");
	messagesDiv.className = "chat-messages";
	messagesDiv.setAttribute("role", "log");
	messagesDiv.setAttribute("aria-live", "polite");

	const form = document.createElement("form");
	form.className = "chat-input-form";
	form.method = "post";
	form.action = "#";
	form.setAttribute("novalidate", "");

	const input = document.createElement("div");
	input.className = "chat-input";
	const placeholderText = blockedUsers.has(activeUser)
		? `You have blocked @${activeUser}. Unblock to send messages.`
		: `Type a message to @${activeUser}`;
	input.dataset.placeholder = placeholderText;
	input.contentEditable = blockedUsers.has(activeUser) ? "false" : "true";

	// Load saved draft for this conversation (if any)
	const initialDraft = drafts[activeUser || ''] || '';
	if (initialDraft && !blockedUsers.has(activeUser)) {
		input.textContent = initialDraft;
		input.classList.remove("empty");
	} else {
		input.classList.add("empty");
	}

	const sendBtn = document.createElement("button");
	sendBtn.type = "submit";
	sendBtn.className = "chat-send-btn";
	sendBtn.textContent = "Send";
	sendBtn.hidden = true; // initially hidden

	// Invite wrapper placed inside the form, left of the input
	const inviteWrapper = document.createElement('div');
	inviteWrapper.className = 'invite-wrapper';
	inviteWrapper.appendChild(inviteBtn);
	inviteWrapper.appendChild(inviteMenu);

	form.appendChild(inviteWrapper);
	form.appendChild(input);
	form.appendChild(sendBtn);

	chatBlock.appendChild(header);
	chatBlock.appendChild(messagesDiv);
	chatBlock.appendChild(form);

	// If the conversation partner is blocked, disable input like Discord (you can't send to them)
	if (blockedUsers.has(activeUser))
	{
		input.classList.add("blocked-conversation");
		sendBtn.disabled = true;
		sendBtn.hidden = true;
		headerBlockBtn.textContent = "Unblock";
		headerBlockBtn.setAttribute("aria-pressed", "true");
		// hide/disable invite UI when partner is blocked
		inviteWrapper.setAttribute('aria-disabled','true');
	}
	else
	{
		input.classList.remove("blocked-conversation");
		sendBtn.disabled = false;
		// show send button if there's current input (draft) or let input handler toggle it
		sendBtn.hidden = input.textContent!.trim() === '';
		headerBlockBtn.textContent = "Block";
		headerBlockBtn.setAttribute("aria-pressed", "false");
		// ensure invite UI is visible/enabled for normal conversations
		inviteWrapper.removeAttribute('aria-disabled');
	}

	// Ensure visibleStart exists for this conversation
	const msgs = conversations[activeUser] || [];
	if (visibleStart[activeUser] === undefined)
		visibleStart[activeUser] = Math.max(0, msgs.length - MESSAGES_PAGE);
	let startIndex = visibleStart[activeUser];

	// If we're showing the last page (or the conversation fits in a page), force scroll-to-bottom
	const lastPageStart = Math.max(0, msgs.length - MESSAGES_PAGE);
	if (startIndex >= lastPageStart)
		wasNearBottom = true;

	// build messages using DOM APIs to avoid unsafe innerHTML usage
	const fragment = loadMessages(startIndex, msgs);
	messagesDiv.appendChild(fragment);

	// When a conversation has more messages than the current window, show a small hint at top
	if (startIndex > 0)
	{
		const topHint = document.createElement("div");
		topHint.className = "load-older-hint";
		topHint.textContent = "Scroll up to load earlier messages";
		topHint.style.textAlign = "center";
		topHint.style.padding = "6px 0";
		messagesDiv.insertBefore(topHint, messagesDiv.firstChild);
	}

	// Event delegation to handle "Show" on blocked messages
	messagesDiv.addEventListener("click", (e) => {
		const target = e.target as HTMLElement;
		if (!target) return;
		if (target.classList.contains("show-blocked-btn")) {
			const idxStr = target.dataset.index;
			if (!idxStr) return;
			const idx = Number(idxStr);
			const msgs = conversations[activeUser!] || [];
			const msg = msgs[idx];
			if (!msg) return;
			const container = target.closest(".chat-message");
			if (!container) return;

			// replace placeholder with actual message content (still escaped)
			msg.hidden = !msg.hidden;
			target.setAttribute("aria-pressed", String(!msg.hidden));
			container.setAttribute("data-shown", String(!msg.hidden));
		}

		// Invite actions: accept / decline / cancel / go
		if (target.classList.contains('invite-accept') || target.classList.contains('invite-decline') || target.classList.contains('invite-cancel') || target.classList.contains('invite-go'))
		{
			const idxStr = target.dataset.index;
			if (!idxStr) return;
			const idx = Number(idxStr);
			const msgs = conversations[activeUser!] || [];
			const msg = msgs[idx];
			if (!msg) return;
			if (target.classList.contains('invite-accept'))
			{
				msg.inviteState = 'accepted';
				renderChat();
				setTimeout(() => {
					// const opponent = msg.sender === 'me' ? activeUser! : msg.sender;
					// const game = target.dataset.game || msg.game || 'pong';
					// window.location.href = `/${game}?opponent=${encodeURIComponent(opponent)}`;
					window.location.href = '/pong-board';
				}, NAVIGATION_DELAY);
				return;
			}
			if (target.classList.contains('invite-decline'))
			{
				msg.inviteState = 'declined';
				renderChat();
				return;
			}
			if (target.classList.contains('invite-cancel'))
			{
				msg.inviteState = 'cancelled';
				renderChat();
				return;
			}
			if (target.classList.contains('invite-go')) {
				// const opponent = msg.sender === 'me' ? activeUser! : msg.sender;
				// const game = target.dataset.game || msg.game || 'pong';
				// window.location.href = `/${game}?opponent=${encodeURIComponent(opponent)}`;
				window.location.href = '/pong-board';
				return;
			}
		}
		});

	// Auto-scroll behavior:
	// - If the user was near bottom before re-render, scroll to bottom to show new messages.
	// - Otherwise keep their place (important when they are reading older messages).
	if (wasNearBottom)
		messagesDiv.scrollTop = messagesDiv.scrollHeight;
	else
	{
		// If we just rendered a larger window because we prepended older messages, preserve position
		// formula: newScrollTop = newScrollHeight - oldScrollHeight + oldScrollTop
		if (prevScrollHeight > 0)
		{
			messagesDiv.scrollTop = messagesDiv.scrollHeight - prevScrollHeight + prevScrollTop;
			// clamp
			if (messagesDiv.scrollTop < 0) messagesDiv.scrollTop = 0;
		}
		else
			messagesDiv.scrollTop = prevScrollTop; // otherwise keep at same top position
	}

	// PRIMARY: intercept submit and stop other handlers from running
	form.addEventListener("submit", (e) => {
		e.preventDefault();
		submitMessage(input, sendBtn, messagesDiv);
	});

	// Handle Enter key (without Shift) to submit
	input.addEventListener("keydown", (e: KeyboardEvent) => {
		if (e.isComposing) return;

		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			submitMessage(input, sendBtn, messagesDiv);
		}
	});

	// Input handler to toggle send button visibility and save draft
	input.addEventListener("input", () => {
		if (input.textContent!.trim() === "")
		{
			input.classList.add("empty");
			input.textContent = "";
			sendBtn.hidden = true;
		}
		else
		{
			input.classList.remove("empty");
			if (!blockedUsers.has(activeUser!))
				sendBtn.hidden = false;
		}

		saveDraft(activeUser, input.textContent || '');
	});

	// Scroll handler to load older messages when reaching top
	let loadingOlder = false;
	messagesDiv.addEventListener("scroll", () => {
		if (loadingOlder) return;
		if (messagesDiv.scrollTop <= LOAD_MORE_THRESHOLD) {
			// at (or near) top
			const curStart = visibleStart[activeUser!] || 0;
			if (curStart === 0) return; // no more to load
			loadingOlder = true;
			const newStart = Math.max(0, curStart - MESSAGES_PAGE);
			visibleStart[activeUser!] = newStart;

			// re-render only messages (we can reuse renderChat which will rebuild and preserve position)
			// but call renderChat asynchronously to let this handler finish and avoid double-listeners
			setTimeout(() => {
				renderChat();
				loadingOlder = false;
			}, 0);
		}
	});
}

// -------------------------------------
// MESSAGE RENDERING HELPERS
// -------------------------------------

// Convert messages timestamp to readable format
function convertTimestampToReadable(ts: Date): string
{
	const now = new Date();
	const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

	const hh = String(ts.getHours()).padStart(2, "0");
	const min = String(ts.getMinutes()).padStart(2, "0");

	let time: string;
	if (ts >= todayStart)
		time = `${hh}:${min}`; // same day: HH:MM
	else if (ts >= yesterdayStart) // yesterday: "yesterday at HH:MM"
		time = `yesterday at ${hh}:${min}`;
	else // older: YYYY-MM-DD HH:MM
	{
		const yyyy = ts.getFullYear();
		const mo = String(ts.getMonth() + 1).padStart(2, "0");
		const dd = String(ts.getDate()).padStart(2, "0");
		time = `${yyyy}-${mo}-${dd} ${hh}:${min}`;
	}
	return time;
}

// Load messages from startIndex to end, grouping consecutive messages from same sender
// Returns a DocumentFragment containing the built message nodes (safe DOM creation)
function loadMessages(startIndex: number, msgs: Message[]): DocumentFragment
{
	const GROUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
	const slice = (msgs.slice(startIndex) || []);
	const fragment = document.createDocumentFragment();
	for (let i = 0; i < slice.length; ) {
		const first = slice[i];
		const globalFirstIdx = startIndex + i;

		// gather group of consecutive messages from same sender within GROUP_WINDOW_MS
		const group: Message[] = [first];
		let j = i + 1;
		while (j < slice.length)
		{
			const cur = slice[j];
			if (cur.sender !== first.sender) break;
			if (cur.type === 'invite' && !(cur.sender !== 'me' && blockedUsers.has(cur.sender))) break;
			if (cur.timestamp.getTime() - first.timestamp.getTime() > GROUP_WINDOW_MS) break;
			group.push(cur);
			j++;
		}

		const time = convertTimestampToReadable(first.timestamp);

		// Helper to append a text with preserved newlines (as <br>) into a parent element
		function appendTextWithLineBreaks(parent: HTMLElement, text: string)
		{
			const parts = text.split('\n');
			parts.forEach((part, idx) => {
				parent.appendChild(document.createTextNode(part));
				if (idx < parts.length - 1)
					parent.appendChild(document.createElement('br'));
			});
		}

		// Invite messages: single-message semantics
		if (first.type === 'invite' && !(first.sender !== 'me' && blockedUsers.has(first.sender)))
		{
			const state = first.inviteState || 'pending';
			const game = first.game || 'pong';
			const container = document.createElement('div');
			container.className = 'chat-message invite';
			if (first.sender === 'me') container.classList.add('me');
			container.dataset.index = String(globalFirstIdx);
			container.dataset.count = String(group.length);

			const timeSpan = document.createElement('span');
			timeSpan.className = 'chat-time';
			timeSpan.textContent = time;
			container.appendChild(timeSpan);
			container.appendChild(document.createElement('br'));

			const inviteText = document.createElement('div');
			inviteText.className = 'invite-text';
			if (first.sender === 'me')
				inviteText.textContent = `You invited ${String(activeUser || 'player')} to play ${game === 'pong' ? 'Pong' : 'Tetris'}.`;
			else
				inviteText.textContent = `${first.sender} invited you to play ${game === 'pong' ? 'Pong' : 'Tetris'}.`;
			container.appendChild(inviteText);

			if (first.sender === 'me')
			{
				if (state === 'pending')
				{
					const actions = document.createElement('div');
					actions.className = 'invite-actions';
					const cancelBtn = document.createElement('button');
					cancelBtn.type = 'button';
					cancelBtn.className = 'invite-cancel';
					cancelBtn.dataset.index = String(globalFirstIdx);
					cancelBtn.textContent = 'Cancel';
					actions.appendChild(cancelBtn);
					container.appendChild(actions);
				}
				else if (state === 'accepted')
				{
					container.classList.add('accepted');
					const actions = document.createElement('div');
					actions.className = 'invite-actions';
					const goBtn = document.createElement('button');
					goBtn.type = 'button';
					goBtn.className = 'invite-go';
					goBtn.dataset.index = String(globalFirstIdx);
					goBtn.dataset.game = game;
					goBtn.textContent = 'Play';
					actions.appendChild(goBtn);
					container.appendChild(actions);
				}
				else
					container.classList.add(state);
			}
			else
			{
				if (state === 'pending')
				{
					const actions = document.createElement('div');
					actions.className = 'invite-actions';
					const acceptBtn = document.createElement('button');
					acceptBtn.type = 'button';
					acceptBtn.className = 'invite-accept';
					acceptBtn.dataset.index = String(globalFirstIdx);
					acceptBtn.dataset.game = game;
					acceptBtn.textContent = 'Accept';
					const declineBtn = document.createElement('button');
					declineBtn.type = 'button';
					declineBtn.className = 'invite-decline';
					declineBtn.dataset.index = String(globalFirstIdx);
					declineBtn.textContent = 'Decline';
					actions.appendChild(acceptBtn);
					actions.appendChild(declineBtn);
					container.appendChild(actions);
				}
				else if (state === 'accepted')
				{
					container.classList.add('accepted');
					const actions = document.createElement('div');
					actions.className = 'invite-actions';
					const goBtn = document.createElement('button');
					goBtn.type = 'button';
					goBtn.className = 'invite-go';
					goBtn.dataset.index = String(globalFirstIdx);
					goBtn.dataset.game = game;
					goBtn.textContent = 'Play';
					actions.appendChild(goBtn);
					container.appendChild(actions);
				}
				else
					container.classList.add(state);
			}

			fragment.appendChild(container);
			i = i + 1;
			continue;
		}

		// Blocked incoming sender: render a collapsed block
		if (first.sender !== 'me' && blockedUsers.has(first.sender))
		{
			const groupHidden = group.every((m) => m.hidden !== false);
			const container = document.createElement('div');
			container.className = 'chat-message blocked';
			container.dataset.shown = String(!groupHidden);
			container.dataset.index = String(globalFirstIdx);
			container.dataset.count = String(group.length);

			const note = document.createElement('span');
			note.className = 'chat-blocked-note';
			note.textContent = `${group.length} blocked ${group.length > 1 ? 'messages' : 'message'} — `;
			container.appendChild(note);

			const toggle = document.createElement('span');
			toggle.className = 'show-blocked-btn';
			toggle.dataset.index = String(globalFirstIdx);
			toggle.dataset.count = String(group.length);
			toggle.setAttribute('aria-pressed', String(!groupHidden));
			container.appendChild(toggle);

			const content = document.createElement('div');
			content.className = 'blocked-message-content';
			content.dataset.index = String(globalFirstIdx);

			const timeSpan = document.createElement('span');
			timeSpan.className = 'chat-time';
			timeSpan.textContent = time;
			content.appendChild(timeSpan);
			content.appendChild(document.createElement('br'));

			// append grouped messages
			group.forEach((m) => {
				const span = document.createElement('span');
				span.className = 'chat-group-text';
				appendTextWithLineBreaks(span, m.text);
				content.appendChild(span);
				// separate messages with a line break
				content.appendChild(document.createElement('br'));
			});

			container.appendChild(content);
			fragment.appendChild(container);
			i = j;
			continue;
		}

		// Normal grouped messages
		const senderClass = first.sender === 'me' ? 'me' : first.sender;
		const container = document.createElement('div');
		container.className = `chat-message ${senderClass}`;
		container.dataset.index = String(globalFirstIdx);
		container.dataset.count = String(group.length);

		const timeSpan = document.createElement('span');
		timeSpan.className = 'chat-time';
		timeSpan.textContent = time;
		container.appendChild(timeSpan);
		container.appendChild(document.createElement('br'));

		group.forEach((m, idx) => {
			const span = document.createElement('span');
			span.className = 'chat-group-text';
			appendTextWithLineBreaks(span, m.text);
			container.appendChild(span);
			if (idx < group.length - 1) container.appendChild(document.createElement('br'));
		});

		fragment.appendChild(container);
		i = j;
	}
	return fragment;
}

// -------------------------------------
// SUBMIT MESSAGE HANDLER
// -------------------------------------
function submitMessage(input: HTMLDivElement, sendBtn: HTMLButtonElement, messagesDiv: HTMLDivElement) {
	// Do not allow sending to blocked user
	if (!activeUser) return;
	if (blockedUsers.has(activeUser)) return;
	const text = input.textContent?.trim() || "";
	if (!text) return;
	conversations[activeUser || ""].push({
		sender: "me",
		text,
		timestamp: new Date(),
	});
	// ensure visible window includes the latest message: if the window did not include the last page,
	// and user is near bottom, advance visibleStart to show the new message; otherwise keep it as-is.
	const len = conversations[activeUser].length;
	if (!visibleStart[activeUser]) visibleStart[activeUser] = Math.max(0, len - MESSAGES_PAGE);
	else {
		// if currently showing the last page or user was near bottom, move window to include new message
		if (visibleStart[activeUser] >= len - 1 - MESSAGES_PAGE || (messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight) < 100) {
			visibleStart[activeUser] = Math.max(0, len - MESSAGES_PAGE);
		}
	}
	input.textContent = "";
	clearDraft(activeUser);
	input.classList.add("empty");
	sendBtn.hidden = true;
	reorderUserList(activeUser!);
	renderChat();
}

// Send an invite message to a user (frontend-only demo behavior)
function sendInvite(user: string, game: 'pong' | 'tetris' = 'pong')
{
	if (!user) return;

	// runtime-validate 'game' to guard against unexpected values (e.g., from external input)
	if (game !== 'pong' && game !== 'tetris') {
		console.warn(`sendInvite: invalid game "${String(game)}" provided, defaulting to "pong"`);
		game = 'pong';
	}

	// don't allow inviting a blocked user
	if (blockedUsers.has(user)) return;
	if (!conversations[user]) conversations[user] = [];
	conversations[user].push({
		sender: 'me',
		text: `invited ${user} to a ${game === 'pong' ? 'Pong' : 'Tetris'} game`,
		timestamp: new Date(),
		type: 'invite',
		inviteState: 'pending',
		game: game,
	});
	reorderUserList(user);
	renderChat();
}
