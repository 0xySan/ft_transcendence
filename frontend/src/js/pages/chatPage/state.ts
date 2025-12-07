// Shared chat state and types

// Message type for chat messages
export interface Message {
	sender: string;
	text: string;
	timestamp: Date;
	hidden?: boolean;
	type?: 'text' | 'invite' | 'system';
	inviteState?: 'pending' | 'accepted' | 'declined' | 'cancelled';
	game?: 'pong' | 'tetris';
}

// Conversation type: mapping username to array of messages
export interface Conversation {
	[username: string]: Message[];
}

// DOM elements
export const userListDiv = document.querySelector<HTMLDivElement>('.user-list')!;
export const chatBlock = document.querySelector<HTMLDivElement>('.chat-block')!;
export const headerToggleBtn = document.querySelector<HTMLButtonElement>('.chat-header-toggle-users')!;

// Constants
export const MESSAGES_PAGE = 100;
export const NAVIGATION_DELAY = 150;
export const KEYBOARD_ADJUST_DELAY = 50;
export const SCROLL_THRESHOLD = 100;
export const LOAD_MORE_THRESHOLD = 20;
export const TIMEOUT_DELAY = 50;

// Chat state
export const conversations: Conversation = {};
export let activeUser: string | null = null;
export function setActiveUser(user: string | null): void {
	activeUser = user;
}
export const blockedUsers: Set<string> = new Set();
export const activeUsers: Set<string> = new Set();
export const visibleStart: Record<string, number> = {};
export const scrollPositions: Record<string, number> = {};
export const loadingOlderMessages: Record<string, boolean> = {};

// Drafts (persisted in sessionStorage)
const DRAFTS_KEY = 'chat_drafts';
export const drafts: Record<string, string> = (() => {
	try {
		return JSON.parse(sessionStorage.getItem(DRAFTS_KEY) || '{}');
	} catch (e) {
		return {};
	}
})();

export function saveDraft(user: string | null, text: string): void {
	if (!user) return;
	drafts[user] = text;
	try {
		sessionStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
	} catch (e) {
		// ignore
	}
}

export function clearDraft(user: string | null): void {
	if (!user) return;
	delete drafts[user];
	try {
		sessionStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
	} catch (e) {
		// ignore
	}
}

// User and profile picture lists
export const users: string[] = [];
export const profilepics: string[] = [];
