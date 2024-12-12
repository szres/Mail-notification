CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('APNS', 'NTFY')),
    token TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(topic, method, token)
);

CREATE INDEX IF NOT EXISTS idx_subscribers_topic ON subscribers(topic); 