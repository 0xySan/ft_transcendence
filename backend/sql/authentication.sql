-- Table: user_2fa_methods
-- Store different methods of 2fa
CREATE TABLE user_2fa_methods (
	method_id				INTEGER		PRIMARY KEY AUTOINCREMENT,							--- Unique identifier
	user_id					INTEGER,														--- ID of the user (FK)
	method_type				INTEGER		NOT NULL DEFAULT 0,									--- Store the method
	label					TEXT,															--- 2fa method name
	is_primary				INTEGER		DEFAULT 0,											--- store the prymary
	is_verified				BOOLEAN		DEFAULT 0,											--- is verified ?
	created_at				DATETIME	DEFAULT CURRENT_TIMESTAMP,							--- timestamp of the created method
	updated_at				DATETIME	DEFAULT CURRENT_TIMESTAMP,							--- timestamp of the updated method
	FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE						--- users.user_id
);

-- Table: user_2fa_email_otp
-- Store the email otp
CREATE TABLE user_2fa_email_otp (
	email_otp_id			INTEGER		PRIMARY KEY AUTOINCREMENT,								--- Unique identifier
	method_id				INTEGER,															--- method id (FK)
	last_sent_code_hash		TEXT		NOT NULL,												--- the last code in hash
	last_sent_at			DATETIME,															--- timestamp of the last sent email otp
	attempts				INTEGER		DEFAULT 0,												--- store the number of attempts
	consumed				INTEGER		DEFAULT 0,												--- store the number of consumed
	expires_at				DATETIME	NOT NULL,												--- timestamp of the expired eamil otp
	FOREIGN KEY(method_id) REFERENCES user_2fa_methods(method_id) ON DELETE CASCADE				--- user_2fa_methods.method_id
);

-- Table: user_2fa_totp
-- Store the different information of the 2fa application
CREATE TABLE user_2fa_totp (
	totp_id					INTEGER		PRIMARY KEY AUTOINCREMENT,								--- Unique identifier
	method_id				INTEGER,															--- method id (FK)
	secret_encrypted		BLOB		NOT NULL,												--- secret to use to decrypt one time code
	secret_meta				TEXT,																--- configuration of codes
	last_used				DATETIME,															--- timestamp of the last used 2fa totp
	FOREIGN KEY(method_id) REFERENCES user_2fa_methods(method_id) ON DELETE CASCADE				--- user_2fa_methods.method_id
);

-- Table: user_2fa_backup_codes
-- Store the backup codes
CREATE TABLE user_2fa_backup_codes (
	backup_code_id			INTEGER		PRIMARY KEY AUTOINCREMENT,								-- Unique identifier
	method_id				INTEGER,															-- method id (FK)
	code_json				TEXT		NOT NULL ,												-- Store the json codes
	created_at				DATETIME	NOT NULL,												-- timestamp of the created backup code
	FOREIGN KEY(method_id) REFERENCES user_2fa_methods(method_id) ON DELETE CASCADE				-- user_2fa_methods.method_id
);

-- Table: oauth_providers
-- Is the base of the oauth provider
CREATE TABLE oauth_providers (
	provider_id				INTEGER		PRIMARY KEY AUTOINCREMENT,								-- Unique identifier
	name					TEXT		UNIQUE NOT NULL,										-- name of oauth provider
	discovery_url			TEXT,																-- store the discovery url
	client_id				TEXT,																-- ID of the client
	client_secret_encrypted	BLOB,																-- secret encrypted oauth
	is_enabled				BOOLEAN		DEFAULT 1,												-- is enabled ?
	created_at				DATETIME															-- timestamp of the created oauth provider
);

-- Table: oauth_accounts
-- Store the relation between a user and a Oauth provider
CREATE TABLE oauth_accounts (
	oauth_account_id		INTEGER		PRIMARY KEY AUTOINCREMENT,								-- Unique identifier
	user_id					INTEGER		NOT NULL,												-- ID on the user (FK)
	provider_name			TEXT,																-- stock the name (FK)
	provider_user_id		TEXT		NOT NULL,												-- stock the user id
	profile_json			TEXT,																-- the profile user on the Oauth server
	id_token_hash			TEXT,																-- encrypted hashed token
	linked_at				DATETIME,															-- timestamp of the linked oauth account
	revoked_at				DATETIME,															-- timestamp of the revoked oauth account
	FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE,							-- users.user_id
	FOREIGN KEY(provider_name) REFERENCES oauth_providers(name) ON DELETE CASCADE				-- oauth_providers.name 
);

-- Table: oauth_tokens
-- Store the different oauth information tokens
CREATE TABLE oauth_tokens (
	oauth_token_id			INTEGER		PRIMARY KEY AUTOINCREMENT,								-- Unique identifier
	oauth_account_id		INTEGER,															-- ID on Oauth provider server (FK)
	access_token_hash		TEXT		NOT NULL,												-- Store the access hashed token
	refresh_token_hash		TEXT,																-- Store the refresh hashed token
	scopes					TEXT,																-- the different access of the oauth
	token_type				TEXT,																-- Store the type of the token
	issued_at				DATETIME,															-- timestamp of the issued oauth token
	expires_at				DATETIME,															-- timestamp of the expired oauth token
	revoked					BOOLEAN		DEFAULT 0,												-- is revoked ?
	FOREIGN KEY(oauth_account_id) REFERENCES oauth_accounts(oauth_account_id) ON DELETE CASCADE	-- oauth_account.oauth_account_id
);

-- Table: api_clients
/*It represent an aplication associated with an user that can deliver
tokens to interact with the api in limited an define scope.*/
CREATE TABLE api_clients (
	app_id					INTEGER		PRIMARY KEY AUTOINCREMENT,								--- Unique identifier
	owner_id				INTEGER,															--- ID of the owner (FK)
	name					TEXT		DEFAULT "unamed",										--- name of the api
	client_secret_encrypted	BLOB		NOT NULL,												--- encrypted secret
	redirect_url			TEXT,																--- redirect url
	scopes					TEXT,																--- the authorized accesses of the app
	is_confidential			BOOLEAN		DEFAULT 1,												--- is public ?
	created_at				DATETIME	NOT NULL,												--- timestamp of creation
	updated_at				DATETIME,															--- timestamp of update
	secret_expiration		DATETIME	NOT NULL,												--- timestamp of secret
	FOREIGN KEY(owner_id) REFERENCES users(user_id) ON DELETE CASCADE							--- users.user_id
);

-- Table: api_tokens
-- Store an api auth token to access the api for limited time -> `Authorization: Bearer $token` 
CREATE TABLE api_tokens (
	token_id				INTEGER		PRIMARY KEY AUTOINCREMENT,								--- Unique identifier
	app_id					INTEGER,															--- ID of the app (FK)
	token_hash				TEXT		UNIQUE NOT NULL,										--- the hashed token
	scopes					TEXT,																--- the authorized accesses of the app
	issued_at				DATETIME	NOT NULL,												--- timestamp of the token creation
	expires_at				DATETIME	NOT NULL,												--- timestamp of the token expired
	last_used_at			DATETIME	NOT NULL,												--- timestamp of the last update
	revoked					BOOLEAN		DEFAULT 0,												--- is revoked ?
	FOREIGN KEY(app_id) REFERENCES api_clients(app_id) ON DELETE CASCADE						--- api_clients.app_id
);

-- Table: password_resets
-- Store the password token for the forgotten password
CREATE TABLE password_resets (
	reset_id				INTEGER		PRIMARY KEY AUTOINCREMENT,								--- Unique identifier
	user_id					INTEGER		NOT NULL,												--- ID of the user (FK)
	token_hash				TEXT		NOT NULL,												--- the hashed token
	created_at				DATETIME	NOT NULL,												--- timestamp of the created reset
	expired_at				DATETIME	NOT NULL,												--- timestamp of the expired reset
	consumed_at				DATETIME,															--- timestamp of the consumed reset
	consumed				BOOLEAN		DEFAULT 0,												--- is consumed ?
	FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE							--- users.user_id
);

-- Table: sessions
-- Store informations about sessions
CREATE TABLE sessions (
	session_id				INTEGER		PRIMARY KEY AUTOINCREMENT,								--- Unique identifier
	user_id					INTEGER		NOT NULL,															--- ID of the user (FK)
	session_token_hash		TEXT		NOT NULL,												--- the hashed session token
	created_at				DATETIME	NOT NULL,												--- timestamp of created session
	expires_at				DATETIME	NOT NULL,												--- timestamp of expired session
	last_used_at			DATETIME	NOT NULL,												--- timestamp of the last used session
	ip						TEXT		NOT NULL,												--- the device public ip
	user_agent				TEXT,																--- store more informations
	is_persistent			BOOLEAN		DEFAULT 0,												--- is persistent ?
	FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE							--- users.user_id
);


-- api_clients
CREATE INDEX idx_api_clients_owner_id ON api_clients(owner_id);

-- api_tokens
CREATE INDEX idx_api_tokens_app_id ON api_tokens(app_id);
CREATE INDEX idx_api_tokens_expires_at ON api_tokens(expires_at);
CREATE INDEX idx_api_tokens_token_hash ON api_tokens(token_hash);

-- password_resets
CREATE INDEX idx_password_resets_user_id ON password_resets(user_id);
CREATE INDEX idx_password_resets_token_hash ON password_resets(token_hash);
CREATE INDEX idx_password_resets_expired_at ON password_resets(expired_at);

-- sessions
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- user_2fa_methods
CREATE INDEX idx_user_2fa_methods_user_id ON user_2fa_methods(user_id);
CREATE INDEX idx_user_2fa_methods_is_primary ON user_2fa_methods(user_id, is_primary);

-- user_2fa_email_otp
CREATE INDEX idx_2fa_email_otp_method_id ON user_2fa_email_otp(method_id);

-- user_2fa_totp
CREATE INDEX idx_2fa_totp_method_id ON user_2fa_totp(method_id);

-- user_2fa_backup_codes
CREATE INDEX idx_2fa_backup_codes_method_id ON user_2fa_backup_codes(method_id);

-- oauth_tokens
CREATE INDEX idx_oauth_tokens_oauth_account_id ON oauth_tokens(oauth_account_id);
CREATE INDEX idx_oauth_tokens_access_token_hash ON oauth_tokens(access_token_hash);
CREATE INDEX idx_oauth_tokens_expires_at ON oauth_tokens(expires_at);

-- oauth_providers
CREATE INDEX idx_oauth_providers_is_enabled ON oauth_providers(is_enabled);

-- oauth_accounts
CREATE INDEX idx_oauth_accounts_user_id ON oauth_accounts(user_id);
CREATE INDEX idx_oauth_accounts_provider_name ON oauth_accounts(provider_name);
CREATE INDEX idx_oauth_accounts_provider_user_id ON oauth_accounts(provider_user_id);


CREATE TRIGGER trg_update_api_clients_updated_at
AFTER UPDATE ON api_clients
FOR EACH ROW
BEGIN
  UPDATE api_clients SET updated_at = CURRENT_TIMESTAMP WHERE app_id = OLD.app_id;
END;


CREATE TRIGGER trg_update_token_last_used
BEFORE UPDATE ON api_tokens
FOR EACH ROW
WHEN NEW.token_hash = OLD.token_hash
BEGIN
  UPDATE api_tokens
  SET last_used_at = CURRENT_TIMESTAMP
  WHERE token_id = OLD.token_id;
END;
