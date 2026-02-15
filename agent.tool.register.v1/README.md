# Agent Tool Registration Policy v1

**Policy ID:** `agent.tool.register.v1`
**Status:** Active
**Min Assurance:** L2

## Overview

The Agent Tool Registration Policy provides pre-action governance for AI agent tool registration. This policy enforces tool naming conventions, capability declarations, security validations, and registration limits to ensure a secure and well-managed tool ecosystem.

## Use Cases

- **Tool Marketplaces**: Registering tools in agent marketplaces
- **Custom Tools**: Registering custom functions for agent use
- **MCP Tools**: Registering MCP tool wrappers
- **API Integrations**: Registering API endpoint tools
- **Workflow Tools**: Registering multi-step workflow tools

## Required Capabilities

- `agent.tool.register`

## Required Limits

- `max_tools_per_agent` (integer): Maximum tools an agent can register
- `max_registrations_per_day` (integer): Maximum registrations per day

## Optional Limits

- `allowed_tool_types` (array): Allowed tool types
- `allowed_capabilities` (array): Allowed capability declarations
- `require_schema` (boolean): Require JSON schema for tools
- `require_version` (boolean): Require semantic versioning
- `require_repository` (boolean): Require source repository URL
- `allowed_licenses` (array): Allowed licenses

## Context Schema

### Required Fields

- `tool_name` (string): Unique tool name (lowercase, alphanumeric, dots, dashes)
- `tool_type` (enum): Tool type (function, mcp_tool, api, command, workflow, agent)
- `capabilities` (array): List of required capabilities

### Optional Fields

- `tool_description` (string): Human-readable description
- `tool_version` (string): Semantic version
- `schema` (object): JSON Schema for parameters
- `author` (string): Tool author
- `repository` (string): Source code repository URL
- `license` (enum): Tool license
- `tags` (array): Categorization tags
- `metadata` (object): Custom metadata
- `mcp_servers`, `mcp_tools`, `mcp_session`: MCP integration fields

## Tool Types

- **function**: Simple callable function
- **mcp_tool**: MCP protocol tool wrapper
- **api**: RESTful API endpoint wrapper
- **command**: Shell command wrapper
- **workflow**: Multi-step workflow orchestrator
- **agent**: Nested agent invocation

## Evaluation Rules

1. **passport_status_active**: Passport must be active
2. **tool_register_capability**: Agent must have `agent.tool.register` capability
3. **tool_count_limit**: Must not exceed max tools per agent
4. **daily_registration_limit**: Must not exceed daily limit
5. **tool_name_unique**: Tool name must be unique
6. **tool_type_allowed**: Tool type must be allowed
7. **capability_allowed**: All capabilities must be allowed
8. **naming_convention**: Tool name must follow convention

## Example Passport Limits

```json
{
  "limits": {
    "agent.tool.register": {
      "max_tools_per_agent": 100,
      "max_registrations_per_day": 50,
      "allowed_tool_types": [
        "function",
        "mcp_tool",
        "api",
        "command",
        "workflow"
      ],
      "allowed_capabilities": [
        "system.command.execute",
        "mcp.tool.execute",
        "data.export",
        "messaging.message.send"
      ],
      "require_schema": true,
      "require_version": true,
      "require_repository": false,
      "allowed_licenses": [
        "MIT",
        "Apache-2.0",
        "BSD-3-Clause",
        "ISC",
        "proprietary"
      ]
    }
  }
}
```

## Example Request Context

```json
{
  "tool_name": "github.pr.create",
  "tool_type": "mcp_tool",
  "capabilities": ["mcp.tool.execute", "code.repository.merge"],
  "tool_description": "Create a GitHub pull request",
  "tool_version": "1.0.0",
  "schema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["repo", "title", "head", "base"],
    "properties": {
      "repo": { "type": "string" },
      "title": { "type": "string" },
      "head": { "type": "string" },
      "base": { "type": "string" },
      "body": { "type": "string" }
    }
  },
  "author": "MyOrg Engineering",
  "repository": "https://github.com/myorg/tools",
  "license": "MIT",
  "tags": ["github", "pr", "git"]
}
```

## Example Decision (Allow)

```json
{
  "decision_id": "dec_tool001",
  "policy_id": "agent.tool.register.v1",
  "passport_id": "pass_abc123",
  "owner_id": "org_12345",
  "assurance_level": "L2",
  "allow": true,
  "reasons": [{
    "code": "oap.allowed",
    "message": "All policy checks passed"
  }],
  "issued_at": "2026-02-14T22:00:00Z",
  "expires_at": "2026-02-14T22:05:00Z",
  "passport_digest": "sha256:...",
  "signature": "ed25519:...",
  "kid": "oap:registry:key-2026-02"
}
```

## Example Decision (Deny - Tool Limit)

```json
{
  "decision_id": "dec_tool002",
  "policy_id": "agent.tool.register.v1",
  "passport_id": "pass_abc123",
  "owner_id": "org_12345",
  "assurance_level": "L2",
  "allow": false,
  "reasons": [{
    "code": "oap.tool_limit_exceeded",
    "message": "Agent has reached maximum of 100 tool registrations"
  }],
  "issued_at": "2026-02-14T22:00:00Z",
  "expires_at": "2026-02-14T22:05:00Z",
  "passport_digest": "sha256:...",
  "signature": "ed25519:...",
  "kid": "oap:registry:key-2026-02"
}
```

## Tool Naming Convention

Tool names must follow the pattern: `^[a-z0-9][a-z0-9._-]*[a-z0-9]$`

**Valid Names:**
- `github.pr.create`
- `stripe-payment-create`
- `my_custom_tool`
- `tool-v2.0`

**Invalid Names:**
- `GitHub.PR.Create` (uppercase)
- `-tool-name` (starts with dash)
- `tool.name.` (ends with dot)
- `tool name` (contains space)

## Security Best Practices

1. **Tool Limits**: Prevent namespace pollution with registration limits
2. **Capability Declarations**: Require explicit capability declarations
3. **Schema Validation**: Enforce JSON schemas for parameter safety
4. **Versioning**: Use semantic versioning for compatibility
5. **License Checking**: Validate licenses for compliance
6. **Repository Links**: Track source code for security audits
7. **Uniqueness**: Enforce unique tool names to prevent conflicts
8. **Audit Logging**: Log all registrations for security review
9. **Progressive Limits**: Start strict and relax for trusted developers
10. **Status Webhooks**: Subscribe for instant revocation

## Error Codes

- `oap.passport_suspended`: Passport is not active
- `oap.unknown_capability`: Missing agent.tool.register capability
- `oap.tool_limit_exceeded`: Exceeded max tools per agent
- `oap.daily_limit_exceeded`: Exceeded daily registration limit
- `oap.tool_already_exists`: Tool name already registered
- `oap.tool_type_not_allowed`: Tool type not allowed
- `oap.capability_not_allowed`: Capability not allowed
- `oap.invalid_tool_name`: Tool name doesn't follow convention

## Integration Examples

### TypeScript (Tool Registry)

```typescript
import axios from 'axios';

interface ToolRegistration {
  toolName: string;
  toolType: 'function' | 'mcp_tool' | 'api' | 'command' | 'workflow' | 'agent';
  capabilities: string[];
  toolDescription?: string;
  toolVersion?: string;
  schema?: object;
  author?: string;
  repository?: string;
  license?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

async function registerTool(
  passport: Passport,
  registration: ToolRegistration
): Promise<Tool> {
  const context = {
    tool_name: registration.toolName,
    tool_type: registration.toolType,
    capabilities: registration.capabilities,
    tool_description: registration.toolDescription,
    tool_version: registration.toolVersion,
    schema: registration.schema,
    author: registration.author,
    repository: registration.repository,
    license: registration.license,
    tags: registration.tags,
    metadata: registration.metadata
  };

  // Check policy
  const decision = await axios.post('https://api.aport.io/v1/decide', {
    passport_id: passport.passport_id,
    policy_id: 'agent.tool.register.v1',
    context
  });

  if (!decision.data.allow) {
    throw new Error(`Tool registration blocked: ${decision.data.reasons[0].message}`);
  }

  // Register tool
  const tool = await registerToolInDatabase(context);

  // Publish to tool registry
  await publishToolToRegistry(tool);

  return tool;
}
```

### Python (FastAPI)

```python
from pydantic import BaseModel, Field
import httpx

class ToolRegistration(BaseModel):
    tool_name: str = Field(..., pattern=r'^[a-z0-9][a-z0-9._-]*[a-z0-9]$')
    tool_type: str = Field(..., pattern=r'^(function|mcp_tool|api|command|workflow|agent)$')
    capabilities: list[str]
    tool_description: str | None = None
    tool_version: str | None = Field(None, pattern=r'^\d+\.\d+\.\d+')
    schema_: dict | None = Field(None, alias='schema')
    author: str | None = None
    repository: str | None = None
    license: str | None = None
    tags: list[str] = []
    metadata: dict = {}

async def register_tool(
    passport: dict,
    registration: ToolRegistration
) -> dict:
    context = registration.dict(by_alias=True, exclude_none=True)

    # Check policy
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.aport.io/v1/decide",
            json={
                "passport_id": passport["passport_id"],
                "policy_id": "agent.tool.register.v1",
                "context": context
            }
        )
        decision = response.json()

    if not decision["allow"]:
        raise PermissionError(f"Tool registration blocked: {decision['reasons'][0]['message']}")

    # Register tool
    tool = await register_tool_in_database(context)

    # Publish to tool registry
    await publish_tool_to_registry(tool)

    return tool
```

## Tool Discovery

Registered tools can be discovered via:

```typescript
// Search by tags
const tools = await searchTools({ tags: ['github', 'pr'] });

// Search by capability
const tools = await searchTools({ capability: 'code.repository.merge' });

// Search by type
const tools = await searchTools({ type: 'mcp_tool' });

// Full-text search
const tools = await searchTools({ query: 'pull request' });
```

## Version History

- **v1.0.0** (2026-02-14): Initial release

## References

- [OAP Specification](https://github.com/aporthq/aport-spec)
- [Tool Registry Guidelines](https://docs.aport.io/tools)
- [JSON Schema Documentation](https://json-schema.org/)
- [Semantic Versioning](https://semver.org/)
