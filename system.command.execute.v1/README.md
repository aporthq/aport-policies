# System Command Execution Policy v1

**Policy ID:** `system.command.execute.v1`
**Status:** Active
**Min Assurance:** L2

## Overview

The System Command Execution Policy provides pre-action governance for shell command execution by AI agents. This policy enforces command allowlists, blocked patterns, execution time limits, and environment restrictions to ensure secure agent operations.

## Use Cases

- **Development Agents**: Running npm, git, node, yarn commands
- **DevOps Agents**: Executing deployment scripts, infrastructure commands
- **Data Pipeline Agents**: Running data processing commands
- **Testing Agents**: Executing test suites and build commands

## Required Capabilities

- `system.command.execute`

## Required Limits

- `allowed_commands` (array of strings): Allowlist of commands
- `max_execution_time` (integer): Maximum execution time in seconds

## Optional Limits

- `blocked_patterns` (array of strings): Patterns to block (e.g., "rm -rf", "sudo")
- `allowed_directories` (array of strings): Allowed working directories
- `allowed_shells` (array of strings): Allowed shell types
- `max_output_size` (integer): Maximum output size in bytes
- `environment_allowlist` (array of strings): Allowed environment variables

## Context Schema

### Required Fields

- `command` (string): Command to execute

### Optional Fields

- `args` (array): Command arguments
- `cwd` (string): Working directory
- `env` (object): Environment variables
- `timeout` (integer): Command timeout in seconds
- `shell` (string): Shell to use (bash, sh, zsh, etc.)
- `user` (string): User to run command as
- `mcp_servers`, `mcp_tools`, `mcp_session`: MCP integration fields

## Evaluation Rules

1. **passport_status_active**: Passport must be active
2. **command_capability**: Agent must have `system.command.execute` capability
3. **command_allowlist**: Command must be in allowed list
4. **blocked_patterns**: Command must not contain blocked patterns
5. **execution_time_limit**: Timeout must not exceed max_execution_time
6. **working_directory_allowed**: Working directory must be allowed

## Example Passport Limits

```json
{
  "limits": {
    "system.command.execute": {
      "allowed_commands": [
        "npm",
        "yarn",
        "pnpm",
        "git",
        "node",
        "bash",
        "sh",
        "python",
        "pip"
      ],
      "blocked_patterns": [
        "rm -rf",
        "sudo",
        "chmod 777",
        "dd if=",
        "mkfs",
        "> /dev/",
        "curl | bash",
        "wget | sh"
      ],
      "max_execution_time": 300,
      "allowed_directories": [
        "/workspace",
        "/tmp",
        "/home/agent"
      ],
      "allowed_shells": ["bash", "sh"],
      "max_output_size": 1048576
    }
  }
}
```

## Example Request Context

```json
{
  "command": "npm",
  "args": ["install", "--production"],
  "cwd": "/workspace/myproject",
  "env": {
    "NODE_ENV": "production"
  },
  "timeout": 120,
  "shell": "bash",
  "mcp_session": "sess_abc123"
}
```

## Example Decision (Allow)

```json
{
  "decision_id": "dec_xyz789",
  "policy_id": "system.command.execute.v1",
  "passport_id": "pass_abc123",
  "owner_id": "org_12345",
  "assurance_level": "L2",
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

## Example Decision (Deny - Blocked Pattern)

```json
{
  "decision_id": "dec_xyz790",
  "policy_id": "system.command.execute.v1",
  "passport_id": "pass_abc123",
  "owner_id": "org_12345",
  "assurance_level": "L2",
  "allow": false,
  "reasons": [{
    "code": "oap.blocked_pattern",
    "message": "Command contains blocked pattern: 'sudo'"
  }],
  "issued_at": "2026-02-14T22:00:00Z",
  "expires_at": "2026-02-14T22:01:00Z",
  "passport_digest": "sha256:...",
  "signature": "ed25519:...",
  "kid": "oap:registry:key-2026-02"
}
```

## Security Best Practices

1. **Minimal Allowlist**: Only allow commands absolutely necessary for the agent's purpose
2. **Block Dangerous Patterns**: Always block `rm -rf`, `sudo`, privilege escalation attempts
3. **Time Limits**: Set conservative execution time limits to prevent runaway processes
4. **Directory Restrictions**: Limit working directories to agent workspace
5. **Audit Logging**: Log all command executions for security review
6. **Progressive Limits**: Start with strict limits and relax gradually based on behavior
7. **MCP Integration**: Use MCP session tracking for cross-tool audit trails
8. **Status Webhooks**: Subscribe to passport status changes for instant revocation

## Error Codes

- `oap.passport_suspended`: Passport is not active
- `oap.unknown_capability`: Missing system.command.execute capability
- `oap.command_not_allowed`: Command not in allowlist
- `oap.blocked_pattern`: Command contains blocked pattern
- `oap.limit_exceeded`: Execution time exceeds limit
- `oap.directory_not_allowed`: Working directory not allowed

## Integration Examples

### Express.js (Node.js)

```javascript
const { exec } = require('child_process');
const axios = require('axios');

async function executeCommand(passport, command, args) {
  const context = {
    command,
    args,
    cwd: process.cwd(),
    timeout: 120
  };

  // Check policy
  const decision = await axios.post('https://api.aport.io/v1/decide', {
    passport_id: passport.passport_id,
    policy_id: 'system.command.execute.v1',
    context
  });

  if (!decision.data.allow) {
    throw new Error(`Command blocked: ${decision.data.reasons[0].message}`);
  }

  // Execute command
  return new Promise((resolve, reject) => {
    exec(`${command} ${args.join(' ')}`, {
      cwd: context.cwd,
      timeout: context.timeout * 1000
    }, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve({ stdout, stderr });
    });
  });
}
```

### Python (FastAPI)

```python
import subprocess
import httpx

async def execute_command(passport: dict, command: str, args: list):
    context = {
        "command": command,
        "args": args,
        "cwd": "/workspace",
        "timeout": 120
    }

    # Check policy
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.aport.io/v1/decide",
            json={
                "passport_id": passport["passport_id"],
                "policy_id": "system.command.execute.v1",
                "context": context
            }
        )
        decision = response.json()

    if not decision["allow"]:
        raise PermissionError(f"Command blocked: {decision['reasons'][0]['message']}")

    # Execute command
    result = subprocess.run(
        [command] + args,
        cwd=context["cwd"],
        timeout=context["timeout"],
        capture_output=True,
        text=True
    )

    return {
        "stdout": result.stdout,
        "stderr": result.stderr,
        "returncode": result.returncode
    }
```

## Version History

- **v1.0.0** (2026-02-14): Initial release

## References

- [OAP Specification](https://github.com/aporthq/aport-spec)
- [Policy Pack Guidelines](https://github.com/aporthq/aport-policies/blob/main/GUIDELINES.md)
