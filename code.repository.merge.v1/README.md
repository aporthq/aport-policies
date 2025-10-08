# Repository Policy Pack v1

## Overview

The `code.repository.merge.v1` policy pack protects repository operations with PR limits, merge controls, and path restrictions. This provides dev-first PR safety controls to prevent spammy or oversized PRs from agents while enabling legitimate code automation.

## Policy Requirements

| **Requirement** | **Value** | **Description** |
|-----------------|-----------|-----------------|
| **Capability** | `repo.pr.create`, `repo.merge` | Agent must have repository capabilities |
| **Assurance** | L2+ (GitHub Verified) | Minimum assurance level required |
| **Limits** | PR/merge daily caps, size limits | Required operational limits |

## Limits Configuration

### Required Limits

- **`max_prs_per_day`**: Maximum PRs created per day (1-100)
- **`max_merges_per_day`**: Maximum merges per day (1-100)  
- **`max_pr_size_kb`**: Maximum PR size in KB (1-10240)

### PR Creation Parameters

- **`allowed_repos`**: Comma-separated list of allowed repositories
- **`allowed_base_branches`**: Comma-separated list of allowed base branches (main, develop)
- **`path_allowlist`**: Comma-separated list of allowed file paths/patterns
- **`max_files_changed`**: Maximum number of files that can be changed in one PR
- **`max_total_added_lines`**: Maximum total lines that can be added in one PR

### Merge Parameters

- **`allowed_repos`**: Comma-separated list of allowed repositories for merging
- **`allowed_base_branches`**: Comma-separated list of allowed base branches for merging
- **`required_labels`**: Comma-separated list of required PR labels for merging
- **`required_reviews`**: Minimum number of required reviews for merging
- **`path_allowlist`**: Comma-separated list of allowed file paths for merging

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
  // - Required labels checking
  // - Required reviews validation
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

### Insufficient Reviews

```json
{
  "error": "repo_policy_violation",
  "reason": "insufficient_reviews",
  "required_reviews": 2,
  "current_reviews": 1,
  "required_labels": ["approved", "security-reviewed"],
  "missing_labels": ["security-reviewed"]
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

1. **Review Requirements**: Enforce minimum review counts
2. **Label Requirements**: Require specific labels (approved, tested)
3. **Branch Protection**: Protect critical branches (main, production)
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
- **Compliance**: Built-in Verifiable Attestation and approval workflows

## Integration Examples

- **Code Generation**: AI agents creating PRs with safety limits
- **Documentation Updates**: Automated doc updates with review requirements
- **Dependency Updates**: Automated dependency PRs with size limits
- **Bug Fixes**: AI-generated bug fixes with human review
- **Feature Development**: Controlled AI feature development with governance

