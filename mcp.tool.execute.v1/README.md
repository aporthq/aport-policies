# MCP Tool Execution Policy v1

**Policy ID:** `mcp.tool.execute.v1`
**Status:** Active
**Min Assurance:** L1

## Overview

The MCP Tool Execution Policy provides pre-action governance for Model Context Protocol (MCP) tool execution by AI agents. This policy enforces server allowlists, tool restrictions, parameter validation, and rate limits to ensure secure MCP integration.

## Use Cases

- **Multi-Tool AI Agents**: Executing tools across multiple MCP servers
- **GitHub Integration**: Using GitHub MCP tools (pull requests, issues, etc.)
- **Database Operations**: Executing database queries via MCP
- **API Integration**: Calling external APIs through MCP tools
- **Development Workflows**: Automating development tasks with MCP

## Required Capabilities

- `mcp.tool.execute`

## Required Limits

- `allowed_servers` (array of strings): Allowlist of MCP server URLs
- `max_calls_per_minute` (integer): Maximum tool calls per minute

## Optional Limits

- `allowed_tools` (array of strings): Specific tools allowed
- `allowed_tool_prefixes` (array of strings): Tool name prefixes allowed
- `blocked_tools` (array of strings): Specific tools blocked
- `max_timeout` (integer): Maximum tool execution timeout
- `max_parameter_size` (integer): Maximum parameter size in bytes
- `require_session_tracking` (boolean): Require session IDs for all calls

## Context Schema

### Required Fields

- `server` (string): MCP server URL
- `tool` (string): MCP tool name
- `parameters` (object): Tool-specific parameters

### Optional Fields

- `session_id` (string): MCP session identifier
- `timeout` (integer): Tool execution timeout
- `context` (object): Additional context
- `user_id` (string): User on whose behalf tool is executed
- `mcp_servers`, `mcp_tools`, `mcp_session`: Audit trail fields

## Evaluation Rules

1. **passport_status_active**: Passport must be active
2. **mcp_capability**: Agent must have `mcp.tool.execute` capability
3. **server_allowlist**: MCP server must be in allowed list
4. **tool_allowlist**: Tool must be allowed (exact match or prefix match)
5. **rate_limit**: Calls per minute must not exceed limit
6. **timeout_limit**: Timeout must not exceed maximum
7. **parameter_size_limit**: Parameters must not exceed size limit

## Example Passport Limits

```json
{
  "limits": {
    "mcp.tool.execute": {
      "allowed_servers": [
        "https://mcp.github.com",
        "https://mcp.stripe.com",
        "https://mcp.internal.company.com"
      ],
      "allowed_tools": [
        "github.pull_requests.create",
        "github.pull_requests.merge",
        "github.issues.create",
        "stripe.customers.create",
        "stripe.charges.create"
      ],
      "allowed_tool_prefixes": [
        "github.pull_requests.",
        "github.issues.",
        "stripe.customers."
      ],
      "blocked_tools": [
        "github.repos.delete",
        "stripe.subscriptions.cancel"
      ],
      "max_calls_per_minute": 60,
      "max_timeout": 120,
      "max_parameter_size": 102400,
      "require_session_tracking": true
    }
  }
}
```

## Example Request Context

```json
{
  "server": "https://mcp.github.com",
  "tool": "github.pull_requests.create",
  "parameters": {
    "owner": "myorg",
    "repo": "myrepo",
    "title": "Add new feature",
    "head": "feature-branch",
    "base": "main",
    "body": "This PR adds a new feature"
  },
  "session_id": "sess_abc123",
  "timeout": 60,
  "user_id": "user_xyz789"
}
```

## Example Decision (Allow)

```json
{
  "decision_id": "dec_mcp001",
  "policy_id": "mcp.tool.execute.v1",
  "passport_id": "pass_abc123",
  "owner_id": "org_12345",
  "assurance_level": "L1",
  "allow": true,
  "reasons": [{
    "code": "oap.allowed",
    "message": "All policy checks passed"
  }],
  "issued_at": "2026-02-14T22:00:00Z",
  "expires_at": "2026-02-14T22:00:30Z",
  "passport_digest": "sha256:...",
  "signature": "ed25519:...",
  "kid": "oap:registry:key-2026-02"
}
```

## Example Decision (Deny - Tool Not Allowed)

```json
{
  "decision_id": "dec_mcp002",
  "policy_id": "mcp.tool.execute.v1",
  "passport_id": "pass_abc123",
  "owner_id": "org_12345",
  "assurance_level": "L1",
  "allow": false,
  "reasons": [{
    "code": "oap.tool_not_allowed",
    "message": "MCP tool 'github.repos.delete' is not in allowed list"
  }],
  "issued_at": "2026-02-14T22:00:00Z",
  "expires_at": "2026-02-14T22:00:30Z",
  "passport_digest": "sha256:...",
  "signature": "ed25519:...",
  "kid": "oap:registry:key-2026-02"
}
```

## Security Best Practices

1. **Server Allowlist**: Only allow trusted MCP servers
2. **Tool Restrictions**: Use granular tool permissions (not wildcards)
3. **Rate Limiting**: Prevent abuse with conservative rate limits
4. **Session Tracking**: Require session IDs for audit trails
5. **Parameter Validation**: Enforce parameter size limits
6. **Tool Prefixes**: Use prefixes for tool families (e.g., "github.pull_requests.")
7. **Block Dangerous Tools**: Explicitly block destructive operations
8. **Progressive Limits**: Start strict and relax based on behavior
9. **Status Webhooks**: Subscribe for instant revocation
10. **Audit Logging**: Log all MCP tool calls with parameters

## Error Codes

- `oap.passport_suspended`: Passport is not active
- `oap.unknown_capability`: Missing mcp.tool.execute capability
- `oap.server_not_allowed`: MCP server not in allowlist
- `oap.tool_not_allowed`: Tool not in allowlist
- `oap.rate_limit_exceeded`: Too many calls per minute
- `oap.timeout_exceeded`: Timeout exceeds maximum
- `oap.parameter_size_exceeded`: Parameters too large

## Integration Examples

### TypeScript (MCP Client)

```typescript
import { MCPClient } from '@modelcontextprotocol/client';
import axios from 'axios';

async function executeMCPTool(
  passport: Passport,
  server: string,
  tool: string,
  parameters: Record<string, any>
) {
  const context = {
    server,
    tool,
    parameters,
    session_id: generateSessionId(),
    timeout: 60
  };

  // Check policy
  const decision = await axios.post('https://api.aport.io/v1/decide', {
    passport_id: passport.passport_id,
    policy_id: 'mcp.tool.execute.v1',
    context
  });

  if (!decision.data.allow) {
    throw new Error(`MCP tool blocked: ${decision.data.reasons[0].message}`);
  }

  // Execute MCP tool
  const client = new MCPClient(server);
  const result = await client.callTool(tool, parameters, {
    timeout: context.timeout * 1000
  });

  return result;
}
```

### Python (MCP Integration)

```python
import httpx
from mcp_client import MCPClient

async def execute_mcp_tool(
    passport: dict,
    server: str,
    tool: str,
    parameters: dict
):
    context = {
        "server": server,
        "tool": tool,
        "parameters": parameters,
        "session_id": generate_session_id(),
        "timeout": 60
    }

    # Check policy
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.aport.io/v1/decide",
            json={
                "passport_id": passport["passport_id"],
                "policy_id": "mcp.tool.execute.v1",
                "context": context
            }
        )
        decision = response.json()

    if not decision["allow"]:
        raise PermissionError(f"MCP tool blocked: {decision['reasons'][0]['message']}")

    # Execute MCP tool
    mcp_client = MCPClient(server)
    result = await mcp_client.call_tool(
        tool,
        parameters,
        timeout=context["timeout"]
    )

    return result
```

## MCP Tool Name Conventions

MCP tools follow the convention: `<service>.<resource>.<action>`

Examples:
- `github.pull_requests.create`
- `github.pull_requests.merge`
- `github.issues.create`
- `stripe.customers.create`
- `stripe.charges.refund`
- `database.queries.execute`
- `api.endpoints.call`

Use `allowed_tool_prefixes` for tool families:
- `github.pull_requests.*` → All PR operations
- `github.issues.*` → All issue operations
- `stripe.customers.*` → All customer operations

## Version History

- **v1.0.0** (2026-02-14): Initial release

## References

- [Model Context Protocol Specification](https://modelcontextprotocol.io)
- [OAP Specification](https://github.com/aporthq/aport-spec)
- [MCP Tool Registry](https://mcp.tools)
