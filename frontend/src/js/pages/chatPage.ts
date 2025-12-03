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
}

interface Conversation {
	[username: string]: Message[];
}

const MESSAGES_PAGE = 100; // page size for incremental loading

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
		setTimeout(updateVh, 50); // small timeout to allow browser to adjust viewport first
});

// Persistent toggle button placed into the user list (moved out of chat header)
const headerToggleBtn = document.createElement("button");
headerToggleBtn.className = "chat-header-toggle-users";
function updateToggleBtnText() {
	headerToggleBtn.setAttribute("aria-pressed", String(userListHidden));
	// Use compact chevrons so the button doesn't take much space: '◀/▲' to hide, '▶/▼' to show
	const narrow = window.innerWidth < 700;
	headerToggleBtn.textContent = narrow ? (userListHidden ? "▼" : "▲") : (userListHidden ? "▶" : "◀");
	headerToggleBtn.title = userListHidden ? "Show users" : "Hide users";
}
updateToggleBtnText();
// keep the toggle icon responsive when viewport changes
window.addEventListener('resize', updateToggleBtnText);
window.addEventListener('orientationchange', updateToggleBtnText);
headerToggleBtn.addEventListener("click", (e) => {
	e.preventDefault();
	e.stopPropagation();
	userListHidden = !userListHidden;

	// physically hide/show the user list element
	userListDiv.style.display = userListHidden ? "none" : "";

	// expand chat area when hidden; remove inline style when shown so CSS can govern layout
	if (userListHidden)
	{
		chatBlock.style.width = "100%";
		chatBlock.style.flexGrow = "1";
	}
	else
	{
		chatBlock.style.width = "";
		chatBlock.style.flexGrow = "";
	}

	updateToggleBtnText();
	renderUserList();
	renderChat();
});

// -------------------------------------
// DUMMY DATA SETUP
// -------------------------------------
const users: string[] = [];
for (let i = 0; i < 100; i++) {
	users.push("user" + i);
}

const profilepics: string[] = [];
for (let _ = 0; _ < 100; _++) {
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

conversations["user42"] = [
	{ sender: "user42", text: "This is a longer message to test how the chat UI handles wrapping and multiple lines. Let's see how it looks when the message exceeds the typical length of a chat bubble. Hopefully, it wraps nicely and remains readable!", timestamp: new Date(Date.now() + 3) },
	{ sender: "me", text: "Indeed, it seems to be working well!\nNew line test.", timestamp: new Date(Date.now() + 4) },
];

conversations["user98"] = []; // empty conversation for testing

conversations["Dummy"] = [
	{ sender: "Dummy", text: "Hi there!", timestamp: new Date(Date.now() + 5) },
	{ sender: "me", text: "Hello Dummy, how are you?", timestamp: new Date(Date.now() + 6) },
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
	// Respect the userListHidden state
	userListDiv.style.display = userListHidden ? "none" : "";

	userListDiv.innerHTML = "";

	// place the persistent toggle into the parent container (so it remains clickable
	// even if we hide `.user-list`). Prefer `chat-form-container` if available.
	const container = userListDiv.parentElement as HTMLElement | null;
	updateToggleBtnText();
	if (container)
	{
		// prefer inserting the toggle immediately before the user list so it occupies its own
		// space and does not overlap user rows
		if (container.querySelector('.chat-header-toggle-users') !== headerToggleBtn)
			container.insertBefore(headerToggleBtn, userListDiv);
	}
	else
	{
		// fallback: still append to userListDiv
		if (userListDiv.querySelector('.chat-header-toggle-users') !== headerToggleBtn)
			userListDiv.insertBefore(headerToggleBtn, userListDiv.firstChild);
	}

	const sortedUsers = Object.keys(conversations).sort((a, b) => {
		return getLastTimestamp(b) - getLastTimestamp(a); // descending: newest first
	});

	sortedUsers.forEach((name) => {
		const userItem = document.createElement('div');
		userItem.className = 'user-item';
		if (name === activeUser) userItem.classList.add('selected');
		if (blockedUsers.has(name)) userItem.classList.add('blocked');

		const img = document.createElement('img');
		img.className = 'img_profile';
		img.src = profilepics[users.indexOf(name) % profilepics.length];
		img.alt = '';

		const txt = document.createElement('p');
		txt.className = 'name_profile';
		if (blockedUsers.has(name))
			txt.textContent = `${name} 🚫`;
		else
			txt.textContent = name;

		userItem.appendChild(img);
		userItem.appendChild(txt);

		userItem.addEventListener("click", () => {
			activeUser = name;
			// initialize visibleStart so only last page is shown
			const msgs = conversations[name] || [];
			visibleStart[name] = Math.max(0, msgs.length - MESSAGES_PAGE);
			renderUserList();
			renderChat();
		});

		userListDiv.appendChild(userItem);
	});
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
		wasNearBottom = distanceFromBottom < 100; // consider near bottom if within 100px
	}

	// Build the chat UI using DOM APIs instead of innerHTML to avoid
	// invalid nesting (which can move the form outside the container).
	chatBlock.innerHTML = "";

	const header = document.createElement("div");
	header.className = "chat-header";

	const profileLink = document.createElement("a");
	profileLink.className = "chat-header-profile-pic";
	profileLink.href = `/profile/${activeUser}`;
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
		// update both sides
		renderUserList();
		renderChat();
	});

	header.appendChild(headerBlockBtn);

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
	var placeholderText;
	if (blockedUsers.has(activeUser))
		placeholderText = `You have blocked @${activeUser}. Unblock to send messages.`;
	else
		placeholderText = `Type a message to @${activeUser}`;
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
	}
	else
	{
		input.classList.remove("blocked-conversation");
		sendBtn.disabled = false;
		// show send button if there's current input (draft) or let input handler toggle it
		sendBtn.hidden = input.textContent!.trim() === '';
		headerBlockBtn.textContent = "Block";
		headerBlockBtn.setAttribute("aria-pressed", "false");
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

	messagesDiv.innerHTML = loadMessages(startIndex, msgs);

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
			const contentDiv = container.querySelector<HTMLElement>(".blocked-message-content");
			container.setAttribute("data-shown", String(!msg.hidden));
			if (contentDiv)
			{
				if (msg.hidden)
				{
					contentDiv.style.display = "none";
					target.textContent = "Show";
				}
				else
					{
					contentDiv.style.display = "block";
					target.textContent = "Hide";
				}
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
		if ((e as any).isComposing) return;

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
		if (messagesDiv.scrollTop <= 20) {
			// at (or near) top
			const curStart = visibleStart[activeUser!] || 0;
			if (curStart === 0) return; // no more to load
			loadingOlder = true;
			const prevHeight = messagesDiv.scrollHeight;
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

// Small helper to avoid XSS from message text
function escapeHtml(str: string) {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

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
function loadMessages(startIndex: number, msgs: Message[]): string
{
	const GROUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
	const slice = (msgs.slice(startIndex) || []);
	let html = "";
	for (let i = 0; i < slice.length; ) {
		const first = slice[i];
		const globalFirstIdx = startIndex + i;
		// gather group of consecutive messages from same sender within GROUP_WINDOW_MS
		const group: Message[] = [first];
		let j = i + 1;
		while (j < slice.length) {
			const cur = slice[j];
			if (cur.sender !== first.sender) break;
			// ensure the current message is within GROUP_WINDOW_MS of the group's first message;
			// this prevents long chains where pairwise gaps are small but the overall span is large
			if (cur.timestamp.getTime() - first.timestamp.getTime() > GROUP_WINDOW_MS) break;
			group.push(cur);
			j++;
		}
		// show the timestamp of the group's first message (so newly sent messages don't inherit the latest group's time)
		const time = convertTimestampToReadable(first.timestamp);
		// prepare joined safe text: each message becomes a span and separated by <br>
		const joinedSafe = group
			.map((m) => escapeHtml(m.text).replace(/\n/g, "<br>"))
			.map((s) => `<span class="chat-group-text">${s}</span>`)
			.join(`<br>`);
		// If sender is blocked (and not our own messages), render a single blocked group block
		if (first.sender !== "me" && blockedUsers.has(first.sender))
		{
			// consider group hidden if all messages are hidden (default hidden when undefined)
			const groupHidden = group.every((m) => m.hidden !== false);
			html += `
			<div class="chat-message blocked " data-shown="${!groupHidden}" data-index="${globalFirstIdx}" data-count="${group.length}">
				<span class="chat-blocked-note">${group.length} blocked ${group.length > 1 ? "messages" : "message"} — </span><span class="show-blocked-btn" data-index="${globalFirstIdx}" data-count="${group.length}" aria-pressed="${!groupHidden}">${groupHidden ? "Show" : "Hide"}</span>
				<div class="blocked-message-content" data-index="${globalFirstIdx}" style="display:${groupHidden ? "none" : "block"}">
					<span class="chat-time">${time}</span>
					${joinedSafe}
				</div>
			</div>`;
		}
		else
		{
			// normal grouped messages: single container, single time, multiple spans separated by <br>
			const senderClass = first.sender === "me" ? "me" : first.sender;
			html += `
			<div class="chat-message ${senderClass}" data-index="${globalFirstIdx}" data-count="${group.length}">
				<span class="chat-time">${time}</span>
				${joinedSafe}
			</div>`;
		}
		i = j;
	}
	return html;
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
	renderUserList();
	renderChat();
}
