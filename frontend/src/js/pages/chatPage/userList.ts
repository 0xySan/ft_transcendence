// User list rendering and ordering helpers
import { getLastTimestamp } from './helpers.js';
import { loadMessages } from './chatMessages.js';
import { updateChatHeader } from './chatRenderer.js';
import {
	activeUser,
	setActiveUser,
	activeUsers,
	blockedUsers,
	conversations,
	profilepics,
	scrollPositions,
	users,
	visibleStart,
	MESSAGES_PAGE,
    chatBlock,
    userListDiv 
} from './state.js';

export function renderUserList(onSelectUser: () => void): void {
	const sortedUsers = Object.keys(conversations).sort((a, b) => getLastTimestamp(b) - getLastTimestamp(a));

	sortedUsers.forEach((name) => {
		const temp = document.querySelector<HTMLTemplateElement>('.user-item-temp');
		if (!temp) return;

		const clon = temp.content.cloneNode(true) as DocumentFragment;
		const divElement = clon.querySelector<HTMLDivElement>('.user-item');
		if (!divElement) return;

		divElement.dataset.username = name;

		const imgElement = clon.querySelector<HTMLImageElement>('.img_profile');
		if (imgElement)
		{
			const userIdx = users.indexOf(name);
			imgElement.src = userIdx === -1 ? profilepics[0] : profilepics[userIdx % profilepics.length];
		}
		const pElement = clon.querySelector<HTMLParagraphElement>('.name_profile');
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
					}
					else if (scrollPositions[name] !== undefined) {
						requestAnimationFrame(() => {
							item.scrollTop = scrollPositions[name];
						});
					}
                    updateChatHeader(name);
				}
			}
			else {
				onSelectUser();
			}
		});

		userListDiv.appendChild(divElement);
	});
}

export function reorderUserList(movedUser: string): void {
	const selector = `.user-item[data-username="${CSS.escape(movedUser)}"]`;
	const item = userListDiv.querySelector<HTMLDivElement>(selector);
	if (!item) return;

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
	if (!inserted)
		userListDiv.appendChild(item);
}
