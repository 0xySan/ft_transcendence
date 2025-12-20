// ============================================================================
// Chat Application - All-in-One File
// ============================================================================
// Complete chat system with messaging, user list, layout, and invite handling

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface Message {
	sender: string;
	text: string;
	timestamp: Date;
	hidden?: boolean;
	type: 'text' | 'invite' | 'system';
	inviteState?: 'pending' | 'accepted' | 'declined' | 'cancelled';
}

interface Conversation {
	[username: string]: Message[];
}

// ============================================================================
// STATE
// ============================================================================

// DOM Elements
const userListDiv = document.querySelector<HTMLDivElement>('.user-list')!;
const chatBlock = document.querySelector<HTMLDivElement>('.chat-block')!;
const headerToggleBtn = document.querySelector<HTMLButtonElement>('.chat-header-toggle-users')!;

// Constants
const MESSAGES_PAGE = 100;
const NAVIGATION_DELAY = 150;
const KEYBOARD_ADJUST_DELAY = 50;
const SCROLL_THRESHOLD = 100;
const LOAD_MORE_THRESHOLD = 20;
const TIMEOUT_DELAY = 50;
const GROUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes for grouping messages
const DRAFTS_KEY = 'chat_drafts';

// Chat State
const conversations: Conversation = {};
let activeUser: string | null = null;
const blockedUsers: Set<string> = new Set();
const activeUsers: Set<string> = new Set();
const visibleStart: Record<string, number> = {};
const scrollPositions: Record<string, number> = {};
const loadingOlderMessages: Record<string, boolean> = {};

// Drafts (persisted in sessionStorage)
const drafts: Record<string, string> = (() => {
	try {
		return JSON.parse(sessionStorage.getItem(DRAFTS_KEY) || '{}');
	} catch (e) {
		return {};
	}
})();

// User and profile pictures
const users: string[] = [];
const profilepics: string[] = [];

// Layout state
let userListHidden = false;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function setActiveUser(user: string | null): void {
	activeUser = user;
}

function saveDraft(user: string | null, text: string): void {
	if (!user) return;
	drafts[user] = text;
	try {
		sessionStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
	} catch (e) {
		// ignore
	}
}

function clearDraft(user: string | null): void {
	if (!user) return;
	delete drafts[user];
	try {
		sessionStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
	} catch (e) {
		// ignore
	}
}

function convertTimestampToReadable(ts: Date): string {
	const now = new Date();
	const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

	const hh = String(ts.getHours()).padStart(2, '0');
	const min = String(ts.getMinutes()).padStart(2, '0');

	let time: string;
	if (ts >= todayStart) time = `${hh}:${min}`; // same day: HH:MM
	else if (ts >= yesterdayStart) time = `yesterday at ${hh}:${min}`; // yesterday
	else {
		// older: YYYY-MM-DD HH:MM
		const yyyy = ts.getFullYear();
		const mo = String(ts.getMonth() + 1).padStart(2, '0');
		const dd = String(ts.getDate()).padStart(2, '0');
		time = `${yyyy}-${mo}-${dd} ${hh}:${min}`;
	}
	return time;
}

function getLastTimestamp(name: string): number {
	const msgs = conversations[name] || [];
	if (msgs.length === 0) return 0;
	return Math.max(...msgs.map((m) => m.timestamp.getTime()));
}

function appendTextWithLineBreaks(parent: HTMLElement, text: string): void {
	const parts = text.split('\n');
	parts.forEach((part, idx) => {
		parent.appendChild(document.createTextNode(part));
		if (idx < parts.length - 1) {
			parent.appendChild(document.createElement('br'));
		}
	});
}

// ============================================================================
// DUMMY DATA
// ============================================================================

function seedDummyData(): void {
	Object.keys(conversations).forEach((key) => delete conversations[key]);
	users.length = 0;
	profilepics.length = 0;

	for (let i = 0; i < 6; i++) users.push(`user${i}`);

	for (let i = 0; i < 6; i++)
		profilepics.push(
			`https://cdn.discordapp.com/embed/avatars/${Math.floor(Math.random() * 10) % 5}.png`
		);

	users.forEach((name, i) => {
		const base = Date.now() - (i + 1) * 6000000;
		const list = [] as typeof conversations[string];
		const count = Math.floor(Math.random() * 1000);
		for (let j = 0; j < count; j++) {
			const random = Math.floor(Math.random() * 3);
			list.push({
				sender: random === 0 ? name : 'me',
				text: `msg ${j} from ${random === 0 ? name : 'me'}`,
				timestamp: new Date(base + j),
				type: 'text',
			});
		}
		if (list.length === 0) {
			list.push({
				sender: name,
				text: 'Hey! This is a placeholder message.',
				timestamp: new Date(base),
				type: 'text',
			});
			list.push({
				sender: 'me',
				text: 'Nice, just testing the chat UI!',
				timestamp: new Date(base + 1),
				type: 'text',
			});
		}
		conversations[name] = list;
	});

	conversations['user4'] = [
		{
			sender: 'user4',
			type: 'invite',
			inviteState: 'pending',
			text: 'Wanna play Pong?',
			timestamp: new Date(Date.now() + 1),
		},
		{
			sender: 'user4',
			type: 'invite',
			inviteState: 'pending',
			text: 'Wanna play Pong?',
			timestamp: new Date(Date.now() + 2),
		},
		{
			sender: 'user4',
			text: 'This is a longer message to test how the chat UI handles wrapping and multiple lines. Let\'s see how it looks when the message exceeds the typical length of a chat bubble. Hopefully, it wraps nicely and remains readable!',
			timestamp: new Date(Date.now() + 3),
			type: 'text',
		},
		{
			sender: 'me',
			text: 'Indeed, it seems to be working well!\nNew line test.',
			timestamp: new Date(Date.now() + 4),
			type: 'text',
		},
	];

	conversations['user2'] = [];

	conversations['Dummy'] = [
		{ sender: 'Dummy', text: 'Hi there!', timestamp: new Date(Date.now() + 5), type: 'text' },
		{ sender: 'me', text: 'Hello Dummy, how are you?', timestamp: new Date(Date.now() + 6), type: 'text' },
		{
			sender: 'me',
			type: 'invite',
			inviteState: 'accepted',
			text: 'Wanna play Pong?',
			timestamp: new Date(Date.now() + 7),
		},
	];

	users.push('Dummy');
	profilepics.push('https://i.ibb.co/VcQ5RQwX/dummy.png');
}

// ============================================================================
// LAYOUT MANAGEMENT
// ============================================================================

function updateToggleBtnText(): void {
	headerToggleBtn.setAttribute('aria-pressed', String(userListHidden));
	headerToggleBtn.title = userListHidden ? 'Show users' : 'Hide users';
}

function updateVh(): void {
	document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
}

function globalHideInviteMenu(event: MouseEvent): void {
	const inviteMenu = document.querySelector<HTMLDivElement>('.invite-menu');
	const inviteBtn = document.querySelector<HTMLButtonElement>('.chat-invite-btn');
	if (!inviteMenu) return;
	if (!inviteMenu.classList.contains('hidden')) {
		const target = event.target as Node | null;
		if (target && !inviteMenu.contains(target) && !(inviteBtn && inviteBtn.contains(target)))
			inviteMenu.classList.add('hidden');
	}
}

function initLayout(): void {
	updateVh();
	updateToggleBtnText();
	window.addEventListener('resize', updateVh);
	window.addEventListener('orientationchange', updateVh);
	document.addEventListener('click', globalHideInviteMenu);

	document.addEventListener('focusin', (e) => {
		const target = e.target as HTMLElement | null;
		if (!target) return;
		if (target.closest && target.closest('.chat-input'))
			setTimeout(updateVh, KEYBOARD_ADJUST_DELAY);
	});

	headerToggleBtn.addEventListener('click', (e) => {
		e.preventDefault();
		e.stopPropagation();
		userListHidden = !userListHidden;
		if (userListHidden) userListDiv.classList.add('hidden');
		else userListDiv.classList.remove('hidden');
		updateToggleBtnText();
	});
}

// ============================================================================
// MESSAGE RENDERING
// ============================================================================

function renderInviteButtons(
	container: HTMLDivElement,
	state: string,
	globalFirstIdx: number,
	user_type: string
): void {
	if (state === 'pending' && user_type === 'sender') {
		const temp = document.querySelector<HTMLTemplateElement>('.invite-cancel-temp');
		const fragment = temp!.content.cloneNode(true) as DocumentFragment;
		const cancelBtn = fragment.querySelector<HTMLButtonElement>('.invite-cancel');
		if (cancelBtn) cancelBtn.dataset.index = String(globalFirstIdx);
		container.appendChild(fragment);
	}
	else if (state === 'pending' && user_type === 'receiver') {
		const temp = document.querySelector<HTMLTemplateElement>('.invite-pending-temp');
		const fragment = temp!.content.cloneNode(true) as DocumentFragment;
		const acceptBtn = fragment.querySelector<HTMLButtonElement>('.invite-accept');
		if (acceptBtn) acceptBtn.dataset.index = String(globalFirstIdx);
		const declineBtn = fragment.querySelector<HTMLButtonElement>('.invite-decline');
		if (declineBtn) declineBtn.dataset.index = String(globalFirstIdx);
		container.appendChild(fragment);
	}
	else if (state === 'accepted') {
		container.classList.add('accepted');
		const temp = document.querySelector<HTMLTemplateElement>('.invite-go-temp');
		const fragment = temp!.content.cloneNode(true) as DocumentFragment;
		const goBtn = fragment.querySelector<HTMLButtonElement>('.invite-go');
		if (goBtn)
			goBtn.dataset.index = String(globalFirstIdx);
		container.appendChild(fragment);
	}
	else
		container.classList.add(state);
}

function renderBlockedMessage(
	fragment: DocumentFragment,
	group: Message[],
	time: string,
	globalFirstIdx: number
): void {
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

	group.forEach((m) => {
		const span = document.createElement('span');
		span.className = 'chat-group-text';
		appendTextWithLineBreaks(span, m.text);
		content.appendChild(span);
		content.appendChild(document.createElement('br'));
	});

	container.appendChild(content);
	fragment.appendChild(container);
}

function loadMessages(
	startIndex: number,
	msgs: Message[],
	baseIndexOverride?: number
): DocumentFragment {
	const useOverride = typeof baseIndexOverride === 'number';
	const slice = useOverride ? msgs : startIndex >= msgs.length ? msgs : msgs.slice(startIndex);
	const baseIndex = useOverride ? (baseIndexOverride as number) : startIndex >= msgs.length ? startIndex : 0;
	const fragment = document.createDocumentFragment();

	for (let i = 0; i < slice.length; ) {
		const first = slice[i];
		const globalFirstIdx = (baseIndex > 0 ? baseIndex : startIndex) + i;

		// Group consecutive messages from same sender
		const group: Message[] = [first];
		let j = i + 1;
		while (j < slice.length) {
			const cur = slice[j];
			const senderMismatch = cur.sender !== first.sender;
			const inviteBreak =
				cur.type === 'invite' && !(cur.sender !== 'me' && blockedUsers.has(cur.sender));
			const timeDiff =
				cur.timestamp.getTime() - first.timestamp.getTime() > GROUP_WINDOW_MS;

			if (senderMismatch || inviteBreak || timeDiff) break;
			group.push(cur);
			j++;
		}

		const time = convertTimestampToReadable(first.timestamp);

		// Handle invite messages
		if (first.type === 'invite' && !(first.sender !== 'me' && blockedUsers.has(first.sender))) {
			const state = first.inviteState || 'pending';
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

			const inviteText = document.createElement('span');
			inviteText.className = 'invite-text';
			if (first.sender === 'me')
				inviteText.textContent = `You invited ${String(activeUser || 'player')} to play Pong.`;
			else
				inviteText.textContent = `${first.sender} invited you to play Pong.`;
			container.appendChild(inviteText);

			if (first.sender === 'me')
				renderInviteButtons(container, state, globalFirstIdx, 'sender');
			else
				renderInviteButtons(container, state, globalFirstIdx, 'receiver');

			fragment.appendChild(container);
			i = i + 1;
			continue;
		}

		// Handle blocked messages
		if (first.sender !== 'me' && blockedUsers.has(first.sender)) {
			renderBlockedMessage(fragment, group, time, globalFirstIdx);
			i = j;
			continue;
		}

		// Handle regular messages
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

function appendMessageToDOM(msg: Message, index: number): void {
	if (!activeUser) return;

	const selector = `.chat-messages[user="${CSS.escape(activeUser)}"]`;
	const messagesDiv = chatBlock.querySelector<HTMLDivElement>(selector);
	if (!messagesDiv) return;

	const fragment = loadMessages(index, [msg], index);
	messagesDiv.appendChild(fragment);

	const newCount = Number(messagesDiv.dataset.messageCount) || 0;
	messagesDiv.dataset.messageCount = String(newCount + 1);

	requestAnimationFrame(() => {
		messagesDiv.scrollTop = messagesDiv.scrollHeight;
	});
}

function updateInviteState(
	container: HTMLElement,
	msg: Message,
	newState: 'accepted' | 'declined' | 'cancelled',
	msgIndex: number
): void {
	msg.inviteState = newState;

	// Remove old buttons
	const buttonsContainer = container.querySelector('div');
	if (buttonsContainer) buttonsContainer.remove();

	// Update classes
	container.classList.remove('pending');
	container.classList.add(newState);

	// If accepted, add the "go" button
	if (newState === 'accepted') {
		const goTemp = document.querySelector<HTMLTemplateElement>('.invite-go-temp');
		const fragment = goTemp!.content.cloneNode(true) as DocumentFragment;
		const goBtn = fragment.querySelector<HTMLButtonElement>('.invite-go');
		if (goBtn)
			goBtn.dataset.index = String(msgIndex);
		container.appendChild(fragment);
	}
}

// ============================================================================
// ACTIONS
// ============================================================================

function submitMessage(
	input: HTMLDivElement,
	sendBtn: HTMLButtonElement,
	messagesDiv: HTMLDivElement
): void {
	if (!activeUser) return;
	if (blockedUsers.has(activeUser)) return;

	const text = input.textContent?.trim() || '';
	if (!text) return;

	const newMsg: Message = {
		sender: 'me',
		text,
		timestamp: new Date(),
		type: 'text',
	};

	if (!conversations[activeUser]) conversations[activeUser] = [];
	conversations[activeUser].push(newMsg);
	const msgIndex = conversations[activeUser].length - 1;

	const len = conversations[activeUser].length;
	if (!visibleStart[activeUser])
		visibleStart[activeUser] = Math.max(0, len - MESSAGES_PAGE);
	else if (
		visibleStart[activeUser] >= len - 1 - MESSAGES_PAGE ||
		messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight < 100
	)
		visibleStart[activeUser] = Math.max(0, len - MESSAGES_PAGE);

	input.textContent = '';
	clearDraft(activeUser);
	input.classList.add('empty');
	sendBtn.hidden = true;
	appendMessageToDOM(newMsg, msgIndex);
	reorderUserList(activeUser);
}

function sendInvite(user: string): void {
	if (!user) return;

	if (blockedUsers.has(user)) return;
	if (!conversations[user]) conversations[user] = [];

	const inviteMsg: Message = {
		sender: 'me',
		text: `invited ${user} to a pong game`,
		timestamp: new Date(),
		type: 'invite',
		inviteState: 'pending',
	};

	conversations[user].push(inviteMsg);
	const msgIndex = conversations[user].length - 1;

	reorderUserList(user);
	appendMessageToDOM(inviteMsg, msgIndex);
}

// ============================================================================
// USER LIST
// ============================================================================

function reorderUserList(movedUser: string): void {
	const selector = `.user-item[data-username="${CSS.escape(movedUser)}"]`;
	const item = userListDiv.querySelector<HTMLDivElement>(selector);
	if (!item) return;

	userListDiv.querySelectorAll<HTMLDivElement>('.user-item.selected').forEach((el) => {
		if (el !== item) el.classList.remove('selected');
	});
	if (activeUser === movedUser) item.classList.add('selected');
	else item.classList.remove('selected');

	if (blockedUsers.has(movedUser)) item.classList.add('blocked');
	else item.classList.remove('blocked');

	const existingItems = Array.from(userListDiv.querySelectorAll<HTMLDivElement>('.user-item'));
	const movedTs = getLastTimestamp(movedUser);
	let inserted = false;
	for (const other of existingItems) {
		if (other === item) continue;
		const otherName = other.dataset.username || '';
		const otherTs = getLastTimestamp(otherName);
		if (otherTs < movedTs) {
			userListDiv.insertBefore(item, other);
			inserted = true;
			break;
		}
	}
	if (!inserted) userListDiv.appendChild(item);
}

function renderUserList(onSelectUser: () => void): void {
	const sortedUsers = Object.keys(conversations).sort(
		(a, b) => getLastTimestamp(b) - getLastTimestamp(a)
	);

	sortedUsers.forEach((name) => {
		const temp = document.querySelector<HTMLTemplateElement>('.user-item-temp');
		if (!temp) return;

		const fragment = temp.content.cloneNode(true) as DocumentFragment;
		const divElement = fragment.querySelector<HTMLDivElement>('.user-item');
		if (!divElement) return;

		divElement.dataset.username = name;

		const imgElement = fragment.querySelector<HTMLImageElement>('.img_profile');
		if (imgElement) {
			const userIdx = users.indexOf(name);
			imgElement.src =
				userIdx === -1 ? profilepics[0] : profilepics[userIdx % profilepics.length];
		}
		const pElement = fragment.querySelector<HTMLParagraphElement>('.name_profile');
		if (pElement) pElement.textContent = name;

		divElement.addEventListener('click', () => {
			const oldUser = activeUser;
			if (oldUser) {
				const oldselector = `.chat-messages[user="${CSS.escape(oldUser)}"]`;
				const olditem = chatBlock.querySelector<HTMLDivElement>(oldselector);
				if (olditem) {
					scrollPositions[oldUser] = olditem.scrollTop;
					olditem.classList.add('hidden');
				}
			}

			setActiveUser(name);

			const msgs = conversations[name] || [];
			if (visibleStart[name] === undefined)
				visibleStart[name] = Math.max(0, msgs.length - MESSAGES_PAGE);

			reorderUserList(name);

			if (activeUsers.has(name)) {
				const selector = `.chat-messages[user="${CSS.escape(name)}"]`;
				const item = chatBlock.querySelector<HTMLDivElement>(selector);
				if (item) {
					item.classList.remove('hidden');
					const lastRenderCount = Number(item.dataset.messageCount) || 0;
					if (msgs.length > lastRenderCount) {
						const messageDifference = msgs.length - lastRenderCount;
						visibleStart[name] = (visibleStart[name] || 0) + messageDifference;
						const newMsgs = msgs.slice(lastRenderCount);
						const newFragment = loadMessages(lastRenderCount, newMsgs, lastRenderCount);
						item.appendChild(newFragment);
						item.dataset.messageCount = String(msgs.length);
						requestAnimationFrame(() => {
							item.scrollTop = item.scrollHeight;
						});
					} else if (scrollPositions[name] !== undefined) {
						requestAnimationFrame(() => {
							item.scrollTop = scrollPositions[name];
						});
					}
					updateChatHeader(name);
					refreshInputForUser(name);
				}
			} else {
				onSelectUser();
			}
		});

		userListDiv.appendChild(divElement);
	});
}

// ============================================================================
// CHAT RENDERING
// ============================================================================

function updateBlockedUI(user: string): void {
	const header = chatBlock.querySelector<HTMLDivElement>('.chat-header')!;
	const blockBtn = header.querySelector<HTMLButtonElement>("[block-button='true']")!;
	const inviteWrapper = chatBlock.querySelector<HTMLDivElement>('.invite-wrapper')!;
	const inviteBtn = inviteWrapper.querySelector<HTMLButtonElement>('.chat-invite-btn')!;
	const input = chatBlock.querySelector<HTMLDivElement>('.chat-input')!;
	const sendBtn = chatBlock.querySelector<HTMLButtonElement>('.chat-send-btn')!;

	const isBlocked = blockedUsers.has(user);
	blockBtn.textContent = isBlocked ? 'Unblock' : 'Block';
	blockBtn.setAttribute('aria-pressed', String(isBlocked));

	inviteBtn.classList.toggle('disabled', user === 'me' || isBlocked);
	inviteBtn.title = isBlocked ? `Cannot invite ${user} (blocked)` : `Invite ${user} to play`;

	const placeholderText = isBlocked
		? `You have blocked @${user}. Unblock to send messages.`
		: `Type a message to @${user}`;
	input.dataset.placeholder = placeholderText;
	input.contentEditable = isBlocked ? 'false' : 'true';

	if (isBlocked) {
		input.textContent = '';
		input.classList.add('empty');
		clearDraft(user);
		input.classList.add('blocked-conversation');
		sendBtn.disabled = true;
		sendBtn.hidden = true;
		inviteWrapper.setAttribute('aria-disabled', 'true');
	} else {
		input.classList.remove('blocked-conversation');
		sendBtn.disabled = false;
		sendBtn.hidden = input.textContent!.trim() === '';
		inviteWrapper.removeAttribute('aria-disabled');
	}
}

function refreshInputForUser(user: string): void {
	updateBlockedUI(user);

	const form = chatBlock.querySelector<HTMLFormElement>('.chat-input-form');
	if (!form) return;

	const input = form.querySelector<HTMLDivElement>('.chat-input');
	const sendBtn = form.querySelector<HTMLButtonElement>('.chat-send-btn');
	if (!input || !sendBtn) return;

	if (blockedUsers.has(user)) {
		input.textContent = '';
		input.classList.add('empty');
		clearDraft(user);
		sendBtn.hidden = true;
		return;
	}

	const draftText = drafts[user] || '';
	input.textContent = draftText;
	if (draftText.trim() === '') {
		input.classList.add('empty');
		sendBtn.hidden = true;
	} else {
		input.classList.remove('empty');
		sendBtn.hidden = false;
	}
}

function updateChatHeader(user: string): void {
	const header = chatBlock.querySelector<HTMLDivElement>('.chat-header')!;
	const profileImg = header.querySelector<HTMLImageElement>('.img_profile')!;
	const titleSpan = header.querySelector<HTMLSpanElement>('.chat-header-title')!;
	const profileLink = header.querySelector<HTMLAnchorElement>('.chat-header-profile-pic')!;
	const headerBlockBtn = header.querySelector<HTMLButtonElement>("[block-button='true']")!;

	profileImg.src = profilepics[users.indexOf(user) % profilepics.length];
	profileImg.alt = `${user}'s profile picture`;
	titleSpan.textContent = user;
	profileLink.href = `/profile/${encodeURIComponent(user)}`;

	const isBlocked = blockedUsers.has(user);
	headerBlockBtn.textContent = isBlocked ? 'Unblock' : 'Block';
	headerBlockBtn.setAttribute('aria-pressed', String(isBlocked));
	headerBlockBtn.hidden = user === 'me';
}

function updateBlockedState(user: string): void {
	if (!user) return;

	reorderUserList(user);

	const selector = `.chat-messages[user="${CSS.escape(user)}"]`;
	const messagesDiv = chatBlock.querySelector<HTMLDivElement>(selector);
	if (messagesDiv) {
		const prevScrollTop = messagesDiv.scrollTop;
		const prevScrollHeight = messagesDiv.scrollHeight;

		const msgs = conversations[user] || [];
		messagesDiv.innerHTML = '';
		const startIndex = visibleStart[user] || 0;

		if (startIndex > 0) {
			const topHint = document.createElement('div');
			topHint.className = 'load-older-hint';
			topHint.textContent = 'Scroll up to load earlier messages';
			messagesDiv.appendChild(topHint);
		}

		const slice = msgs.slice(startIndex);
		const fragment = loadMessages(startIndex, slice, startIndex);
		messagesDiv.appendChild(fragment);
		messagesDiv.dataset.messageCount = String(msgs.length);

		requestAnimationFrame(() => {
			const newScrollHeight = messagesDiv.scrollHeight;
			if (prevScrollHeight > 0 && newScrollHeight !== prevScrollHeight) {
				messagesDiv.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
			} else {
				messagesDiv.scrollTop = prevScrollTop;
			}
			if (messagesDiv.scrollTop < 0) {
				messagesDiv.scrollTop = 0;
			}
		});
	}

	updateBlockedUI(user);
	updateChatHeader(user);
}

function renderChat(): void {
	if (!activeUser) return;

	const currentSelector = `.chat-messages[user="${CSS.escape(activeUser)}"]`;
	const oldMessagesDiv = chatBlock.querySelector<HTMLDivElement>(currentSelector);
	let wasNearBottom = true;
	let prevScrollTop = 0;
	let prevScrollHeight = 0;
	if (oldMessagesDiv) {
		prevScrollTop = oldMessagesDiv.scrollTop;
		prevScrollHeight = oldMessagesDiv.scrollHeight;
		const distanceFromBottom =
			oldMessagesDiv.scrollHeight -
			oldMessagesDiv.scrollTop -
			oldMessagesDiv.clientHeight;
		wasNearBottom = distanceFromBottom < SCROLL_THRESHOLD;
		scrollPositions[activeUser] = prevScrollTop;
	}

	const header = chatBlock.querySelector<HTMLDivElement>('.chat-header')!;
	const profileImg = header.querySelector<HTMLImageElement>('.img_profile')!;
	const titleSpan = header.querySelector<HTMLSpanElement>('.chat-header-title')!;
	const profileLink = header.querySelector<HTMLAnchorElement>('.chat-header-profile-pic')!;
	const headerBlockBtn = header.querySelector<HTMLButtonElement>("[block-button='true']")!;
	profileImg.classList.remove('hidden');
	titleSpan.classList.remove('hidden');
	profileLink.classList.remove('hidden');
	headerBlockBtn.classList.remove('hidden');

	// Update header for the active user
	updateChatHeader(activeUser);

	const form = chatBlock.querySelector<HTMLFormElement>('.chat-input-form')!;

	let messagesDiv = chatBlock.querySelector<HTMLDivElement>(currentSelector);
	if (!messagesDiv) {
		const templateDiv = chatBlock.querySelector<HTMLDivElement>('.chat-messages:not([user])');
		if (templateDiv) messagesDiv = templateDiv;
		else {
			messagesDiv = document.createElement('div');
			messagesDiv.className = 'chat-messages';
			messagesDiv.setAttribute('role', 'log');
			messagesDiv.setAttribute('aria-live', 'polite');
			chatBlock.insertBefore(messagesDiv, form);
		}
		messagesDiv.setAttribute('user', `${activeUser}`);
	}

	activeUsers.add(activeUser);

	chatBlock.querySelectorAll<HTMLDivElement>('.chat-messages[user]').forEach((div) => {
		if (div === messagesDiv) div.classList.remove('hidden');
		else div.classList.add('hidden');
	});

	const newBlockBtn = headerBlockBtn.cloneNode(true) as HTMLButtonElement;
	headerBlockBtn.replaceWith(newBlockBtn);
	newBlockBtn.addEventListener('click', (e) => {
		e.preventDefault();
		e.stopPropagation();
		if (blockedUsers.has(activeUser!)) blockedUsers.delete(activeUser!);
		else {
			blockedUsers.add(activeUser!);
			if (activeUser)
				conversations[activeUser]?.forEach((element) => {
					element.hidden = true;
				});
		}
		updateBlockedState(activeUser!);
	});

	const msgs = conversations[activeUser] || [];
	if (visibleStart[activeUser] === undefined)
		visibleStart[activeUser] = Math.max(0, msgs.length - MESSAGES_PAGE);
	let startIndex = visibleStart[activeUser];

	const lastPageStart = Math.max(0, msgs.length - MESSAGES_PAGE);
	if (startIndex >= lastPageStart) wasNearBottom = true;

	const slice = msgs.slice(startIndex);
	const fragment = loadMessages(startIndex, slice, startIndex);
	messagesDiv.appendChild(fragment);
	messagesDiv.dataset.messageCount = String(msgs.length);

	if (startIndex > 0) {
		const topHint = document.createElement('div');
		topHint.className = 'load-older-hint';
		topHint.textContent = 'Scroll up to load earlier messages';
		messagesDiv.insertBefore(topHint, messagesDiv.firstChild);
	}

	const newForm = form.cloneNode(true) as HTMLFormElement;
	form.replaceWith(newForm);
	const newInput = newForm.querySelector<HTMLDivElement>('.chat-input')!;
	const newSendBtn = newForm.querySelector<HTMLButtonElement>('.chat-send-btn')!;
	const newInviteWrapper = newForm.querySelector<HTMLDivElement>('.invite-wrapper')!;
	const newInviteBtn = newInviteWrapper.querySelector<HTMLButtonElement>('.chat-invite-btn')!;
	const newInviteMenu = newInviteWrapper.querySelector<HTMLDivElement>('.invite-menu')!;
	const newInviteMenuBtns = newInviteMenu.querySelectorAll<HTMLButtonElement>(
		'.invite-menu-btn'
	);
	const newBtnPong = newInviteMenuBtns[0];
	newInviteMenu.classList.add('hidden');
	newInviteWrapper.classList.remove('hidden');
	newInput.classList.remove('hidden');
	newSendBtn.classList.remove('hidden');

	newInviteBtn.title = `Invite ${activeUser} to play`;
	newInviteBtn.classList.toggle('disabled', activeUser === 'me' || blockedUsers.has(activeUser!));
	if (blockedUsers.has(activeUser!))
		newInviteBtn.title = `Cannot invite ${activeUser} (blocked)`;

	const placeholderText = blockedUsers.has(activeUser)
		? `You have blocked @${activeUser}. Unblock to send messages.`
		: `Type a message to @${activeUser}`;
	newInput.dataset.placeholder = placeholderText;
	newInput.contentEditable = blockedUsers.has(activeUser) ? 'false' : 'true';

	const initialDraft = drafts[activeUser] || '';
	if (initialDraft && !blockedUsers.has(activeUser)) {
		newInput.textContent = initialDraft;
		newInput.classList.remove('empty');
	} else {
		newInput.classList.add('empty');
		newInput.textContent = '';
	}

	if (blockedUsers.has(activeUser)) {
		newInput.classList.add('blocked-conversation');
		newSendBtn.disabled = true;
		newSendBtn.hidden = true;
		newBlockBtn.textContent = 'Unblock';
		newBlockBtn.setAttribute('aria-pressed', 'true');
		newInviteWrapper.setAttribute('aria-disabled', 'true');
	} else {
		newInput.classList.remove('blocked-conversation');
		newSendBtn.disabled = false;
		newSendBtn.hidden = newInput.textContent!.trim() === '';
		newBlockBtn.textContent = 'Block';
		newBlockBtn.setAttribute('aria-pressed', 'false');
		newInviteWrapper.removeAttribute('aria-disabled');
	}

	newBtnPong.addEventListener('click', (ev) => {
		ev.preventDefault();
		ev.stopPropagation();
		if (!activeUser) return;
		if (blockedUsers.has(activeUser)) return;
		sendInvite(activeUser);
		newInviteMenu.classList.add('hidden');
	});

	newInviteBtn.addEventListener('click', (e) => {
		e.preventDefault();
		e.stopPropagation();
		if (activeUser === 'me' || blockedUsers.has(activeUser!)) return;
		newInviteMenu.classList.toggle('hidden');
	});

	const newMessagesDiv = messagesDiv.cloneNode(true) as HTMLDivElement;
	messagesDiv.replaceWith(newMessagesDiv);

	newForm.addEventListener('submit', (e) => {
		e.preventDefault();
		submitMessage(newInput, newSendBtn, newMessagesDiv);
	});

	newInput.addEventListener('keydown', (e: KeyboardEvent) => {
		if (e.isComposing) return;
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			submitMessage(newInput, newSendBtn, newMessagesDiv);
		}
	});

	newInput.addEventListener('input', () => {
		if (newInput.textContent!.trim() === '') {
			newInput.classList.add('empty');
			newInput.textContent = '';
			newSendBtn.hidden = true;
		} else {
			newInput.classList.remove('empty');
			if (!blockedUsers.has(activeUser!)) newSendBtn.hidden = false;
		}

		saveDraft(activeUser, newInput.textContent || '');
	});

	requestAnimationFrame(() => {
		if (wasNearBottom) newMessagesDiv.scrollTop = newMessagesDiv.scrollHeight;
		else if (prevScrollHeight > 0) {
			newMessagesDiv.scrollTop = newMessagesDiv.scrollHeight - prevScrollHeight + prevScrollTop;
			if (newMessagesDiv.scrollTop < 0) newMessagesDiv.scrollTop = 0;
		} else if (scrollPositions[activeUser!] !== undefined) {
			newMessagesDiv.scrollTop = scrollPositions[activeUser!];
		} else {
			newMessagesDiv.scrollTop = prevScrollTop;
		}
	});

	newMessagesDiv.addEventListener('click', (e) => {
		const target = e.target as HTMLElement;
		if (!target) return;
		if (target.classList.contains('show-blocked-btn')) {
			const idxStr = target.dataset.index;
			if (!idxStr) return;
			const idx = Number(idxStr);
			const msgs = conversations[activeUser!] || [];
			const msg = msgs[idx];
			if (!msg) return;
			const container = target.closest('.chat-message');
			if (!container) return;

			msg.hidden = !msg.hidden;
			target.setAttribute('aria-pressed', String(!msg.hidden));
			container.setAttribute('data-shown', String(!msg.hidden));
		}

		// Handle invite button clicks
		const inviteBtn = target.closest<HTMLButtonElement>(
			'.invite-accept, .invite-decline, .invite-cancel, .invite-go'
		);
		if (inviteBtn) {
			const idxStr = inviteBtn.dataset.index;
			if (!idxStr) return;
			const idx = Number(idxStr);
			const msgs = conversations[activeUser!] || [];
			const msg = msgs[idx];
			if (!msg) return;
			const container = inviteBtn.closest('.chat-message');
			if (!container) return;

			if (inviteBtn.classList.contains('invite-accept')) {
				updateInviteState(container as HTMLElement, msg, 'accepted', idx);
				setTimeout(() => {
					if (window.loadPage)
						window.loadPage(`/pong-board?enemy=${activeUser}`);
					else
						return ; // error popup should happen here
				}, NAVIGATION_DELAY);
				return;
			}
			if (inviteBtn.classList.contains('invite-decline')) {
				updateInviteState(container as HTMLElement, msg, 'declined', idx);
				return;
			}
			if (inviteBtn.classList.contains('invite-cancel')) {
				updateInviteState(container as HTMLElement, msg, 'cancelled', idx);
				return;
			}
			if (inviteBtn.classList.contains('invite-go')) {
				setTimeout(() => {
					if (window.loadPage)
						window.loadPage(`/pong-board?enemy=${activeUser}`);
					else
						return ; // error popup should happen here
				}, NAVIGATION_DELAY);
				return;
			}
		}
	});

	const handleScroll = () => {
		const user = activeUser!;
		const currentMessagesDiv = chatBlock.querySelector<HTMLDivElement>(
			`.chat-messages[user="${CSS.escape(user)}"]`
		);
		if (!currentMessagesDiv || currentMessagesDiv.classList.contains('hidden')) return;
		if (loadingOlderMessages[user]) return;

		if (currentMessagesDiv.scrollTop <= LOAD_MORE_THRESHOLD) {
			const curStart = visibleStart[user] || 0;
			if (curStart === 0) return;

			loadingOlderMessages[user] = true;
			const prevScrollHeight = currentMessagesDiv.scrollHeight;
			const prevScrollTop = currentMessagesDiv.scrollTop;
			const newStart = Math.max(0, curStart - MESSAGES_PAGE);
			const msgs = conversations[user] || [];
			const olderSlice = msgs.slice(newStart, curStart);
			visibleStart[user] = newStart;

			setTimeout(() => {
				const activeMsgDiv = chatBlock.querySelector<HTMLDivElement>(
					`.chat-messages[user="${CSS.escape(user)}"]`
				);
				if (!activeMsgDiv) return;

				const olderFragment = loadMessages(newStart, olderSlice, newStart);
				const oldHint = activeMsgDiv.querySelector('.load-older-hint');
				if (oldHint) oldHint.remove();
				activeMsgDiv.insertBefore(olderFragment, activeMsgDiv.firstChild);

				if (newStart > 0) {
					const topHint = document.createElement('div');
					topHint.className = 'load-older-hint';
					topHint.textContent = 'Scroll up to load earlier messages';
					activeMsgDiv.insertBefore(topHint, activeMsgDiv.firstChild);
				}

				requestAnimationFrame(() => {
					activeMsgDiv.scrollTop = activeMsgDiv.scrollHeight - prevScrollHeight + prevScrollTop;
					loadingOlderMessages[user] = false;
				});
			}, TIMEOUT_DELAY);
		}
	};

	newMessagesDiv.addEventListener('scroll', handleScroll);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

export {};

initLayout();
seedDummyData();
renderUserList(renderChat);
