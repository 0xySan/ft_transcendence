// Actions that mutate conversations and append messages
import { appendMessageToDOM } from './chatMessages.js';
import { reorderUserList } from './userList.js';
import {
	activeUser,
	blockedUsers,
	clearDraft,
	conversations,
	visibleStart,
	MESSAGES_PAGE,
	Message,
} from './state.js';

/**
 * Submits a new chat message for the active user.
 * @param input - The chat input div
 * @param sendBtn - The send button
 * @param messagesDiv - The messages container div
 */
export function submitMessage(
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
	};

	if (!conversations[activeUser]) conversations[activeUser] = [];
	conversations[activeUser].push(newMsg);
	const msgIndex = conversations[activeUser].length - 1;

	const len = conversations[activeUser].length;
	if (!visibleStart[activeUser])
		visibleStart[activeUser] = Math.max(0, len - MESSAGES_PAGE);
	else if (visibleStart[activeUser] >= len - 1 - MESSAGES_PAGE || (messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight) < 100)
		visibleStart[activeUser] = Math.max(0, len - MESSAGES_PAGE);

	input.textContent = '';
	clearDraft(activeUser);
	input.classList.add('empty');
	sendBtn.hidden = true;
	appendMessageToDOM(newMsg, msgIndex);
	reorderUserList(activeUser);
}

/**
 * Sends a game invite to a user.
 * @param user - The username to invite
 * @param game - The game to invite to ('pong' or 'tetris')
 */
export function sendInvite(user: string, game: 'pong' | 'tetris' = 'pong'): void {
	if (!user) return;
	if (game !== 'pong' && game !== 'tetris') {
		console.warn(`sendInvite: invalid game "${String(game)}" provided, defaulting to "pong"`);
		game = 'pong';
	}
	if (blockedUsers.has(user)) return;
	if (!conversations[user]) conversations[user] = [];

	const inviteMsg: Message = {
		sender: 'me',
		text: `invited ${user} to a ${game === 'pong' ? 'Pong' : 'Tetris'} game`,
		timestamp: new Date(),
		type: 'invite',
		inviteState: 'pending',
		game,
	};

	conversations[user].push(inviteMsg);
	const msgIndex = conversations[user].length - 1;

	reorderUserList(user);
	appendMessageToDOM(inviteMsg, msgIndex);
}
