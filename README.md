# Ingress Portal Attack Notification Bot

A Cloudflare Worker that processes Ingress portal attack notification emails and forwards them to Telegram as formatted messages. Includes agent registration, invitation system, and rule-based notification filtering.

## Features

### Email Processing
- Processes Ingress portal attack notification emails
- Parses both HTML and text content formats
- Extracts critical information:
  - Portal name and location
  - Attack details (attacker, time, damage)
  - Portal status
  - Portal images and map links

### Rule-Based Filtering
- Multiple rule types support:
  - Agent-based rules (match specific agents)
  - Geographic rules (polygon/radius areas)
  - Portal name rules
- Rule combination support
- Attack history tracking
- Rule set management API

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
EMAILSUFFIX = ""

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

## API Documentation

### Rule Sets API

#### Get All Rule Sets
```bash
curl https://your-worker.workers.dev/rulesets
```

Response:
```json
{
    "success": true,
    "data": [
        {
            "uuid": "test-agent-rule-001",
            "name": "Agent Rule",
            "description": "Monitor specific agent",
            "rules": [{
                "type": "agent",
                "value": "AgentName"
            }],
            "record_count": 42,
            "last_record_at": "2024-03-11T12:34:56Z"
        },
        {
            "uuid": "test-area-rule-001",
            "name": "Area Rule",
            "description": "Monitor specific area",
            "rules": [{
                "type": "polygon",
                "points": [
                    {"lat": 22.5924, "lng": 113.8976},
                    {"lat": 22.5616, "lng": 113.8468}
                ]
            }],
            "record_count": 15,
            "last_record_at": "2024-03-11T10:30:00Z"
        }
    ]
}
```

#### Get Rule Set Records
```bash
curl "https://your-worker.workers.dev/ruleset/test-agent-rule-001?startDate=2024-03-01&agent=AgentName"
```

Response:
```json
{
    "success": true,
    "data": [
        {
            "id": 1,
            "portal_name": "Test Portal",
            "portal_address": "Test Location",
            "latitude": 22.5924,
            "longitude": 113.8976,
            "agent_name": "AgentName",
            "timestamp": "2024-03-11T12:34:56Z",
            "meet_rule_sets": ["test-agent-rule-001"]
        }
    ]
}
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
- `rule_sets`: Stores notification rules
- `records`: Stores attack records

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
