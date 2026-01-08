-- Conversations can be direct (DM) or group. Title is used for group chats.
CREATE TABLE IF NOT EXISTS chat_conversations (
	conversation_id INTEGER PRIMARY KEY AUTOINCREMENT,
	conversation_type TEXT NOT NULL DEFAULT 'direct'
		CHECK(conversation_type IN ('direct','group')),
	title TEXT CHECK(length(title) <= 100),
	created_by TEXT,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Membership of users inside a conversation. Keeps read state and mute flag.
CREATE TABLE IF NOT EXISTS chat_conversation_members (
	conversation_id INTEGER NOT NULL,
	user_id TEXT NOT NULL,
	last_read_message_id INTEGER,
	last_read_at DATETIME,
	joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (conversation_id, user_id),
	FOREIGN KEY (conversation_id) REFERENCES chat_conversations(conversation_id) ON DELETE CASCADE,
	FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
	FOREIGN KEY (last_read_message_id) REFERENCES chat_messages(message_id) ON DELETE SET NULL
);

-- Messages sent inside conversations. Soft-delete and edit tracking included.
CREATE TABLE IF NOT EXISTS chat_messages (
	message_id INTEGER PRIMARY KEY AUTOINCREMENT,
	conversation_id INTEGER NOT NULL,
	sender_id TEXT NOT NULL,
	content TEXT NOT NULL CHECK(length(content) <= 4000),
	message_type TEXT NOT NULL DEFAULT 'text' CHECK(message_type IN ('text','invite','system')),
	invite_state TEXT CHECK(invite_state IN ('pending','accepted','declined','cancelled')),
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	edited_at DATETIME,
	deleted BOOLEAN NOT NULL DEFAULT 0,
	FOREIGN KEY (conversation_id) REFERENCES chat_conversations(conversation_id) ON DELETE CASCADE,
	FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Direct (1:1) conversations are unique regardless of user order.
CREATE TABLE IF NOT EXISTS chat_direct_conversations (
	conversation_id INTEGER PRIMARY KEY,
	user_a TEXT NOT NULL,
	user_b TEXT NOT NULL,
	FOREIGN KEY (conversation_id) REFERENCES chat_conversations(conversation_id) ON DELETE CASCADE,
	FOREIGN KEY (user_a) REFERENCES users(user_id) ON DELETE CASCADE,
	FOREIGN KEY (user_b) REFERENCES users(user_id) ON DELETE CASCADE,
	UNIQUE (user_a, user_b)
);

-- Users can block other users; blocked messages can be hidden client-side.
CREATE TABLE IF NOT EXISTS chat_user_blocks (
	blocker_id TEXT NOT NULL,
	blocked_id TEXT NOT NULL,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (blocker_id, blocked_id),
	FOREIGN KEY (blocker_id) REFERENCES users(user_id) ON DELETE CASCADE,
	FOREIGN KEY (blocked_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Indexes tuned for common access patterns (recent messages, unread counts).
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created
ON chat_messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_sender
ON chat_messages(sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_members_user
ON chat_conversation_members(user_id);

CREATE INDEX IF NOT EXISTS idx_chat_members_conversation
ON chat_conversation_members(conversation_id);