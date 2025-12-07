// Message rendering helpers
import { convertTimestampToReadable } from './helpers.js';
import { activeUser, blockedUsers, chatBlock, Message } from './state.js';

const GROUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes for grouping messages

/**
 * Loads and renders messages, grouping consecutive messages from the same sender.
 * @param startIndex - Start index in the messages array
 * @param msgs - Messages to render
 * @param baseIndexOverride - Optional override for the base index in the original conversation
 * @returns DocumentFragment containing rendered message nodes
 */
export function loadMessages(
	startIndex: number,
	msgs: Message[],
	baseIndexOverride?: number
): DocumentFragment
{
	const useOverride = typeof baseIndexOverride === 'number';
	const slice = useOverride ? msgs : startIndex >= msgs.length ? msgs : msgs.slice(startIndex);
	const baseIndex = useOverride ? (baseIndexOverride as number) :
        startIndex >= msgs.length ? startIndex : 0;
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
				cur.type === 'invite' &&
				!(cur.sender !== 'me' && blockedUsers.has(cur.sender));
			const timeDiff =
				cur.timestamp.getTime() - first.timestamp.getTime() > GROUP_WINDOW_MS;

			if (senderMismatch || inviteBreak || timeDiff) break;
			group.push(cur);
			j++;
		}

		const time = convertTimestampToReadable(first.timestamp);

		/**
		 * Helper to append text with line breaks as separate nodes.
		 */
		function appendTextWithLineBreaks(parent: HTMLElement, text: string): void
        {
			const parts = text.split('\n');
			parts.forEach((part, idx) => {
				parent.appendChild(document.createTextNode(part));
				if (idx < parts.length - 1) {
					parent.appendChild(document.createElement('br'));
				}
			});
		}

		if (first.type === 'invite' && !(first.sender !== 'me' && blockedUsers.has(first.sender)))
        {
			const state = first.inviteState || 'pending';
			const game = first.game || 'pong';
			const container = document.createElement('div');
			container.className = 'chat-message invite';
			if (first.sender === 'me') {
				container.classList.add('me');
			}
			container.dataset.index = String(globalFirstIdx);
			container.dataset.count = String(group.length);

			const timeSpan = document.createElement('span');
			timeSpan.className = 'chat-time';
			timeSpan.textContent = time;
			container.appendChild(timeSpan);
			container.appendChild(document.createElement('br'));

			const inviteText = document.createElement('span');
			inviteText.className = 'invite-text';
			if (first.sender === 'me') {
				inviteText.textContent = `You invited ${String(
					activeUser || 'player'
				)} to play ${game}.`;
			} else {
				inviteText.textContent = `${first.sender} invited you to play ${game}.`;
			}
			container.appendChild(inviteText);

			if (first.sender === 'me') {
				renderSenderInviteButtons(
					container,
					state,
					game,
					globalFirstIdx
				);
			} else {
				renderReceiverInviteButtons(
					container,
					state,
					game,
					globalFirstIdx
				);
			}

			fragment.appendChild(container);
			i = i + 1;
			continue;
		}

		if (first.sender !== 'me' && blockedUsers.has(first.sender)) {
			renderBlockedMessage(
				fragment,
				group,
				time,
				globalFirstIdx,
				appendTextWithLineBreaks
			);
			i = j;
			continue;
		}

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
			if (idx < group.length - 1)
				container.appendChild(document.createElement('br'));
		});

		fragment.appendChild(container);
		i = j;
	}

	return fragment;
}

/**
 * Renders invite buttons for the message sender.
 */
function renderSenderInviteButtons(
	container: HTMLDivElement,
	state: string,
	game: string,
	globalFirstIdx: number
): void {
	if (state === 'pending')
    {
		const temp = document.querySelector<HTMLTemplateElement>('.invite-cancel-temp');
		const fragment = temp!.content.cloneNode(true) as DocumentFragment;

		const cancelBtn = fragment.querySelector<HTMLButtonElement>('.invite-cancel');
		if (cancelBtn)
			cancelBtn.dataset.index = String(globalFirstIdx);

		container.appendChild(fragment);
	}
    else if (state === 'accepted')
    {
		container.classList.add('accepted');
		const temp = document.querySelector<HTMLTemplateElement>('.invite-go-temp');
		const fragment = temp!.content.cloneNode(true) as DocumentFragment;
		const goBtn = fragment.querySelector<HTMLButtonElement>('.invite-go');
		if (goBtn)
        {
			goBtn.dataset.index = String(globalFirstIdx);
			goBtn.dataset.game = game;
		}
		container.appendChild(fragment);
	}
    else
		container.classList.add(state);
}

/**
 * Renders invite buttons for the message receiver.
 */
function renderReceiverInviteButtons(
	container: HTMLDivElement,
	state: string,
	game: string,
	globalFirstIdx: number
): void
{
	if (state === 'pending')
    {
		const temp = document.querySelector<HTMLTemplateElement>('.invite-pending-temp');
		const fragment = temp!.content.cloneNode(true) as DocumentFragment;

		const acceptBtn = fragment.querySelector<HTMLButtonElement>('.invite-accept');
		if (acceptBtn)
			acceptBtn.dataset.index = String(globalFirstIdx);

		const declineBtn = fragment.querySelector<HTMLButtonElement>('.invite-decline');
		if (declineBtn)
			declineBtn.dataset.index = String(globalFirstIdx);
		container.appendChild(fragment);
	}
    else if (state === 'accepted')
    {
		container.classList.add('accepted');
		const temp = document.querySelector<HTMLTemplateElement>('.invite-go-temp');
		const fragment = temp!.content.cloneNode(true) as DocumentFragment;
		const goBtn = fragment.querySelector<HTMLButtonElement>('.invite-go');
		if (goBtn)
        {
			goBtn.dataset.index = String(globalFirstIdx);
			goBtn.dataset.game = game;
		}
		container.appendChild(fragment);
	}
    else
		container.classList.add(state);
}

/**
 * Renders a blocked message group.
 */
function renderBlockedMessage(
	fragment: DocumentFragment,
	group: Message[],
	time: string,
	globalFirstIdx: number,
	appendTextWithLineBreaks: (parent: HTMLElement, text: string) => void
): void
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

/**
 * Appends a message to the DOM for the active user.
 */
export function appendMessageToDOM(msg: Message, index: number): void
{
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

/**
 * Updates the invite state for a message and re-renders the buttons.
 */
export function updateInviteState(
	container: HTMLElement,
	msg: Message,
	newState: 'accepted' | 'declined' | 'cancelled',
	msgIndex: number
): void
{
	msg.inviteState = newState;

	// Remove old buttons
	const buttonsContainer = container.querySelector('div');
	if (buttonsContainer)
		buttonsContainer.remove();

	// Update classes
	container.classList.remove('pending');
	container.classList.add(newState);

	// If accepted, add the "go" button
	if (newState === 'accepted')
        {
		const goTemp = document.querySelector<HTMLTemplateElement>('.invite-go-temp');
		const fragment = goTemp!.content.cloneNode(true) as DocumentFragment;
		const goBtn = fragment.querySelector<HTMLButtonElement>('.invite-go');
		if (goBtn)
        {
			goBtn.dataset.index = String(msgIndex);
			goBtn.dataset.game = msg.game || 'pong';
		}
		container.appendChild(fragment);
	}
}
