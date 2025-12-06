// Layout and responsive helpers for the chat page
import { headerToggleBtn, userListDiv, KEYBOARD_ADJUST_DELAY } from './state.js';

let userListHidden = false;

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

export function initLayout(): void {
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
		if (userListHidden)
			userListDiv.classList.add('hidden');
		else
			userListDiv.classList.remove('hidden');
		updateToggleBtnText();
	});
}

export function isUserListHidden(): boolean {
	return userListHidden;
}

export function setUserListHidden(hidden: boolean): void {
	userListHidden = hidden;
	updateToggleBtnText();
	if (hidden)
		userListDiv.classList.add('hidden');
	else
		userListDiv.classList.remove('hidden');
}
