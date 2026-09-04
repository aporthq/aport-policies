# Repository Policy Pack v1

## Overview

The `code.repository.merge.v1` policy pack protects repository operations with PR limits, merge controls, and path restrictions. This provides dev-first PR safety controls to prevent spammy or oversized PRs from agents while enabling legitimate code automation.

## Policy Requirements

| **Requirement** | **Value** | **Description** |
|-----------------|-----------|-----------------|
| **Capability** | Action-dependent | `pr.create` and `pr.update` require `repo.pr.create`; `pr.merge` requires `repo.merge`; `repo.push` requires explicit `repo.push` |
| **Assurance** | L2+ (GitHub Verified) | Minimum assurance level required |
| **Limits** | PR/merge daily caps, size limits | Required operational limits |

## Supported Actions

- **`pr.create`**: creates a pull request and consumes the daily PR-create counter.
- **`pr.update`**: updates or reconciles an existing pull request without consuming the daily PR-create counter.
- **`pr.merge`**: merges a pull request and consumes the daily merge counter.
- **`repo.push`**: records a repository push or branch update. Hosted GitHub repository guard passports do not receive this capability by default; teams must opt in explicitly before direct pushes can receive signed allow decisions.
- Legacy aliases such as `push`, `pull_request.create`, `pull_request.update`, `repo.merge`, `branch.create`, and `branch.delete` are accepted for backward compatibility.

## Limits Configuration

### Required Limits

- **`max_prs_per_day`**: Maximum PRs created per day (1-100)
- **`max_merges_per_day`**: Maximum merges per day (1-100)  
- **`max_pr_size_kb`**: Maximum PR size in KB (1-10240)

### PR Creation Parameters

- **`allowed_repos`**: Comma-separated list of allowed repositories. Supports exact values, `*`, and `**` patterns such as `aporthq/*`.
- **`allowed_base_branches`**: Comma-separated list of allowed base branches (main, develop)
- **`path_allowlist` / `allowed_paths`**: Comma-separated list of allowed file paths/patterns. Supports exact values, `*`, and `**`.
- **`max_files_changed`**: Maximum number of files that can be changed in one PR
- **`max_total_added_lines`**: Maximum total lines that can be added in one PR

### Merge Parameters

- **`allowed_repos`**: Comma-separated list of allowed repositories for merging. Supports exact values, `*`, and `**` patterns.
- **`allowed_base_branches`**: Comma-separated list of allowed base branches for merging
- **`path_allowlist`**: Comma-separated list of allowed file paths for merging

Review counts and required labels should be enforced with GitHub branch
protection or repository rules. APort records repository action evidence and
enforces passport-scoped repository, branch, path, and size limits.

### GitHub Actor/App Allowlist

If `passport.integrations.github.allowed_actors` or `passport.integrations.github.allowed_apps` is configured, the request must include a matching `github_actor` or GitHub App slug. If no allowlist is configured, the policy does not deny by default based on actor naming.

## Example Usage

### Express.js - PR Creation

```javascript
const { requirePolicy } = require("@aporthq/middleware-express");

app.post("/repo/pr", requirePolicy("code.repository.merge.v1"), async (req, res) => {
  const { repo, base_branch, head_branch, title, files_changed } = req.body;
  const passport = req.policyResult.passport;

  // Policy automatically enforces:
  // - Repository allowlist validation
  // - Base branch restrictions
  // - File count and line limits
  // - Path allowlist checking
  // - Daily PR limits
  // - Assurance level (L2+)

  const pr_id = await createPullRequest({
    repo,
    base_branch,
    head_branch,
    title,
    files_changed,
    agent_id: passport.agent_id,
  });

  res.json({ success: true, pr_id });
});
```

### Express.js - PR Merging

```javascript
app.post("/repo/merge", requirePolicy("code.repository.merge.v1"), async (req, res) => {
  const { repo, pr_id, merge_method } = req.body;
  const passport = req.policyResult.passport;

  // Policy automatically enforces:
  // - Repository and branch allowlists
  // - PR size limits
  // - Daily merge limits

  const merge_result = await mergePullRequest({
    repo,
    pr_id,
    merge_method,
    agent_id: passport.agent_id,
  });

  res.json({ success: true, merge_sha: merge_result.sha });
});
```

## Policy Violations

### Repository Not Allowed

```json
{
  "error": "repo_policy_violation",
  "reason": "repository_not_allowlisted",
  "repo": "sensitive-repo",
  "allowed_repos": ["public-repo", "docs-repo"],
  "upgrade_instructions": "Add 'sensitive-repo' to your passport's allowed_repos parameter"
}
```

### PR Too Large

```json
{
  "error": "repo_policy_violation",
  "reason": "pr_size_exceeded",
  "size_kb": 2048,
  "limit_kb": 1024,
  "files_changed": 45,
  "lines_added": 1500
}
```

### Daily Limit Exceeded

```json
{
  "error": "repo_policy_violation",
  "reason": "daily_limit_exceeded",
  "limit_type": "pr_creation",
  "current_usage": 10,
  "limit": 10,
  "reset_time": "2025-01-17T00:00:00Z"
}
```

## Best Practices

### PR Creation

1. **Repository Allowlists**: Restrict access to specific repositories
2. **Branch Protection**: Limit PRs to specific base branches (main, develop)
3. **Size Limits**: Prevent oversized PRs that are hard to review
4. **Path Restrictions**: Use path allowlists to restrict file access
5. **Rate Limiting**: Prevent PR spam with daily limits

### Merging

1. **GitHub Branch Protection**: Enforce minimum review counts in GitHub
2. **Repository Rules**: Require labels or status checks in GitHub where needed
3. **APort Branch Limits**: Restrict which base branches an agent may target
4. **Size Validation**: Ensure PRs aren't too large to review safely
5. **Verifiable Attestation**: Log all merge operations

### Security

1. **Protected Branches**: Use L3 assurance for production merges
2. **Code Review**: Always require human review for merges
3. **Path Restrictions**: Prevent access to sensitive files/directories
4. **Webhook Integration**: Subscribe to status webhooks for instant suspend
5. **Verifiable Attestation**: Comprehensive logging of all repository operations

### GitHub Integration

```javascript
// Example GitHub-specific implementation
async function createPullRequest({ repo, base_branch, head_branch, title, files_changed, agent_id }) {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  
  const pr = await octokit.rest.pulls.create({
    owner: "your-org",
    repo: repo,
    title: title,
    head: head_branch,
    base: base_branch,
    body: `Created by AI Agent ${agent_id}\n\nFiles changed: ${files_changed.length}`,
  });
  
  return pr.data.number;
}
```

## Why This Policy Pack?

- **Developer Safety**: Prevents spammy or oversized PRs that harm code quality
- **Production Ready**: Serious governance controls for production environments
- **GitHub Demo**: Perfect for demonstrating AI code automation with safety
- **Scalable**: Works with any Git platform (GitHub, GitLab, Bitbucket)
- **Compliance**: Built-in Verifiable Attestation for repository operations

## Integration Examples

- **Code Generation**: AI agents creating PRs with safety limits
- **Documentation Updates**: Automated doc updates with repository/path limits
- **Dependency Updates**: Automated dependency PRs with size limits
- **Bug Fixes**: AI-generated bug fixes with human review
- **Feature Development**: Controlled AI feature development with governance


## Required Context

This policy requires the following context (JSON Schema):

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": [
    "repository",
    "action",
    "branch"
  ],
  "properties": {
    "repository": {
      "type": "string",
      "pattern": "^[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+$",
      "description": "Repository in owner/repo format"
    },
    "action": {
      "type": "string",
      "enum": [
        "pr.create",
        "pr.merge",
        "pr.update",
        "repo.push",
        "push",
        "pull_request.create",
        "pull_request.update",
        "repo.merge",
        "branch.create",
        "branch.delete"
      ],
      "description": "Repository action being performed"
    },
    "branch": {
      "type": "string",
      "minLength": 1,
      "description": "Target branch name"
    },
    "base_branch": {
      "type": "string",
      "description": "Base branch for PR operations"
    },
    "title": {
      "type": "string",
      "maxLength": 200,
      "description": "PR or commit title"
    },
    "description": {
      "type": "string",
      "maxLength": 5000,
      "description": "PR or commit description"
    },
    "files_changed": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "List of files being changed"
    },
    "lines_added": {
      "type": "integer",
      "minimum": 0,
      "description": "Number of lines added"
    },
    "lines_removed": {
      "type": "integer",
      "minimum": 0,
      "description": "Number of lines removed"
    }
  }
}
```

You can also fetch this live via the discovery endpoint:

```bash
curl -s "https://aport.io/api/policies/code.repository.merge.v1?format=schema"
```
