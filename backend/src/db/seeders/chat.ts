import Database from "better-sqlite3";

interface SeedableUser {
	user_id: string;
	handle: string;
}

const TOURNAMENT_USER_ID = "tournament-system";
const TOURNAMENT_EMAIL = "tournament@system.local";
const TOURNAMENT_USERNAME = "Tournament";
const TOURNAMENT_DISPLAY = "Tournament system";
const DEFAULT_AVATAR = "tournament.jpg";

function ensureTournamentSystemUser(db: Database.Database): string {
	const defaultRoleId =
		(db.prepare("SELECT role_id FROM user_roles WHERE role_name = 'user' LIMIT 1").get() as { role_id?: number } | undefined)
			?.role_id ?? 1;

	db.prepare(
		`INSERT OR IGNORE INTO users (user_id, email, password_hash, role_id)
		 VALUES (?, ?, ?, ?)`
	).run(TOURNAMENT_USER_ID, TOURNAMENT_EMAIL, "tournament-system-placeholder", defaultRoleId);

	db.prepare(
		`INSERT OR IGNORE INTO user_profiles (user_id, username, display_name, profile_picture)
		 VALUES (?, ?, ?, ?)`
	).run(TOURNAMENT_USER_ID, TOURNAMENT_USERNAME, TOURNAMENT_DISPLAY, DEFAULT_AVATAR);

	db.prepare(`INSERT OR IGNORE INTO user_stats (user_id) VALUES (?)`).run(TOURNAMENT_USER_ID);
	return TOURNAMENT_USER_ID;
}

function selectSeedableUsers(db: Database.Database): SeedableUser[] {
	return db
		.prepare(
			`
			SELECT u.user_id, COALESCE(p.username, u.email) AS handle
			FROM users u
			LEFT JOIN user_profiles p ON p.user_id = u.user_id
			ORDER BY u.created_at
			LIMIT 10
		`
		)
		.all() as SeedableUser[];
}

/**
 * Seed demo chat data (including Tournament bot) when no conversations exist.
 */
export function seedChatDemoData(db: Database.Database): void {
	const { count } = db.prepare("SELECT COUNT(*) as count FROM chat_conversations").get() as { count: number };
	if (count > 0) {
		console.log("Chat conversations already exist; skipping chat seeder.");
		return;
	}

	const tournamentUserId = ensureTournamentSystemUser(db);
	const users = selectSeedableUsers(db);
	const realUsers = users.filter(u => u.user_id !== tournamentUserId);

	const insertConversation = db.prepare(
		`INSERT INTO chat_conversations (conversation_type, title, created_by) VALUES (?, ?, ?)`
	);
	const insertDirectConversation = db.prepare(
		`INSERT INTO chat_direct_conversations (conversation_id, user_a, user_b) VALUES (?, ?, ?)`
	);
	const insertMember = db.prepare(
		`INSERT INTO chat_conversation_members (conversation_id, user_id, role, status) VALUES (?, ?, ?, ?)`
	);
	const insertMessage = db.prepare(
		`INSERT INTO chat_messages (conversation_id, sender_id, content, message_type, invite_state) VALUES (?, ?, ?, ?, ?)`
	);
	const insertBlock = db.prepare(
		`INSERT OR IGNORE INTO chat_user_blocks (blocker_id, blocked_id) VALUES (?, ?)`
	);

	const tx = db.transaction(() => {
		// No real users: create only the Tournament announcements channel
		if (realUsers.length === 0) {
			const announcements = insertConversation.run("group", "Tournament announcements", tournamentUserId);
			const announcementsId = Number(announcements.lastInsertRowid);
			insertMember.run(announcementsId, tournamentUserId, "admin", "active");
			insertMessage.run(
				announcementsId,
				tournamentUserId,
				"Welcome! I'll share tournament updates here as they come.",
				"system",
				null
			);
			return;
		}

		// DM: Tournament bot -> first user
		const primaryUser = realUsers[0];
		const [botA, botB] = [tournamentUserId, primaryUser.user_id].sort();
		const botDm = insertConversation.run("direct", null, tournamentUserId);
		const botDmId = Number(botDm.lastInsertRowid);
		insertDirectConversation.run(botDmId, botA, botB);
		insertMember.run(botDmId, tournamentUserId, "admin", "active");
		insertMember.run(botDmId, primaryUser.user_id, "member", "active");
		insertMessage.run(
			botDmId,
			tournamentUserId,
			`Hi ${primaryUser.handle}! I'll post tournament updates here. Good luck in your next match!`,
			"system",
			null
		);

		// Demo DM between two real users (keep previous behavior)
		if (realUsers.length >= 2) {
			const [first, second] = realUsers;
			const [userA, userB] = [first.user_id, second.user_id].sort();
			const dm = insertConversation.run("direct", null, first.user_id);
			const dmId = Number(dm.lastInsertRowid);
			insertDirectConversation.run(dmId, userA, userB);
			insertMember.run(dmId, first.user_id, "admin", "active");
			insertMember.run(dmId, second.user_id, "member", "active");
			insertMessage.run(dmId, first.user_id, `Hey ${second.handle}, welcome to the chat demo!`, "text", null);
			insertMessage.run(dmId, second.user_id, `Thanks ${first.handle}! Ping me if you want to play.`, "text", null);
			insertMessage.run(dmId, first.user_id, "Wanna play Pong?", "invite", "pending");
		}

		// Lobby group if we have a third real user
		if (realUsers.length >= 3) {
			const [first, second, third] = realUsers;
			const groupConversation = insertConversation.run("group", "Lobby", third.user_id);
			const groupId = Number(groupConversation.lastInsertRowid);
			insertMember.run(groupId, third.user_id, "admin", "active");
			insertMember.run(groupId, tournamentUserId, "admin", "active");
			insertMember.run(groupId, first.user_id, "member", "active");
			insertMember.run(groupId, second.user_id, "member", "active");
			insertMessage.run(groupId, third.user_id, "Welcome to the lobby. Drop a message to say hi.", "system", null);
			insertMessage.run(groupId, second.user_id, "Hi everyone!", "text", null);
			insertMessage.run(groupId, first.user_id, "Ready for a quick match later today?", "text", null);
			insertBlock.run(first.user_id, third.user_id);
		}

		// Announcements group (bot + all real users)
		const announcements = insertConversation.run("group", "Tournament announcements", tournamentUserId);
		const announcementsId = Number(announcements.lastInsertRowid);
		insertMember.run(announcementsId, tournamentUserId, "admin", "active");
		for (const user of realUsers) {
			insertMember.run(announcementsId, user.user_id, "member", "active");
		}
		insertMessage.run(
			announcementsId,
			tournamentUserId,
			"Next game starts soon! Watch the lobby for invites and good luck.",
			"system",
			null
		);
	});

	tx();
	console.log("Seeded demo chat conversations and messages (with Tournament system).");
}
