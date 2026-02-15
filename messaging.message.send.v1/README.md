# Messaging Policy Pack v1

## Overview

The `messaging.message.send.v1` policy pack protects messaging endpoints with rate limits, channel restrictions, and mention policies. This is designed as a PLG (Product-Led Growth) on-ramp for harmless messaging use cases across Slack, Discord, Email, and other channels.

## Policy Requirements

| **Requirement** | **Value** | **Description** |
|-----------------|-----------|-----------------|
| **Capability** | `messaging.send` | Agent must have messaging capability |
| **Assurance** | L0 | Minimum assurance level required |
| **Rate Limits** | `msgs_per_min`, `msgs_per_day` | Required rate limiting configuration |

## Limits Configuration

### Required Limits

- **`msgs_per_min`**: Maximum messages per minute (1-1000)
- **`msgs_per_day`**: Maximum messages per day (1-50000)

### Capability Parameters

- **`channels_allowlist`**: Comma-separated list of allowed channels (slack, discord, email)
- **`mention_policy`**: Policy for @mentions (none, limited, all)
- **`max_recipients`**: Maximum number of recipients per message

## Example Usage

### Express.js

```javascript
const { requirePolicy } = require("@aporthq/middleware-express");

app.post("/messages", requirePolicy("messaging.message.send.v1"), async (req, res) => {
  const { channel, recipients, content, mentions } = req.body;
  const passport = req.policyResult.passport;

  // Policy automatically enforces:
  // - Channel allowlist validation
  // - Rate limiting (msgs_per_min, msgs_per_day)
  // - Mention policy enforcement
  // - Assurance level checking (L0+)

  // Your messaging logic here
  const message_id = await sendMessage({
    channel,
    recipients,
    content,
    mentions,
    agent_id: passport.agent_id,
  });

  res.json({ success: true, message_id });
});
```

### FastAPI

```python
from aport.middleware import require_policy

@app.post("/messages")
@require_policy("messaging.message.send.v1")
async def send_message(request: Request, message_data: MessageRequest):
    passport = request.state.policy_result.passport
    
    # Policy automatically enforces all requirements
    # Your messaging logic here
    
    return {"success": True, "message_id": message_id}
```

## Policy Violations

### Channel Not Allowlisted

```json
{
  "error": "messaging_policy_violation",
  "reason": "channel_not_allowlisted",
  "channel": "teams",
  "allowed_channels": ["slack", "discord", "email"],
  "upgrade_instructions": "Add 'teams' to your passport's channels_allowlist parameter"
}
```

### Rate Limit Exceeded

```json
{
  "error": "messaging_policy_violation",
  "reason": "rate_limit_exceeded",
  "limit_type": "per_minute",
  "current_usage": 95,
  "limit": 100,
  "retry_after": 60
}
```

### Mention Policy Violation

```json
{
  "error": "messaging_policy_violation",
  "reason": "mention_not_allowed",
  "mention_policy": "limited",
  "violation": "@everyone mentions not allowed with limited policy"
}
```

## Best Practices

### Implementation

1. **Rate Limiting**: Implement proper rate limiting per agent and per channel
2. **Channel Validation**: Always validate channels against the allowlist
3. **Mention Control**: Enforce mention policies to prevent spam
4. **Verifiable Attestation**: Log all message attempts for security monitoring
5. **Error Handling**: Provide clear error messages for policy violations

### Security

1. **Monitor Patterns**: Watch for spam patterns and suspicious activity
2. **Webhook Integration**: Subscribe to status webhooks for instant suspend
3. **Content Filtering**: Consider implementing content filtering for harmful messages
4. **Channel-Specific Limits**: Implement different limits for different channels

### Performance

1. **Cache Verification**: Cache passport verification results (60s TTL recommended)
2. **Async Processing**: Use async processing for bulk message operations
3. **Rate Limiter**: Use Redis or similar for distributed rate limiting
4. **Batch Operations**: Support batch messaging with proper limit checking

## Why This Policy Pack?

- **Mass Market**: Messaging is harmless and perfect for PLG onboarding
- **Demo Friendly**: Easy to demonstrate limits and suspend functionality
- **Channel Diversity**: Supports multiple messaging platforms (Slack, Discord, Email)
- **Scalable**: Rate limits prevent abuse while allowing legitimate use
- **Compliance Ready**: Built-in Verifiable Attestation and policy enforcement

## Integration Examples

- **Customer Support**: Automated responses via Slack/Discord
- **Marketing**: Email campaigns with rate limiting
- **Notifications**: System alerts across multiple channels
- **Community Management**: Moderated Discord/Slack interactions
- **Internal Tools**: Employee messaging and announcements


## Required Context

This policy requires the following context (JSON Schema):

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": [
    "channel_id",
    "message",
    "message_type"
  ],
  "properties": {
    "channel_id": {
      "type": "string",
      "minLength": 1,
      "description": "Target channel identifier"
    },
    "message": {
      "type": "string",
      "minLength": 1,
      "maxLength": 2000,
      "description": "Message content"
    },
    "message_type": {
      "type": "string",
      "enum": [
        "text",
        "embed",
        "file",
        "reaction"
      ],
      "description": "Type of message"
    },
    "mentions": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "User or role mentions in the message"
    },
    "attachments": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "url": {
            "type": "string"
          },
          "filename": {
            "type": "string"
          },
          "size": {
            "type": "integer"
          }
        }
      },
      "description": "File attachments"
    },
    "thread_id": {
      "type": "string",
      "description": "Thread identifier for threaded messages"
    },
    "reply_to": {
      "type": "string",
      "description": "Message ID being replied to"
    }
  }
}
```

You can also fetch this live via the discovery endpoint:

```bash
curl -s "https://aport.io/api/policies/messaging.message.send.v1?format=schema"
```

