# Ingress Portal Attack Notification Bot

A Cloudflare Worker that processes Ingress portal attack notification emails and forwards them to Telegram as formatted messages. Includes agent registration and invitation system.

## Features

### Email Processing
- Processes Ingress portal attack notification emails
- Parses both HTML and text content formats
- Extracts critical information:
  - Portal name and location
  - Attack details (attacker, time, damage)
  - Portal status
  - Portal images and map links

### Telegram Integration
- Sends formatted notifications to Telegram
- Includes Intel Map links for quick response
- Interactive bot commands
- Registration system with invitations

### Agent Management
- Invitation-based registration system
- Agent faction selection (Resistance/Enlightened)
- Unique notification email per agent
- Agent status tracking

## Setup

### Prerequisites

1. Cloudflare Account
2. Telegram Bot Token
3. Wrangler CLI installed
4. D1 Database instance

### Configuration

1. Create D1 database:
```bash
wrangler d1 create email_notification_db
```

2. Configure `wrangler.toml`:
```toml
name = "mail-notification-worker"
main = "src/index.js"
compatibility_date = "2024-01-01"

[vars]
TELEGRAM_BOT_TOKEN = ""  # Set via secrets
WEBHOOK_SECRET = ""      # Set via secrets
TELEGRAM_CHAT_ID = ""    # Set via secrets

[[d1_databases]]
binding = "emaildb"
database_name = "email_notification_db"
database_id = "YOUR_DATABASE_ID"  # From step 1
```

3. Set up secrets:
```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put WEBHOOK_SECRET
wrangler secret put TELEGRAM_CHAT_ID
```

4. Create initial admin invitation:
```bash
wrangler d1 execute email_notification_db --command "INSERT INTO invitations (invitation_code, expires_at, status) VALUES ('ADMIN2024', datetime('now', '+100 years'), 'active');"
```

### Deployment

```bash
npm install
npm run deploy
```

## Bot Commands

- `/start` - Start registration with invitation code
- `/invite` - Generate new invitation link
- `/status` - Check agent status
- `/help` - Show available commands
- `/cancel` - Cancel current operation

## Message Format

The bot sends formatted Telegram messages containing:
```
🚨 Portal Attack Alert!

🏛 Portal Information
Name: [Portal Name]
Address: [Portal Address]
[Portal Image]

👤 Attack Details
Attacker: [Attacker Name]
Time: [Attack Time] GMT

💥 Damage Report
[Damage Details]

📊 Current Status
[Portal Status]

🗺 [Intel Map Link]

👮 Defending Agent
Agent: [Agent Name] (Faction)
```

## Technical Details

### Components
- `PostalMime`: Email parsing
- `Grammy`: Telegram bot interactions
- `D1`: SQLite database for agent management
- Cloudflare Workers: Email and webhook processing

### Database Schema
- `agents`: Stores agent information
- `registrations`: Manages registration process
- `invitations`: Handles invitation system

### Security Features
- Invitation-based registration
- Webhook secret verification
- Per-agent email addresses
- Expiring invitations

## Error Handling

- Comprehensive error catching and reporting
- Database operation validation
- Debug logging for troubleshooting
- Error notifications via Telegram
- Registration state management

## Limitations

- Relies on Ingress email notification format
- Requires Cloudflare Workers and D1
- Email must be properly formatted (HTML or text)
- One Telegram account per agent

## Development

### Local Testing
```bash
npm run dev
```

### Database Management
```bash
# Access D1 shell
wrangler d1 shell email_notification_db

# Execute SQL file
wrangler d1 execute email_notification_db --file ./schema.sql
```

### Webhook Setup
Set the webhook URL to:
```
https://your-worker.workers.dev/webhook
```
