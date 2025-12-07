// chatPage/helpers.ts

import { conversations, profilepics, users } from './state.js';
// ------------------------------------- 
// Convert messages timestamp to readable format

export function convertTimestampToReadable(ts: Date): string
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

export function getLastTimestamp(name: string): number
{
	const msgs = conversations[name] || [];
	if (msgs.length === 0) return 0;
	return Math.max(...msgs.map((m) => m.timestamp.getTime()));
}

export function seedDummyData(): void {
	Object.keys(conversations).forEach((key) => delete conversations[key]);
	users.length = 0;
	profilepics.length = 0;

	for (let i = 0; i < 6; i++)
		users.push(`user${i}`);

	for (let i = 0; i < 6; i++)
		profilepics.push(`https://cdn.discordapp.com/embed/avatars/${Math.floor(Math.random() * 10) % 5}.png`);

	users.forEach((name, i) => {
		const base = Date.now() - (i + 1) * 6000000;
		const list = [] as typeof conversations[string];
		const count = Math.floor(Math.random() * 1000);
		for (let j = 0; j < count; j++) {
			const random = Math.floor(Math.random() * 3);
			list.push({
				sender: (random === 0) ? name : 'me',
				text: `msg ${j} from ${(random === 0) ? name : 'me'}`,
				timestamp: new Date(base + j),
			});
		}
		if (list.length === 0) {
			list.push({ sender: name, text: 'Hey! This is a placeholder message.', timestamp: new Date(base) });
			list.push({ sender: 'me', text: 'Nice, just testing the chat UI!', timestamp: new Date(base + 1) });
		}
		conversations[name] = list;
	});

	conversations['user4'] = [
		{ sender: 'user4', type: 'invite', inviteState: 'pending', game: 'tetris', text: 'Wanna play Tetris?', timestamp: new Date(Date.now() + 1) },
		{ sender: 'user4', type: 'invite', inviteState: 'pending', game: 'pong', text: 'Wanna play Pong?', timestamp: new Date(Date.now() + 2) },
		{ sender: 'user4', text: 'This is a longer message to test how the chat UI handles wrapping and multiple lines. Let\'s see how it looks when the message exceeds the typical length of a chat bubble. Hopefully, it wraps nicely and remains readable!', timestamp: new Date(Date.now() + 3) },
		{ sender: 'me', text: 'Indeed, it seems to be working well!\nNew line test.', timestamp: new Date(Date.now() + 4) },
	];

	conversations['user2'] = [];

	conversations['Dummy'] = [
		{ sender: 'Dummy', text: 'Hi there!', timestamp: new Date(Date.now() + 5) },
		{ sender: 'me', text: 'Hello Dummy, how are you?', timestamp: new Date(Date.now() + 6) },
		{ sender: 'me', type: 'invite', inviteState: 'accepted', game: 'pong', text: 'Wanna play Pong?', timestamp: new Date(Date.now() + 7) },
	];

	users.push('Dummy');
	profilepics.push('https://i.ibb.co/VcQ5RQwX/dummy.png');
}
