-- Table: countries
-- Stores list of countries for user profile selection.
CREATE TABLE countries (
    country_id INTEGER PRIMARY KEY AUTOINCREMENT,             -- Unique identifier
    country_code TEXT UNIQUE NOT NULL CHECK(length(country_code) BETWEEN 2 AND 6), -- ISO 3166-1 alpha-2 code (e.g., 'US', 'FR') + alpha-3 code for custom use
    country_name TEXT UNIQUE NOT NULL CHECK(length(country_name) <= 100), -- Full country name
    flag_svg_path TEXT CHECK(length(flag_svg_path) <= 255)   -- Path to SVG flag file (e.g., '/flags/us.svg')
);

-- Table: user_roles
-- Stores all possible user roles and account states.
CREATE TABLE user_roles (
    role_id INTEGER PRIMARY KEY AUTOINCREMENT,                -- Unique identifier
    role_name TEXT UNIQUE NOT NULL CHECK(length(role_name) <= 20)  -- Role or status name, max 20 chars
);

-- Table: users
-- Stores main account information and links to role.
CREATE TABLE users (
    user_id TEXT PRIMARY KEY,									-- uuid v7 unique identifier
    email TEXT UNIQUE NOT NULL CHECK(
        length(email) <= 255 AND 
        email LIKE '%@%.%' AND 
        email NOT LIKE '%@%@%'
    ),                                                         -- User email with basic validation
    password_hash TEXT NOT NULL CHECK(length(password_hash) <= 255), -- Hashed password
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,            -- Account creation timestamp
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,            -- Last account update
    last_login DATETIME,                                      -- Last login timestamp
    role_id INTEGER NOT NULL REFERENCES user_roles(role_id)   -- Role/status reference
);

-- Table: user_profiles
-- Stores additional optional profile information for each user.
CREATE TABLE user_profiles (
    profile_id INTEGER PRIMARY KEY AUTOINCREMENT,             -- Unique identifier
    user_id TEXT NOT NULL UNIQUE REFERENCES users(user_id) 
        ON DELETE CASCADE,                                    -- Link to users (one profile per user)
    username TEXT UNIQUE NOT NULL CHECK(
        length(username) >= 3 AND 
        length(username) <= 20 AND
        username NOT LIKE '% %' AND
        username NOT LIKE '%@%'
    ),                                                         -- Username validation (3-20 chars, no spaces/emails)
    display_name TEXT CHECK(length(display_name) <= 50),     -- Optional display name, max 50 chars
    profile_picture TEXT CHECK(length(profile_picture) <= 255), -- Path or URL, max 255 chars
    country_id INTEGER REFERENCES countries(country_id),     -- Country reference
    bio TEXT CHECK(length(bio) <= 500)                       -- Short biography, max 500 chars
);

-- Table: user_preferences
-- Stores serialized preferences (e.g., JSON) for customization.
CREATE TABLE user_preferences (
    preference_id INTEGER PRIMARY KEY AUTOINCREMENT,          -- Unique identifier
    user_id TEXT NOT NULL REFERENCES users(user_id) 
        ON DELETE CASCADE,                                    -- Link to users
    preferences TEXT                                         -- User preferences (JSON/text format)
);

-- Table: user_stats
-- Stores aggregated statistics for gameplay and ranking.
CREATE TABLE user_stats (
    stat_id INTEGER PRIMARY KEY AUTOINCREMENT,                -- Unique identifier
    user_id TEXT NOT NULL UNIQUE REFERENCES users(user_id) 
        ON DELETE CASCADE,                                    -- Link to users
    elo_rating INTEGER DEFAULT 1000,                          -- Elo ranking score
	games_played INTEGER DEFAULT 0,                           -- Total games played
	games_won INTEGER DEFAULT 0,                              -- Total games won
	games_lost INTEGER DEFAULT 0,                             -- Total games lost
    level INTEGER DEFAULT 1,                                  -- Player level
    rank INTEGER DEFAULT 0,                                   -- Global or local ranking
    total_play_time INTEGER DEFAULT 0                         -- Total playtime in seconds
);

-- Table: games
-- Stores metadata about each game played.
CREATE TABLE games (
    game_id INTEGER PRIMARY KEY AUTOINCREMENT,                -- Unique identifier
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,            -- When the game was created
    duration INTEGER CHECK(duration >= 0),                   -- Game duration in seconds (non-negative)
    mode TEXT CHECK(mode IN ('local','online','tournament')), -- Game mode
    status TEXT CHECK(status IN ('completed','ongoing','abandoned','waiting')) 
        DEFAULT 'waiting',                                    -- Current game status
    score_limit INTEGER DEFAULT 11 CHECK(score_limit > 0),   -- Score needed to win (positive)
    winner_id TEXT REFERENCES users(user_id),             -- Winner of the game (if completed)
    max_players INTEGER DEFAULT 2 CHECK(max_players >= 1 AND max_players <= 4) -- Maximum players allowed
);

-- Table: game_participants
-- Stores participants of each game, their team, and result.
CREATE TABLE game_participants (
    participant_id INTEGER PRIMARY KEY AUTOINCREMENT,         -- Unique identifier
    game_id INTEGER NOT NULL REFERENCES games(game_id) 
        ON DELETE CASCADE,                                    -- Link to games
    user_id TEXT NOT NULL REFERENCES users(user_id) 
        ON DELETE CASCADE,                                    -- Link to users
    team INTEGER CHECK(team >= 1 AND team <= 2),             -- Team number (1 or 2)
    score INTEGER DEFAULT 0 CHECK(score >= 0),               -- Final score for the player (non-negative)
    result TEXT CHECK(result IN ('win','loss','draw')),      -- Match result (added draw option)
    UNIQUE(game_id, user_id)                                 -- Prevent duplicate participants
);

-- Insert default roles and statuses
INSERT INTO user_roles (role_name) 
VALUES ('user'), ('moderator'), ('admin'), ('banned'), ('unverified');

-- Performance Indexes
-- Create indexes on frequently queried columns for better performance

-- Users table indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_last_login ON users(last_login);

-- User profiles indexes
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_username ON user_profiles(username);
CREATE INDEX idx_user_profiles_country_id ON user_profiles(country_id);

-- User preferences indexes
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

-- User stats indexes
CREATE INDEX idx_user_stats_user_id ON user_stats(user_id);
CREATE INDEX idx_user_stats_elo_rating ON user_stats(elo_rating);
CREATE INDEX idx_user_stats_level ON user_stats(level);

-- Games indexes
CREATE INDEX idx_games_created_at ON games(created_at);
CREATE INDEX idx_games_mode ON games(mode);
CREATE INDEX idx_games_status ON games(status);

-- Game participants indexes
CREATE INDEX idx_game_participants_game_id ON game_participants(game_id);
CREATE INDEX idx_game_participants_user_id ON game_participants(user_id);
CREATE INDEX idx_game_participants_result ON game_participants(result);

-- Countries indexes
CREATE INDEX idx_countries_country_code ON countries(country_code);

-- Triggers for automatic updated_at timestamp updates

-- Update users.updated_at when user record is modified
CREATE TRIGGER update_users_updated_at 
    AFTER UPDATE ON users
    FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE user_id = NEW.user_id;
END;

-- Update user_profiles.updated_at when profile is modified
CREATE TRIGGER update_user_profiles_updated_at 
    AFTER UPDATE ON user_profiles
    FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE user_id = NEW.user_id;
END;
