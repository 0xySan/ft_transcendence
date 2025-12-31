// ============================================================================
// Chat Application - All-in-One File
// ============================================================================
// Complete chat system with messaging, user list, layout, and invite handling

declare function translateElement(language: string, element: HTMLElement): void;
declare function getTranslatedElementText(language: string, element: HTMLElement) : Promise<string | null>;
declare function getUserLang(): string;

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
	id?: number;
	conversationId?: number;
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
const LAST_ACTIVE_USER_KEY = 'chat_last_active_user';
const API_BASE = '/api/chat';
const DEFAULT_AVATAR = document.querySelector<HTMLTemplateElement>('.default-pfp-temp')!.content.cloneNode(true) as DocumentFragment;
const LANG = getUserLang() || 'en';

// Chat State
const conversations: Conversation = {};
let activeUser: string | null = null;
const blockedUsers: Set<string> = new Set();
const activeUsers: Set<string> = new Set();

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
	const res = await fetch(path, {
		credentials: 'include',
		headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
		...options,
	});
	if (!res.ok) {
		if (res.status === 401) {
			window.location.href = '/';
			throw new Error('Unauthorized');
		}
		const text = await res.text();
		throw new Error(`API ${res.status}: ${text || res.statusText}`);
	}
	return (await res.json()) as T;
}
const visibleStart: Record<string, number> = {};
const scrollPositions: Record<string, number> = {};
const loadingOlderMessages: Record<string, boolean> = {};
const conversationMeta: Record<string, { conversationId: number; userId: string; membersById: Record<string, string> }> = {};
const userIdToName: Record<string, string> = {};
const userNameToUserId: Record<string, string> = {};
const userIdToAvatar: Record<string, string | DocumentFragment> = {};
const userIdToUsername: Record<string, string> = {}; // prefer username for profile links
let currentUserId: string | null = null;
const allMessagesLoaded: Record<string, boolean> = {};

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
const profilepics: (string | DocumentFragment)[] = [];

// Layout state
let userListHidden = false;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function setAvatarToElement(imgElement: HTMLImageElement, avatar: string | DocumentFragment): void {
	if (typeof avatar === 'string')
		imgElement.src = avatar;
	else if (avatar instanceof DocumentFragment) {
		if (imgElement.getAttribute('chat-header') === 'true') {
			avatar.getElementById('nav-pfp-fallback')!.setAttribute('chat-header', 'true');
			imgElement.replaceWith(avatar.cloneNode(true));
		}
		else 
			imgElement.replaceWith(avatar.cloneNode(true));
	}
}

function setActiveUser(user: string | null): void {
	activeUser = user;
	try {
		if (user) sessionStorage.setItem(LAST_ACTIVE_USER_KEY, user);
		else sessionStorage.removeItem(LAST_ACTIVE_USER_KEY);
	} catch (_) {
		// ignore storage failures
	}
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

function showWarning(message: string): void {
	const existing = document.querySelector('.chat-warning-notification');
	if (existing) existing.remove();

	const warning = document.createElement('div');
	warning.className = 'chat-warning-notification';
	warning.textContent = message;
	warning.style.cssText = `
		position: fixed;
		top: 20px;
		left: 50%;
		transform: translateX(-50%);
		background: #f44336;
		color: white;
		padding: 12px 24px;
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0,0,0,0.2);
		z-index: 10000;
		font-size: 14px;
		animation: slideDown 0.3s ease-out;
	`;
	
	const style = document.createElement('style');
	style.textContent = `
		@keyframes slideDown {
			from { opacity: 0; transform: translate(-50%, -20px); }
			to { opacity: 1; transform: translate(-50%, 0); }
		}
	`;
	document.head.appendChild(style);
	
	document.body.appendChild(warning);
	
	setTimeout(() => {
		warning.style.animation = 'slideDown 0.3s ease-out reverse';
		setTimeout(() => warning.remove(), 300);
	}, 5000);
}

// ============================================================================
// DATA LOADING (API)
// ============================================================================

function mapApiMessage(
	msg: {
		message_id: number;
		conversation_id: number;
		sender_id: string;
		content: string;
		message_type: 'text' | 'invite' | 'system';
		invite_state: 'pending' | 'accepted' | 'declined' | 'cancelled' | null;
		created_at: string;
	},
	membersById: Record<string, string>
): Message {
	const senderName = msg.sender_id === currentUserId ? 'me' : membersById[msg.sender_id] || msg.sender_id;
	return {
		sender: senderName,
		text: msg.content,
		timestamp: new Date(msg.created_at),
		type: msg.message_type,
		inviteState: msg.invite_state || undefined,
		id: msg.message_id,
		conversationId: msg.conversation_id,
	};
}

async function loadChatData(): Promise<void> {
	try {
		Object.keys(conversations).forEach((key) => delete conversations[key]);
		users.length = 0;
		profilepics.length = 0;
		blockedUsers.clear();
		Object.keys(visibleStart).forEach((k) => delete visibleStart[k]);
		Object.keys(conversationMeta).forEach((k) => delete conversationMeta[k]);
		Object.keys(userIdToName).forEach((k) => delete userIdToName[k]);
		Object.keys(userNameToUserId).forEach((k) => delete userNameToUserId[k]);
		Object.keys(userIdToAvatar).forEach((k) => delete userIdToAvatar[k]);
		Object.keys(allMessagesLoaded).forEach((k) => delete allMessagesLoaded[k]);

		const convPayload = await apiFetch<{
			conversations: Array<{
				id: number;
				type: 'direct' | 'group';
				title: string | null;
				members: Array<{
					userId: string;
					username: string | null;
					displayName: string | null;
					profilePicture: string | null;
				}>;
			}>;
			currentUserId: string;
			blocked: string[];
		}>(`${API_BASE}/conversations`);

		currentUserId = convPayload.currentUserId;

		const directConversations = convPayload.conversations.filter((c) => c.type === 'direct');
		const messagePromises: Array<Promise<void>> = [];

		for (const conv of directConversations) {
			const membersById: Record<string, string> = {};
			conv.members.forEach((m) => {
				const name = m.displayName || m.username || m.userId;
				membersById[m.userId] = name;
				userIdToName[m.userId] = name;
				userNameToUserId[name] = m.userId;
				if (m.profilePicture) userIdToAvatar[m.userId] = `/api/users/data/imgs/${m.profilePicture}`;
				else userIdToAvatar[m.userId] = DEFAULT_AVATAR.cloneNode(true) as DocumentFragment;
				if (m.username) userIdToUsername[m.userId] = m.username; // store username
			});

			const peer = conv.members.find((m) => m.userId !== currentUserId);
			if (!peer) continue;
			const peerName = peer.displayName || peer.username || peer.userId;

			conversationMeta[peerName] = {
				conversationId: conv.id,
				userId: peer.userId,
				membersById,
			};

			users.push(peerName);
			profilepics.push(peer.profilePicture ? `/api/users/data/imgs/${peer.profilePicture}` : (DEFAULT_AVATAR.cloneNode(true) as DocumentFragment));
			conversations[peerName] = [];

			messagePromises.push(
				apiFetch<{ messages: any[] }>(
					`${API_BASE}/conversations/${conv.id}/messages?limit=${MESSAGES_PAGE}&ascending=false`
				).then((res) => {
					const msgs = res.messages
						.map((m) => mapApiMessage(m, membersById))
						.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
					conversations[peerName] = msgs;
					visibleStart[peerName] = Math.max(0, msgs.length - MESSAGES_PAGE);
					allMessagesLoaded[peerName] = msgs.length < MESSAGES_PAGE;
				})
			);
		}

		await Promise.all(messagePromises);

		convPayload.blocked?.forEach((blockedId) => {
			const name = userIdToName[blockedId] || blockedId;
			blockedUsers.add(name);
		});

		if (users.length > 0) {
			const saved = (() => {
				try { return sessionStorage.getItem(LAST_ACTIVE_USER_KEY); } catch (_) { return null; }
			})();
			const initialUser = saved && users.includes(saved) ? saved : users[0];
			setActiveUser(initialUser);
			renderUserList(renderChat);
			// Ensure the active conversation renders immediately without requiring a click
			renderChat();
			// Keep user list selection state in sync
			if (initialUser) reorderUserList(initialUser);
		} else {
			chatBlock.innerHTML = '<p class="chat-empty">No conversations yet.</p>';
		}
	} catch (err) {
		if (err instanceof Error && err.message.toLowerCase().includes('unauthorized')) {
			// Already redirected in apiFetch
			return;
		}
		console.error('Failed to load chat data:', err);
	}
}

async function blockUserApi(user: string): Promise<boolean> {
	const targetId = conversationMeta[user]?.userId || userNameToUserId[user];
	if (!targetId) return false;
	await apiFetch(`${API_BASE}/blocks/${encodeURIComponent(targetId)}`, { 
		method: 'POST',
		body: JSON.stringify({})
	});
	blockedUsers.add(user);
	return true;
}

async function unblockUserApi(user: string): Promise<boolean> {
	const targetId = conversationMeta[user]?.userId || userNameToUserId[user];
	if (!targetId) return false;
	await apiFetch(`${API_BASE}/blocks/${encodeURIComponent(targetId)}`, { 
		method: 'DELETE',
		body: JSON.stringify({})
	});
	blockedUsers.delete(user);
	return true;
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
			container.dataset.messageId = String(first.id || '');

			const timeSpan = document.createElement('span');
			timeSpan.className = 'chat-time';
			timeSpan.textContent = time;
			container.appendChild(timeSpan);
			container.appendChild(document.createElement('br'));

			const inviteText = document.createElement('span');
			inviteText.className = 'invite-text';
			const displayUser = first.sender === 'me' ? String(activeUser || 'player') : first.sender;

			if (first.sender === 'me')
				inviteText.textContent = `You invited ${displayUser} to play Pong.`;
			else
				inviteText.textContent = `${displayUser} invited you to play Pong.`;

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

	const msgs = conversations[activeUser] || [];
	const prevMsg = index > 0 ? msgs[index - 1] : null;

	const shouldGroup = prevMsg &&
		prevMsg.sender === msg.sender &&
		msg.type === 'text' &&
		prevMsg.type === 'text' &&
		!(msg.sender !== 'me' && blockedUsers.has(msg.sender)) &&
		(msg.timestamp.getTime() - prevMsg.timestamp.getTime()) <= GROUP_WINDOW_MS;

	if (shouldGroup && prevMsg)
	{
		const lastContainer = messagesDiv.querySelector<HTMLDivElement>('.chat-message:last-of-type');
		if (lastContainer && !lastContainer.classList.contains('blocked') && !lastContainer.classList.contains('invite')) {
			const newTextSpan = document.createElement('span');
			newTextSpan.className = 'chat-group-text';
			appendTextWithLineBreaks(newTextSpan, msg.text);
			
			const currentCount = Number(lastContainer.dataset.count) || 1;
			lastContainer.dataset.count = String(currentCount + 1);
			
			const buttonContainers = lastContainer.querySelectorAll('div');
			if (buttonContainers.length > 0)
			{
				lastContainer.insertBefore(document.createElement('br'), buttonContainers[0]);
				lastContainer.insertBefore(newTextSpan, buttonContainers[0]);
			}
			else
			{
				lastContainer.appendChild(document.createElement('br'));
				lastContainer.appendChild(newTextSpan);
			}
		}
	}
	else
	{
		const fragment = loadMessages(index, [msg], index);
		messagesDiv.appendChild(fragment);
	}

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
	msgIndex: number,
	skipApi = false
): void {
	msg.inviteState = newState;
	if (!skipApi && msg.id) {
		apiFetch(`${API_BASE}/messages/${msg.id}/invite`, {
			method: 'PATCH',
			body: JSON.stringify({ state: newState, conversationId: msg.conversationId }),
		}).catch((err) => console.error('Failed to update invite state', err));
	}

	// Remove old buttons
	const buttonsContainer = container.querySelector('div');
	if (buttonsContainer) buttonsContainer.remove();

	// Update classes
	container.classList.remove('pending');
	container.classList.add(newState);

	// If accepted, add the "go" button
	if (newState === 'accepted') {
		const goTemp = document.querySelector<HTMLTemplateElement>('.invite-go-temp');
		if (!goTemp) return; // template missing, nothing to render
		const fragment = goTemp.content.cloneNode(true) as DocumentFragment;
		const goBtn = fragment.querySelector<HTMLButtonElement>('.invite-go');
		if (goBtn) goBtn.dataset.index = String(msgIndex);
		container.appendChild(fragment);
	}
}

// ============================================================================
// ACTIONS
// ============================================================================


async function submitMessage(
	input: HTMLDivElement,
	sendBtn: HTMLButtonElement,
	messagesDiv: HTMLDivElement
): Promise<void> {
	if (!activeUser) return;
	if (blockedUsers.has(activeUser)) return;

	const text = input.textContent?.trim() || '';
	if (!text) return;

	const meta = conversationMeta[activeUser];
	if (!meta) return;

	try {
		const res = await apiFetch<{ message: any }>(`${API_BASE}/conversations/${meta.conversationId}/messages`, {
			method: 'POST',
			body: JSON.stringify({ content: text, messageType: 'text' }),
		});

		const newMsg = mapApiMessage(res.message, meta.membersById);

		if (!conversations[activeUser]) conversations[activeUser] = [];
		conversations[activeUser].push(newMsg);
		const msgIndex = conversations[activeUser].length - 1;

		const len = conversations[activeUser].length;
		const currentStart = visibleStart[activeUser];

		if (currentStart === undefined) {
			visibleStart[activeUser] = Math.max(0, len - MESSAGES_PAGE);
		} else if (
			currentStart >= len - 1 - MESSAGES_PAGE ||
			messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight < 100
		) {
			visibleStart[activeUser] = Math.max(0, len - MESSAGES_PAGE);
		}

		input.textContent = '';
		clearDraft(activeUser);
		input.classList.add('empty');
		sendBtn.hidden = true;
		appendMessageToDOM(newMsg, msgIndex);
		reorderUserList(activeUser);
	} catch (err) {
		if (err instanceof Error && err.message.includes('403')) {
			showWarning('You cannot send messages to this user');
			input.textContent = '';
			clearDraft(activeUser);
			input.classList.add('empty');
			sendBtn.hidden = true;
		}
	}
}

async function sendInvite(user: string): Promise<void> {
	if (!user) return;
	if (blockedUsers.has(user)) return;
	const meta = conversationMeta[user];
	if (!meta) return;

	try {
		const res = await apiFetch<{ message: any }>(`${API_BASE}/conversations/${meta.conversationId}/messages`, {
			method: 'POST',
			body: JSON.stringify({ content: `invited ${user} to a pong game`, messageType: 'invite', inviteState: 'pending' }),
		});

		const inviteMsg = mapApiMessage(res.message, meta.membersById);
		if (!conversations[user]) conversations[user] = [];
		conversations[user].push(inviteMsg);
		const msgIndex = conversations[user].length - 1;
		reorderUserList(user);
		appendMessageToDOM(inviteMsg, msgIndex);
		setTimeout(() => {
			if (window.loadPage)
				window.loadPage(`/lobby?code=TEMP_PONG_CODE`);
			else
				return ; // error popup should happen here
		}, NAVIGATION_DELAY);
	} catch (err) {
		if (err instanceof Error && err.message.includes('403')) {
			showWarning('You cannot send invites to this user');
		}
	}
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
			const userId = conversationMeta[name]?.userId;
			const avatar = userId ? userIdToAvatar[userId] : DEFAULT_AVATAR.cloneNode(true) as DocumentFragment;
			setAvatarToElement(imgElement, avatar || (DEFAULT_AVATAR.cloneNode(true) as DocumentFragment));
		}
		const pElement = fragment.querySelector<HTMLParagraphElement>('.name_profile');
		if (pElement) {
			let displayName = name;
			if (displayName.length > 8) {
				displayName = displayName.substring(0, 8) + '...';
			}
			pElement.textContent = displayName;
		}

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

	input.dataset.translateKey = blockedUsers.has(user) ? "chat.block.blockedPlaceholder" : "chat.block.placeholder";
	getTranslatedElementText(LANG, input).then(translatedText => {
		if (translatedText)
			input.dataset.placeholder = translatedText.replace('$user', user);
	});
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

	const avatar = conversationMeta[user]?.userId
		? userIdToAvatar[conversationMeta[user].userId]
		: profilepics[users.indexOf(user) % Math.max(1, profilepics.length)];
	setAvatarToElement(profileImg, avatar || (DEFAULT_AVATAR.cloneNode(true) as DocumentFragment));
	titleSpan.textContent = user;
	const usernameForLink = conversationMeta[user]?.userId
		? (userIdToUsername[conversationMeta[user].userId] || user)
		: user;
	profileLink.href = `/profile/${encodeURIComponent(usernameForLink)}`;

	const isBlocked = blockedUsers.has(user);
	headerBlockBtn.dataset.translateKey = isBlocked ? "chat.block.unblockbtn" : "chat.block.blockbtn";
	getTranslatedElementText(LANG, headerBlockBtn).then(translatedText => {
		if (translatedText)
			headerBlockBtn.textContent = translatedText;
	});
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
		const user = activeUser as string;
		if (!user) return;
		if (blockedUsers.has(user)) {
			unblockUserApi(user).then(() => updateBlockedState(user));
		} else {
			blockUserApi(user).then(() => {
				conversations[user]?.forEach((element: Message) => {
					element.hidden = true;
				});
				updateBlockedState(user);
			});
		}
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
		topHint.dataset.translateKey = "chat.block.loadHint";
		topHint.textContent = 'Scroll up to load earlier messages';
		translateElement(LANG, topHint);
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

	newInput.dataset.translateKey = blockedUsers.has(activeUser) ? "chat.block.blockedPlaceholder" : "chat.block.placeholder";
	getTranslatedElementText(LANG, newInput).then(translatedText => {
		if (translatedText)
			newInput.dataset.placeholder = translatedText.replace('$user', activeUser!);
	});
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
		newBlockBtn.dataset.translateKey = "chat.block.unblockbtn";
		newBlockBtn.setAttribute('aria-pressed', 'true');
		newInviteWrapper.setAttribute('aria-disabled', 'true');
	} else {
		newInput.classList.remove('blocked-conversation');
		newSendBtn.disabled = false;
		newSendBtn.hidden = newInput.textContent!.trim() === '';
		newBlockBtn.dataset.translateKey = "chat.block.blockbtn";
		newBlockBtn.setAttribute('aria-pressed', 'false');
		newInviteWrapper.removeAttribute('aria-disabled');
	}
	getTranslatedElementText(LANG, newBlockBtn).then(translatedText => {
		if (translatedText)
			newBlockBtn.textContent = translatedText;
	});

	newBtnPong.addEventListener('click', (ev) => {
		ev.preventDefault();
		ev.stopPropagation();
		if (!activeUser) return;
		if (blockedUsers.has(activeUser)) return;
		void sendInvite(activeUser);
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
						window.loadPage(`/lobby?code=TEMP_PONG_CODE`);
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
						window.loadPage(`/lobby?code=TEMP_PONG_CODE`);
					else
						return ; // error popup should happen here
				}, NAVIGATION_DELAY);
				return;
			}
		}
	});

	const handleScroll = async () => {
		const user = activeUser!;
		const currentMessagesDiv = chatBlock.querySelector<HTMLDivElement>(
			`.chat-messages[user="${CSS.escape(user)}"]`
		);
		if (!currentMessagesDiv || currentMessagesDiv.classList.contains('hidden')) return;
		if (loadingOlderMessages[user]) return;

		if (currentMessagesDiv.scrollTop <= LOAD_MORE_THRESHOLD) {
			loadingOlderMessages[user] = true;
			const curStart = visibleStart[user] || 0;
			const prevScrollHeight = currentMessagesDiv.scrollHeight;
			const prevScrollTop = currentMessagesDiv.scrollTop;

			if (curStart > 0) {
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
						topHint.dataset.translateKey = "chat.block.loadHint";
						topHint.textContent = 'Scroll up to load earlier messages';
						translateElement(LANG, topHint);
						activeMsgDiv.insertBefore(topHint, activeMsgDiv.firstChild);
					}

					requestAnimationFrame(() => {
						activeMsgDiv.scrollTop = activeMsgDiv.scrollHeight - prevScrollHeight + prevScrollTop;
						loadingOlderMessages[user] = false;
					});
				}, TIMEOUT_DELAY);
			} else {
				if (allMessagesLoaded[user]) {
					loadingOlderMessages[user] = false;
					return;
				}
				const older = await fetchOlderMessages(user);
				if (!older.length) {
					allMessagesLoaded[user] = true;
					loadingOlderMessages[user] = false;
					return;
				}

				const activeMsgDiv = chatBlock.querySelector<HTMLDivElement>(
					`.chat-messages[user="${CSS.escape(user)}"]`
				);
				if (!activeMsgDiv) {
					loadingOlderMessages[user] = false;
					return;
				}

				const olderFragment = loadMessages(0, older, 0);
				const oldHint = activeMsgDiv.querySelector('.load-older-hint');
				if (oldHint) oldHint.remove();
				activeMsgDiv.insertBefore(olderFragment, activeMsgDiv.firstChild);

				if (older.length === MESSAGES_PAGE) {
					const topHint = document.createElement('div');
					topHint.className = 'load-older-hint';
					topHint.dataset.translateKey = "chat.block.loadHint";
					topHint.textContent = 'Scroll up to load earlier messages';
					translateElement(LANG, topHint);
					activeMsgDiv.insertBefore(topHint, activeMsgDiv.firstChild);
				}

				activeMsgDiv.dataset.messageCount = String((conversations[user] || []).length);

				requestAnimationFrame(() => {
					activeMsgDiv.scrollTop = activeMsgDiv.scrollHeight - prevScrollHeight + prevScrollTop;
					loadingOlderMessages[user] = false;
				});
			}
		}
	};

	newMessagesDiv.addEventListener('scroll', handleScroll);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

export {};

function startChatStream() {
  let es = new EventSource("/api/chat/stream", { withCredentials: true });

  const onMessage = (ev: MessageEvent) => {
    try {
      const payload = JSON.parse(ev.data) as { conversationId: number; message: any };
      const { conversationId } = payload;
      const msg = payload.message;

      // Ignore my own message (already appended after POST)
      if (msg?.sender_id && msg.sender_id === currentUserId) return;

      // Find username by conversationId
      const entry = Object.entries(conversationMeta).find(([_, meta]) => meta.conversationId === conversationId);
      if (!entry) return;

      const username = entry[0];
      const membersById = conversationMeta[username]?.membersById || {};
      const mapped = mapApiMessage(msg, membersById);

      const arr = conversations[username] || (conversations[username] = []);
      
      // Deduplicate by message id for new messages
      if (mapped.id && arr.some((m) => m.id === mapped.id)) return;

      arr.push(mapped);

      if (activeUser === username) {
        const messagesDiv = chatBlock.querySelector<HTMLDivElement>(
          `.chat-messages[user="${CSS.escape(username)}"]`
        );
        if (messagesDiv) appendMessageToDOM(mapped, arr.length - 1);
      }
      reorderUserList(username);
    } catch (e) {
      console.error('Error in chat stream onMessage:', e);
    }
  };
  const onInviteState = (ev: MessageEvent) => {
    try {
      const payload = JSON.parse(ev.data) as { conversationId: number; messageId: number; state: 'accepted' | 'declined' | 'cancelled' };
      const entry = Object.entries(conversationMeta).find(([, meta]) => meta.conversationId === payload.conversationId);
      if (!entry) return;
      const username = entry[0];
      const msgs = conversations[username] || [];
      const idx = msgs.findIndex((m) => m.id === payload.messageId);
      if (idx === -1) return;
      const msg = msgs[idx];
      msg.inviteState = payload.state;

      if (activeUser === username) {
        const messagesDiv = chatBlock.querySelector<HTMLDivElement>(`.chat-messages[user="${CSS.escape(username)}"]`);
        const container = messagesDiv?.querySelector<HTMLElement>(`.chat-message[data-message-id="${payload.messageId}"]`);
        if (container) updateInviteState(container, msg, payload.state, idx, true);
      }
    } catch (e) {
      console.error('Error in inviteState handler:', e);
    }
  };
  const onPing = () => {};
  const onError = () => {
    es.close();
    setTimeout(() => {
      es = new EventSource("/api/chat/stream", { withCredentials: true });
      es.addEventListener("message", onMessage);
      es.addEventListener("inviteState", onInviteState);
      es.addEventListener("ping", onPing);
      es.onerror = onError;
    }, 2000);
  };

  es.addEventListener("message", onMessage);
  es.addEventListener("inviteState", onInviteState);
  es.addEventListener("ping", onPing);
  es.onerror = onError;
}

async function fetchOlderMessages(user: string): Promise<Message[]> {
	const meta = conversationMeta[user];
	if (!meta) return [];
	if (allMessagesLoaded[user]) return [];
	const msgs = conversations[user] || [];
	const offset = msgs.length;

	try {
		const res = await apiFetch<{ messages: any[] }>(
			`${API_BASE}/conversations/${meta.conversationId}/messages?limit=${MESSAGES_PAGE}&ascending=false&offset=${offset}`
		);
		const older = res.messages
			.map((m) => mapApiMessage(m, meta.membersById))
			.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
		if (!older.length) return [];
		conversations[user] = older.concat(msgs);
		visibleStart[user] = 0;
		allMessagesLoaded[user] = older.length < MESSAGES_PAGE;
		return older;
	} catch (err) {
		console.error('Failed to load older messages', err);
		return [];
	}
}

initLayout();
loadChatData().then(startChatStream);
