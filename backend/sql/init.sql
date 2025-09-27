CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT
);

INSERT INTO users (username) VALUES
('alice'),
('bob');
