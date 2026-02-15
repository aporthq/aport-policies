# Agent Session Creation Policy v1

**Policy ID:** `agent.session.create.v1`
**Status:** Active
**Min Assurance:** L1

## Overview

The Agent Session Creation Policy provides pre-action governance for AI agent session creation. This policy enforces session limits, duration restrictions, concurrent session controls, and resource allocation to ensure secure and efficient multi-session agent deployments.

## Use Cases

- **Multi-User AI Platforms**: Managing sessions across multiple users
- **Development Agents**: Creating sessions for different projects/workspaces
- **Batch Processing**: Creating ephemeral sessions for background tasks
- **Interactive Chat**: Managing conversational agent sessions
- **Scheduled Tasks**: Creating sessions for cron-like operations

## Required Capabilities

- `agent.session.create`

## Required Limits

- `max_sessions_per_user` (integer): Maximum sessions per user
- `max_session_duration` (integer): Maximum session duration in seconds

## Optional Limits

- `max_concurrent_sessions` (integer): Maximum concurrent active sessions
- `allowed_session_types` (array): Allowed session types
- `max_sessions_per_day` (integer): Maximum sessions created per day
- `resource_quota` (object): Resource limits (memory, CPU, storage)
- `default_session_duration` (integer): Default duration if not specified
- `require_session_names` (boolean): Require human-readable names

## Context Schema

### Required Fields

- `user_id` (string): User identifier for session owner
- `session_type` (enum): Type of session (interactive, batch, webhook, scheduled, ephemeral)

### Optional Fields

- `session_name` (string): Human-readable session name
- `requested_duration` (integer): Requested session duration in seconds
- `resources` (object): Resource requirements (memory_mb, cpu_millicores, storage_gb)
- `metadata` (object): Custom metadata
- `parent_session_id` (string): Parent session for nested sessions
- `tags` (array): Tags for organization
- `mcp_servers`, `mcp_tools`, `mcp_session`: MCP integration fields

## Evaluation Rules

1. **passport_status_active**: Passport must be active
2. **session_capability**: Agent must have `agent.session.create` capability
3. **session_limit_per_user**: User must not exceed max sessions
4. **concurrent_session_limit**: Agent must not exceed concurrent sessions
5. **session_duration_limit**: Duration must not exceed maximum
6. **session_type_allowed**: Session type must be allowed
7. **resource_quota**: Requested resources must be within quota
8. **daily_session_limit**: Daily session creations must not exceed limit

## Example Passport Limits

```json
{
  "limits": {
    "agent.session.create": {
      "max_sessions_per_user": 10,
      "max_concurrent_sessions": 50,
      "max_session_duration": 3600,
      "max_sessions_per_day": 100,
      "allowed_session_types": [
        "interactive",
        "batch",
        "scheduled",
        "ephemeral"
      ],
      "resource_quota": {
        "memory_mb": 4096,
        "cpu_millicores": 2000,
        "storage_gb": 10
      },
      "default_session_duration": 1800,
      "require_session_names": false
    }
  }
}
```

## Example Request Context

```json
{
  "user_id": "user_abc123",
  "session_type": "interactive",
  "session_name": "Code Review Session",
  "requested_duration": 3600,
  "resources": {
    "memory_mb": 2048,
    "cpu_millicores": 1000,
    "storage_gb": 5
  },
  "metadata": {
    "project": "myproject",
    "environment": "development"
  },
  "tags": ["code-review", "pr-123"]
}
```

## Example Decision (Allow)

```json
{
  "decision_id": "dec_sess001",
  "policy_id": "agent.session.create.v1",
  "passport_id": "pass_abc123",
  "owner_id": "org_12345",
  "assurance_level": "L1",
  "allow": true,
  "reasons": [{
    "code": "oap.allowed",
    "message": "All policy checks passed"
  }],
  "issued_at": "2026-02-14T22:00:00Z",
  "expires_at": "2026-02-14T22:01:00Z",
  "passport_digest": "sha256:...",
  "signature": "ed25519:...",
  "kid": "oap:registry:key-2026-02"
}
```

## Example Decision (Deny - Session Limit)

```json
{
  "decision_id": "dec_sess002",
  "policy_id": "agent.session.create.v1",
  "passport_id": "pass_abc123",
  "owner_id": "org_12345",
  "assurance_level": "L1",
  "allow": false,
  "reasons": [{
    "code": "oap.session_limit_exceeded",
    "message": "User has reached maximum of 10 sessions"
  }],
  "issued_at": "2026-02-14T22:00:00Z",
  "expires_at": "2026-02-14T22:01:00Z",
  "passport_digest": "sha256:...",
  "signature": "ed25519:...",
  "kid": "oap:registry:key-2026-02"
}
```

## Security Best Practices

1. **Session Limits**: Prevent resource exhaustion with per-user limits
2. **Duration Caps**: Set maximum durations to prevent zombie sessions
3. **Concurrent Controls**: Limit active sessions to manage system load
4. **Resource Quotas**: Enforce memory/CPU/storage limits
5. **Session Tracking**: Log all session creations for auditing
6. **Session Types**: Use types to apply different policies
7. **Auto-Expiration**: Implement automatic session cleanup
8. **Progressive Limits**: Start strict and relax for trusted users
9. **Status Webhooks**: Subscribe for instant revocation
10. **Session Tagging**: Enable organization and cost allocation

## Session Types

### Interactive
- User-facing chat or CLI sessions
- Typically shorter duration (minutes to hours)
- Requires real-time responsiveness

### Batch
- Background processing tasks
- Can be longer duration (hours)
- Lower priority for resources

### Webhook
- Triggered by external events
- Short-lived (seconds to minutes)
- Event-driven lifecycle

### Scheduled
- Cron-like scheduled tasks
- Predictable execution patterns
- Can be recurring

### Ephemeral
- Temporary, disposable sessions
- Very short duration (seconds)
- Minimal resource allocation

## Error Codes

- `oap.passport_suspended`: Passport is not active
- `oap.unknown_capability`: Missing agent.session.create capability
- `oap.session_limit_exceeded`: User exceeded max sessions
- `oap.concurrent_limit_exceeded`: Too many concurrent sessions
- `oap.duration_limit_exceeded`: Requested duration too long
- `oap.session_type_not_allowed`: Session type not allowed
- `oap.resource_quota_exceeded`: Requested resources exceed quota
- `oap.daily_limit_exceeded`: Daily session creation limit exceeded

## Integration Examples

### TypeScript (Session Manager)

```typescript
import axios from 'axios';

interface SessionRequest {
  userId: string;
  sessionType: 'interactive' | 'batch' | 'webhook' | 'scheduled' | 'ephemeral';
  sessionName?: string;
  requestedDuration?: number;
  resources?: {
    memory_mb?: number;
    cpu_millicores?: number;
    storage_gb?: number;
  };
  metadata?: Record<string, any>;
  tags?: string[];
}

async function createSession(
  passport: Passport,
  request: SessionRequest
): Promise<Session> {
  const context = {
    user_id: request.userId,
    session_type: request.sessionType,
    session_name: request.sessionName,
    requested_duration: request.requestedDuration || 1800,
    resources: request.resources,
    metadata: request.metadata,
    tags: request.tags
  };

  // Check policy
  const decision = await axios.post('https://api.aport.io/v1/decide', {
    passport_id: passport.passport_id,
    policy_id: 'agent.session.create.v1',
    context
  });

  if (!decision.data.allow) {
    throw new Error(`Session creation blocked: ${decision.data.reasons[0].message}`);
  }

  // Create session
  const session = await createSessionInDatabase(context);

  // Schedule auto-cleanup
  scheduleSessionCleanup(session.id, context.requested_duration);

  return session;
}
```

### Python (FastAPI)

```python
from datetime import datetime, timedelta
import httpx

async def create_session(
    passport: dict,
    user_id: str,
    session_type: str,
    session_name: str | None = None,
    requested_duration: int = 1800,
    resources: dict | None = None,
    metadata: dict | None = None,
    tags: list[str] | None = None
) -> dict:
    context = {
        "user_id": user_id,
        "session_type": session_type,
        "session_name": session_name,
        "requested_duration": requested_duration,
        "resources": resources or {},
        "metadata": metadata or {},
        "tags": tags or []
    }

    # Check policy
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.aport.io/v1/decide",
            json={
                "passport_id": passport["passport_id"],
                "policy_id": "agent.session.create.v1",
                "context": context
            }
        )
        decision = response.json()

    if not decision["allow"]:
        raise PermissionError(f"Session creation blocked: {decision['reasons'][0]['message']}")

    # Create session
    session = await create_session_in_database(context)

    # Schedule auto-cleanup
    expires_at = datetime.utcnow() + timedelta(seconds=requested_duration)
    await schedule_session_cleanup(session["id"], expires_at)

    return session
```

## Resource Management

Sessions should track and enforce resource usage:

```typescript
interface SessionResources {
  memory_mb: number;      // RAM allocation
  cpu_millicores: number; // CPU allocation (1000 = 1 core)
  storage_gb: number;     // Disk allocation
  network_mbps: number;   // Network bandwidth
}

// Calculate resource costs
function calculateResourceCost(resources: SessionResources, duration_hours: number): number {
  const memory_cost = (resources.memory_mb / 1024) * 0.01 * duration_hours;
  const cpu_cost = (resources.cpu_millicores / 1000) * 0.05 * duration_hours;
  const storage_cost = resources.storage_gb * 0.001 * duration_hours;

  return memory_cost + cpu_cost + storage_cost;
}
```

## Version History

- **v1.0.0** (2026-02-14): Initial release

## References

- [OAP Specification](https://github.com/aporthq/aport-spec)
- [Session Management Best Practices](https://docs.aport.io/sessions)
