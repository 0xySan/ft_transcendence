// Chat panel rendering (header, messages, input) and blocked-state updates
import { loadMessages, updateInviteState } from './chatMessages.js';
import { submitMessage, sendInvite } from './chatActions.js';
import { reorderUserList } from './userList.js';
import {
	activeUser,
	activeUsers,
	blockedUsers,
	chatBlock,
	conversations,
	drafts,
	loadingOlderMessages,
	profilepics,
	saveDraft,
	scrollPositions,
	users,
	visibleStart,
	MESSAGES_PAGE,
	SCROLL_THRESHOLD,
	LOAD_MORE_THRESHOLD,
	TIMEOUT_DELAY,
	NAVIGATION_DELAY,
} from './state.js';

/**
 * Updates the blocked state UI for a user.
 */
export function updateBlockedState(user: string): void {
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

/**
 * Updates the blocked state UI elements.
 */
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
	inviteBtn.title = isBlocked
		? `Cannot invite ${user} (blocked)`
		: `Invite ${user} to play`;

	const placeholderText = isBlocked
		? `You have blocked @${user}. Unblock to send messages.`
		: `Type a message to @${user}`;
	input.dataset.placeholder = placeholderText;
	input.contentEditable = isBlocked ? 'false' : 'true';

	if (isBlocked) {
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

/**
 * Updates the chat header for the given user.
 */
export function updateChatHeader(user: string): void {
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

export function renderChat(): void {
	if (!activeUser) return;

	const currentSelector = `.chat-messages[user="${CSS.escape(activeUser)}"]`;
	const oldMessagesDiv = chatBlock.querySelector<HTMLDivElement>(currentSelector);
	let wasNearBottom = true;
	let prevScrollTop = 0;
	let prevScrollHeight = 0;
	if (oldMessagesDiv) {
		prevScrollTop = oldMessagesDiv.scrollTop;
		prevScrollHeight = oldMessagesDiv.scrollHeight;
		const distanceFromBottom = oldMessagesDiv.scrollHeight - oldMessagesDiv.scrollTop - oldMessagesDiv.clientHeight;
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
		if (templateDiv)
			messagesDiv = templateDiv;
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
			if (activeUser) conversations[activeUser].forEach((element) => { element.hidden = true; });
		}
		updateBlockedState(activeUser!);
	});

	const msgs = conversations[activeUser] || [];
	if (visibleStart[activeUser] === undefined)
		visibleStart[activeUser] = Math.max(0, msgs.length - MESSAGES_PAGE);
	let startIndex = visibleStart[activeUser];

	const lastPageStart = Math.max(0, msgs.length - MESSAGES_PAGE);
	if (startIndex >= lastPageStart)
		wasNearBottom = true;

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
	const newInviteMenuBtns = newInviteMenu.querySelectorAll<HTMLButtonElement>('.invite-menu-btn');
	const newBtnTetris = newInviteMenuBtns[0];
	const newBtnPong = newInviteMenuBtns[1];
	newInviteMenu.classList.add('hidden');
	newInviteWrapper.classList.remove('hidden');
	newInput.classList.remove('hidden');
	newSendBtn.classList.remove('hidden');

	newInviteBtn.title = activeUser ? `Invite ${activeUser} to play` : 'Invite to play';
	newInviteBtn.classList.toggle('disabled', activeUser === 'me' || blockedUsers.has(activeUser!));
	if (blockedUsers.has(activeUser!))
		newInviteBtn.title = `Cannot invite ${activeUser} (blocked)`;

	const placeholderText = blockedUsers.has(activeUser)
		? `You have blocked @${activeUser}. Unblock to send messages.`
		: `Type a message to @${activeUser}`;
	newInput.dataset.placeholder = placeholderText;
	newInput.contentEditable = blockedUsers.has(activeUser) ? 'false' : 'true';

	const initialDraft = drafts[activeUser || ''] || '';
	if (initialDraft && !blockedUsers.has(activeUser)) {
		newInput.textContent = initialDraft;
		newInput.classList.remove('empty');
	}
	else {
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
	}
	else {
		newInput.classList.remove('blocked-conversation');
		newSendBtn.disabled = false;
		newSendBtn.hidden = newInput.textContent!.trim() === '';
		newBlockBtn.textContent = 'Block';
		newBlockBtn.setAttribute('aria-pressed', 'false');
		newInviteWrapper.removeAttribute('aria-disabled');
	}

	newBtnTetris.addEventListener('click', (ev) => {
		ev.preventDefault();
		ev.stopPropagation();
		if (!activeUser) return;
		if (blockedUsers.has(activeUser)) return;
		sendInvite(activeUser, 'tetris');
		newInviteMenu.classList.add('hidden');
	});

	newBtnPong.addEventListener('click', (ev) => {
		ev.preventDefault();
		ev.stopPropagation();
		if (!activeUser) return;
		if (blockedUsers.has(activeUser)) return;
		sendInvite(activeUser, 'pong');
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
		}
		else {
			newInput.classList.remove('empty');
			if (!blockedUsers.has(activeUser!))
				newSendBtn.hidden = false;
		}

		saveDraft(activeUser, newInput.textContent || '');
	});

	requestAnimationFrame(() => {
		if (wasNearBottom)
			newMessagesDiv.scrollTop = newMessagesDiv.scrollHeight;
		else if (prevScrollHeight > 0) {
			newMessagesDiv.scrollTop = newMessagesDiv.scrollHeight - prevScrollHeight + prevScrollTop;
			if (newMessagesDiv.scrollTop < 0)
				newMessagesDiv.scrollTop = 0;
		}
		else if (scrollPositions[activeUser!] !== undefined) {
			newMessagesDiv.scrollTop = scrollPositions[activeUser!];
		}
		else {
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

		if (target.classList.contains('invite-accept') || target.classList.contains('invite-decline') || target.classList.contains('invite-cancel') || target.classList.contains('invite-go')) {
			const idxStr = target.dataset.index;
			if (!idxStr) return;
			const idx = Number(idxStr);
			const msgs = conversations[activeUser!] || [];
			const msg = msgs[idx];
			if (!msg) return;
			const container = target.closest('.chat-message');
			if (!container) return;
			
			if (target.classList.contains('invite-accept')) {
				updateInviteState(container as HTMLElement, msg, 'accepted', idx);
				setTimeout(() => {
                    window.location.href = `/pong-board?enemy=${activeUser}`;
                }, NAVIGATION_DELAY);
				return;
			}
			if (target.classList.contains('invite-decline')) {
				updateInviteState(container as HTMLElement, msg, 'declined', idx);
				return;
			}
			if (target.classList.contains('invite-cancel')) {
				updateInviteState(container as HTMLElement, msg, 'cancelled', idx);
				return;
			}
			if (target.classList.contains('invite-go')) {
				setTimeout(() => {
                    window.location.href = `/pong-board?enemy=${activeUser}`;
                }, NAVIGATION_DELAY);
				return;
			}
		}
	});

	const handleScroll = () => {
		const user = activeUser!;
		const currentMessagesDiv = chatBlock.querySelector<HTMLDivElement>(`.chat-messages[user="${CSS.escape(user)}"]`);
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
				const activeMsgDiv = chatBlock.querySelector<HTMLDivElement>(`.chat-messages[user="${CSS.escape(user)}"]`);
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
