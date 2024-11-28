-- First, create necessary tables if they don't exist
CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id BIGINT UNIQUE NOT NULL,
    telegram_username TEXT,
    agent_name TEXT NOT NULL,
    email_prefix TEXT UNIQUE NOT NULL,
    notification_email TEXT UNIQUE NOT NULL,
    invited_by INTEGER,
    invitation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_admin BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'inactive')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invited_by) REFERENCES agents(id)
);

CREATE TABLE IF NOT EXISTS invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invitation_code TEXT UNIQUE NOT NULL,
    inviter_id INTEGER,
    used_by INTEGER,
    is_root BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'used', 'expired')),
    FOREIGN KEY (inviter_id) REFERENCES agents(id),
    FOREIGN KEY (used_by) REFERENCES agents(id)
);

-- Create a root invitation that never expires
INSERT INTO invitations (
    invitation_code,
    is_root,
    expires_at,
    status
) VALUES (
    'SZRES_ROOT_INVITE_2024', -- You can change this to any code you want
    TRUE,
    datetime('now', '+100 years'),
    'pending'
);
