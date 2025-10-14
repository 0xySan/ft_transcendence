-- Table: api_clients
/*It represent an aplication associated with an user that can deliveR
tokens to interact with the api in limited an define scope.*/
CREATE TABLE api_clients (
	INTEGER 	app_id						PRIMARY KEY NOT NULL AUTOINCREMENT,					--- Unique identifier
	TEXT		client_id					UNIQUE NOT NULL,									--- ID of the client
	INTEGER		owner_id,																		--- ID of the owner (FK)
	TEXT		name						DEFAULT "unamed",									--- name of the api
	BLOB		client_secret_encrypted		NOT NULL,											--- encrypted secret
	TEXT		redirect_url				JSON,												--- redirect url
	TEXT		scopes						JSON,												--- the authorized accesses of the app
	BOOLEAN		is_confidential				DEFAULT 1,											--- is public ?
	DATETIME	created_at					NOT NULL,											--- timestamp of creation
	DATETIME	updated_at,																		--- timestamp of update
	DATETIME	secret_expiration			NOT NULL,											--- timestamp of secret
	FOREIGN KEY(owner_id) REFERENCES users(user_id) ON DELETE CASCADE							--- users.user_id
)

-- Table: api_tokens
-- Store an api auth token to access the api for limited time -> `Authorization: Bearer $token` 
CREATE TABLE api_tokens (
	INTEGER		token_id					PRIMARY KEY NOT NULL AUTOINCREMENT, 				--- Unique identifier
	INTEGER		app_id,																			--- ID of the app (FK)
	TEXT		token_hash					UNIQUE NOT NULL,									--- the hashed token
	TEXT		scopes						JSON,												--- the authorized accesses of the app
	DATETIME	issued_at					NOT NULL,											--- timestamp of the token creation
	DATETIME	expires_at					NOT NULL,											--- timestamp of the token expired
	DATETIME	last_used_at				NOT NULL,											--- timestamp of the last update
	BOOLEAN		revoked						DEFAULT 0,											--- is revoked ?
	FOREIGN KEY(app_id) REFERENCES api_clients(app_id) ON DELETE CASCADE						--- api_clients.app_id
)

-- Table: password_resets
-- Store the password token for the forgotten password
CREATE TABLE password_resets (
	INTEGER 	reset_id					PRIMARY KEY AUTOINCREMENT,							--- Unique identifier
	INTEGER		user_id,																		--- ID of the user (FK)
	TEXT		token_hash					NOT NULL,											--- the hashed token
	DATETIME	created_at					NOT NULL,											--- timestamp of the created reset
	DATETIME	expired_at					NOT NULL,											--- timestamp of the expired reset
	DATETIME	consumed_at					NOT NULL,											--- timestamp of the consumed reset
	DATETIME	consumed					DEFAULT 0,											--- is consumed ?
	FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE							--- users.user_id
)

-- Table: sessions
-- Store informations about sessions
CREATE TABLE sessions (
	INTEGER 	session_id					PRIMARY KEY AUTOINCREMENT,							--- Unique identifier
	INTEGER 	user_id,																		--- ID of the user (FK)
	TEXT		session_token_hash			NOT NULL,											--- the hashed session token
	DATETIME	created_at					NOT NULL,											--- timestamp of created session
	DATETIME	expires_at					NOT NULL,											--- timestamp of expired session
	DATETIME	last_used_at				NOT NULL,											--- timestamp of the last used session
	TEXT		ip							NOT NULL,											--- the device public ip
	TEXT		user_agent,																		--- store more informations
	BOOLEAN		is_persistent				DEFAULT 0,											--- is persistent ?
	FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE							--- users.user_id
)

-- Table: user_2fa_methods
-- Store different methods of 2fa
CREATE TABLE user_2fa_methods (
	INTEGER		method_id					PRIMARY KEY AUTOINCREMENT,							--- Unique identifier
	INTEGER		user_id,																		--- ID of the user (FK)
	INTEGER		method_type					NOT NULL DEFAULT 0,									--- Store the method
	TEXT		label,																			--- 2fa method name
	INTEGER		is_primary					DEFAULT 0,											--- store the prymary
	BOOLEAN		is_verified					DEFAULT 0,											--- is verified ?
	DATETIME	created_at					DEFAULT CURRENT_TIMESTAMP,							--- timestamp of the created method
	DATETIME	updated_at					DEFAULT CURRENT_TIMESTAMP,							--- timestamp of the updated method
	FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE							--- users.user_id
)

-- Table: user_2fa_email_otp
-- Store the email otp
CREATE TABLE user_2fa_email_otp (
	INTEGER		email_otp_id				PRIMARY KEY AUTOINCREMENT							--- Unique identifier
	INTEGER		method_id,																		--- method id (FK)
	TEXT		last_sent_code_hash			NOT NULL,											--- the last code in hash
	DATETIME	last_sent_at,																	--- timestamp of the last sent email otp
	INTEGER		attempts					DEFAULT 0,											--- store the number of attempts
	INTEGER		consumed					DEFAULT 0,											--- store the number of consumed
	DATETIME	expires_at					NOT NULL,											--- timestamp of the expired eamil otp
	FOREIGN KEY(method_id) REFERENCES user_2fa_methods.method_id ON DELETE CASCADE				--- user_2fa_methods.method_id
)

-- Table: user_2fa_totp
-- Store the different information of the 2fa application
CREATE TABLE user_2fa_totp (
	INTEGER		totp_id						PRIMARY KEY AUTOINCREMENT,							--- Unique identifier
	INTEGER		method_id,																		--- method id (FK)
	BLOB		secret_encrypted			NOT NULL,											--- secret to use to decrypt one time code
	TEXT		secret_meta					JSON,												--- configuration of codes
	DATETIME	last_used,																		--- timestamp of the last used 2fa totp
	FOREIGN KEY(method_id) REFERENCES user_2fa_methods.method_id ON DELETE CASCADE				--- user_2fa_methods.method_id
)

-- Table: user_2fa_backup_codes
-- Store the backup codes
CREATE TABLE user_2fa_backup_codes (
	INTEGER		backup_code_id				PRIMARY KEY AUTOINCREMENT,							-- Unique identifier
	INTEGER		method_id,																		-- method id (FK)
	TEXT		code_json					NOT NULL JSON,										-- Store the json codes
	DATETIME	created_at					NOT NULL,											-- timestamp of the created backup code
	FOREIGN KEY(method_id) REFERENCES user_2fa_methods.method_id ON DELETE CASCADE				-- user_2fa_methods.method_id
)

-- Table: oauth_tokens
-- Store the different oauth information tokens
CREATE TABLE oauth_tokens (
	INTEGER		oauth_token_id				PRIMARY KEY AUTOINCREMENT							-- Unique identifier
	INTEGER		oauth_account_id,																-- ID on Oauth provider server (FK)
	TEXT		access_token_hash			NOT NULL,											-- Store the access hashed token
	TEXT		refresh_token_hash,																-- Store the refresh hashed token
	TEXT		scopes,																			-- the different access of the oauth
	TEXT		token_type,																		-- Store the type of the token
	DATETIME	issued_at,																		-- timestamp of the issued oauth token
	DATETIME	expires_at,																		-- timestamp of the expired oauth token
	BOOLEAN		revoked						DEFAULT 0,											-- is revoked ?
	FOREIGN KEY(oauth_account_id) REFERENCES oauth_account.oauth_account_id ON DELETE CASCADE	-- oauth_account.oauth_account_id
)

-- Table: oauth_providers
-- Is the base of the oauth provider
CREATE TABLE oauth_providers (
	INTEGER		provider_id					PRIMARY KEY AUTOINCREMENT,							-- Unique identifier
	TEXT		name						UNIQUE NOT NULL,									-- name of oauth provider
	TEXT		discovery_url,																	-- store the discovery url
	TEXT		client_id,																		-- ID of the client
	BLOB		client_secret_encrypted,														-- secret encrypted oauth
	BOOLEAN		is_enabled,					DEFAULT 1											-- is enable ?
	DATETIME	created_at																		-- timestamp of the created oauth provider
)

-- Table: oauth_accounts
-- Store the relation between a user and a Oauth provider
CREATE TABLE oauth_accounts (
	INTEGER		oauth_account_id			PRIMARY KEY AUTOINCREMENT,							-- Unique identifier
	INTEGER		user_id,																		-- ID on the user (FK)
	TEXT		provider_name,																	-- stock the name (FK)
	TEXT		provider_user_id			NOT NULL,											-- stock the user id
	TEXT		profile_json				JSON,												-- the profile user on the Oauth server
	TEXT		id_token_hash,																	-- encrypted hashed token
	DATETIME	linked_at,																		-- timestamp of the linked oauth account
	DATETIME	revoked_at,																		-- timestamp of the revojed oauth account
	FOREIGN KEY(user_id) REFERENCES users.user_id ON DELETE CASCADE,							-- users.user_id
	FOREIGN KEY(provider_name) REFERENCES oauth_providers.name ON DELETE CASCADE				-- oauth_providers.name 
)

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
