# Ingress Portal Attack Notification Bot

A Cloudflare Worker that processes Ingress portal attack notification emails and forwards them to Telegram as formatted messages for quick monitoring and response.

## Features

- Processes Ingress portal attack notification emails
- Parses both HTML and text content formats
- Extracts critical information:
  - Portal name and location
  - Attack details (attacker, time, damage)
  - Portal status
  - Portal images and map links
- Sends formatted notifications to Telegram
- Includes Intel Map links for quick response

## Setup

### Prerequisites

1. Cloudflare Account
2. Telegram Bot Token
3. Wrangler CLI installed

### Configuration

1. Create a `wrangler.toml`:
```toml
name = "mail-notification-worker"
main = "src/index.js"
compatibility_date = "2023-01-01"
```

2. Set up secrets:
```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
```

### Deployment

```bash
wrangler deploy
```

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
Agent: [Agent Name] (Faction Level)
```

## Technical Details

### Email Parsing Strategy
The worker implements a dual-parsing strategy:
1. **HTML Content Parsing**: Extracts information from structured HTML when available
2. **Text Content Parsing**: Falls back to plain text parsing when HTML is not available

### Key Components
- `PostalMime`: Email parsing
- `Grammy`: Telegram bot interactions
- Cloudflare Workers: Email processing

## Error Handling

- Comprehensive error catching and reporting
- Fallback parsing mechanisms
- Debug logging for troubleshooting
- Error notifications via Telegram

## Limitations

- Relies on Ingress email notification format
- Requires Cloudflare Workers
- Email must be properly formatted (HTML or text)
