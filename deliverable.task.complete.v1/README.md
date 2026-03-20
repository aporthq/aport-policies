# deliverable.task.complete.v1

Task Completion Gate — pre-action governance for an agent marking a task complete.

## Purpose

Enforces that the agent has provided required deliverable evidence before "done" is authorized:

- Summary (optional, configurable min word count)
- Acceptance criteria attestations (one per passport-defined criterion, with evidence)
- Test status (optional, require passing tests)
- Reviewer identity (optional, require different agent for multi-agent pipelines)
- Output scan (optional, block patterns like TODO, FIXME)

## Required Context

| Field | Type | Required |
|-------|------|----------|
| `task_id` | string | Yes |
| `output_type` | "code" \| "document" \| "analysis" \| "plan" \| "data" \| "other" | Yes |
| `criteria_attestations` | array of `{ criterion_id, met, evidence }` | Yes |
| `summary` | string | If `require_summary` |
| `tests_passing` | boolean | If `require_tests_passing` |
| `reviewer_agent_id` | string | If `require_different_reviewer` |
| `author_agent_id` | string | If `require_different_reviewer` |
| `output_content` | string | If `scan_output` and scanning |

## Passport Limits

Configure under `limits["deliverable.task.complete"]`:

```json
{
  "require_summary": true,
  "min_summary_words": 20,
  "require_tests_passing": false,
  "require_different_reviewer": false,
  "scan_output": false,
  "blocked_patterns": [],
  "acceptance_criteria": [
    { "id": "output_produced", "description": "A concrete output artifact must be produced" },
    { "id": "no_placeholders", "description": "Output must not contain TODO, FIXME, or placeholder text" }
  ]
}
```

**Note:** `blocked_patterns` is in passport limits (not API context). At evaluation, only the first 100 patterns are checked; passports with more are truncated silently. Passport issuance APIs may validate this; the validator caps at 100 for DoS protection.

## Security Rationale (Validator Design)

- **`met !== true` (strict)** — We use strict equality, not truthy `!met`. PRD v1.2 fix: `met: "true"` or `met: 1` must not pass; only `met: true` is valid.
- **Missing `author_agent_id` → deny** — When `require_different_reviewer` is true, both `reviewer_agent_id` and `author_agent_id` must be present. Omitting `author_agent_id` would bypass the cross-agent check; we intentionally deny instead of skipping.
- **Custom validators over expressions** — Safer `undefined` handling and no expression-engine quirks. Expressions can mis-evaluate empty strings or `undefined`; validators give explicit control over deny codes.

## Deny Codes

| Code | Meaning |
|------|---------|
| `oap.criteria_not_met` | An attestation has `met: false` |
| `oap.evidence_missing` | An attestation has empty evidence |
| `oap.criteria_incomplete` | Missing attestation for a passport criterion |
| `oap.summary_insufficient` | Summary absent or below `min_summary_words` |
| `oap.tests_not_passing` | `tests_passing` required but false or missing |
| `oap.self_review_not_allowed` | Same agent for reviewer and author, or either missing |
| `oap.blocked_pattern_detected` | Output contains a blocked pattern |

## Verification

```bash
POST /api/verify/policy/deliverable.task.complete.v1
Content-Type: application/json

{
  "context": {
    "agent_id": "ap_xxx",
    "task_id": "task-123",
    "output_type": "code",
    "author_agent_id": "ap_xxx",
    "summary": "Implemented OAuth2 refresh token flow...",
    "tests_passing": true,
    "criteria_attestations": [
      { "criterion_id": "output_produced", "met": true, "evidence": "PR #47" },
      { "criterion_id": "no_placeholders", "met": true, "evidence": "grep -r TODO src/ returned 0" }
    ]
  }
}
```

## Tests

Run unit tests:

```bash
pnpm test:unit policies/deliverable.task.complete.v1/tests/deliverable-task-complete-policy.test.ts
```
