# deliverable.task.complete.v1

Task Completion Gate. Pre-action governance for an agent marking a task complete.

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
| `task_id` | string, 1 to 256 chars | Yes |
| `output_type` | "code" \| "document" \| "analysis" \| "plan" \| "data" \| "other" | Yes |
| `criteria_attestations` | array of `{ criterion_id, met, evidence }`, at most 100 entries | Yes |
| `summary` | string, max 10000 chars | If `require_summary` |
| `tests_passing` | boolean | If `require_tests_passing` |
| `reviewer_agent_id` | string | If `require_different_reviewer` |
| `author_agent_id` | string | If `require_different_reviewer` |
| `output_content` | string, max 10 MB in the schema; see hosted request-size note below | If `scan_output` and scanning |

Each attestation: `criterion_id` (string), `met` (JSON boolean), `evidence` (string, 1 to 2000 chars). `met` must be the boolean `true`, not the string `"true"`. See "Type coercion on the hosted route" below for how the two layers treat a string.

Hosted route request-size note: `POST /api/verify/policy/deliverable.task.complete.v1` calls the shared request-size preflight before parsing JSON. For SDKs and curl-style clients that send `Content-Length`, the current effective limit is the default 10 KB whole request, so the 10 MB `output_content` schema bound is not reachable on that hosted path unless the route-level limit is raised. Treat hosted `output_content` as a small excerpt or omit it and rely on other evidence; the 10 MB field bound remains a schema declaration, not the practical hosted upload size today.

The sizes and ranges in that table are the declared context schema. On the hosted route,
the request-size preflight may reject the whole request before these context-schema bounds are
checked; when a request reaches context validation, that hosted route is the only path here that turns
those bounds into a rejection. `criteria_attestations` now carries `"maxItems": 100` in
`policy.json`'s `required_context` to match the route's `Joi.array().max(100)`, so the two schemas no
longer disagree on paper, but the in-repo evaluator does not apply either. Its schema step is
`validatePolicyFields` in `functions/utils/policy/validation.ts`, which reads `required_fields` and
checks presence only; `maxItems`, `maxLength` and the `output_type` enum are never evaluated there. A
101-entry array sent straight to `evaluateGenericPolicy` is still allowed, verified by running one. So
the cap is real on `POST /api/verify/policy/deliverable.task.complete.v1` and advisory on the in-repo
path; treat it as a contract you should honour rather than a bound the local evaluator will hold you
to.

## Where acceptance criteria live

Criteria are per passport, not per task. The policy reads them from
`limits["deliverable.task.complete"].acceptance_criteria` on the passport being evaluated. The
evaluator (`functions/utils/policy/generic-evaluator.ts`, `evaluateCustomRules`) builds the `limits`
scope from `passport.limits` only. Nothing from the request context is merged into limits, so there is
no context-level override of `acceptance_criteria` today. A `criteria_attestations` field is the only
place criteria appear in the request, and it can only answer criteria, not define them.

Two details of the rules that matter when criteria change per task:

- If the passport has no `acceptance_criteria` (absent or an empty array), rule
  `all_passport_criteria_attested` passes, and `criteria_attestations: []` is allowed. The evidence,
  `met`, summary, tests, reviewer and pattern rules still run.
- An attestation whose `criterion_id` is not in the passport does not cause a deny on its own, and
  does not stand in for a missing one. It still has to carry `met: true` and non-empty evidence.

Patterns that work today:

1. One passport per task type, with fixed criteria. Give the "docs agent" passport docs criteria and
   the "backend agent" passport code criteria. Verify with `context.agent_id` (cloud mode) and the
   registry passport is used.
2. Caller supplies the passport in the request (local mode). The hosted endpoint accepts a `passport`
   object in the body in place of `context.agent_id`. The route requires `passport.agent_id` and
   `passport.owner_id`, evaluates the passport exactly as sent, and writes no decision record or audit
   log for local mode. A caller whose criteria come from a per-task PRD can build the limits fragment
   from the PRD and send it this way. The decision is then only as trustworthy as the caller that
   built the passport: this reuses the rules, it does not prove the criteria came from the registry.
3. Caller runs the in-repo evaluator directly (see "In-repo evaluator" below). Same trust caveat.

Not supported today: criteria in `context`, or any per-request field that overrides passport limits.

## Evaluating outside the hosted API

### Hosted call

```
POST https://api.aport.io/api/verify/policy/deliverable.task.complete.v1
Content-Type: application/json
Authorization: Bearer <token>      # optional, see below
```

Authentication is optional on this route. If a credential is present it must be valid, or the request
fails with 401. Accepted forms: `Authorization: Bearer <token>` or `X-API-Key: <key>`. API keys need
the `read` scope. Requests are rate limited per client IP whether or not they are authenticated.

Request body, cloud mode (passport fetched from the registry by `agent_id`):

```json
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
    ],
    "idempotency_key": "task-123-attempt-1"
  }
}
```

`idempotency_key` is optional and lives inside `context`. Local mode is the same body plus a top-level
`passport` object; `context.agent_id` may then be omitted, or must equal `passport.agent_id`.

Response, HTTP 200:

```json
{
  "decision": {
    "decision_id": "dec_...",
    "created_at": "2026-09-23T10:30:00.000Z",
    "issued_at": "2026-09-23T10:30:00.000Z",
    "expires_at": "2026-09-23T11:30:00.000Z",
    "expires_in": 3600,
    "allow": true,
    "reasons": [
      { "code": "oap.allowed", "message": "All policy checks passed", "severity": "info" }
    ],
    "policy_id": "deliverable.task.complete.v1",
    "agent_id": "ap_xxx",
    "passport_id": "ap_xxx",
    "owner_id": "ap_org_xxx",
    "assurance_level": "L1",
    "passport_digest": "sha256:...",
    "signature": "ed25519:...",
    "kid": "oap:registry:..."
  },
  "request_id": "...",
  "performance": { "...": "..." },
  "auth": { "authenticated": false, "user_id": null, "turnstile_verified": null }
}
```

Read `decision.allow` and `decision.reasons[]`. A deny is also HTTP 200, with `allow: false`, `expires_in: 60`,
and exactly one reason `{ code, message, severity: "error" }`. Evaluation stops at the first failing
rule, so a deny names one problem; fix it and resubmit. The failing `criterion_id` is not included in
the response (validator details are not carried into the decision), so the agent has to find it from
its own receipt.

There is one route-level exception before evaluation: a hosted passport, or a passport supplied in the
request body, whose status is not `active` returns HTTP 403 with `error: "agent_suspended"`. That
response has no `decision` object and is not signed, because the evaluator is not reached.

Requests that fail the context schema never reach the evaluator. The route returns HTTP 400:

```json
{
  "error": "context_validation_failed",
  "message": "Context validation failed",
  "request_id": "...",
  "required_context_errors": [
    { "path": "criteria_attestations.0.met", "message": "...", "type": "boolean.base" }
  ]
}
```

This covers a missing `task_id`, `output_type` or `criteria_attestations`, an `output_type` outside the
enum, more than 100 attestations, empty or over-long evidence, and a `met` that is not a boolean.

#### Type coercion on the hosted route

The route validates `context` with Joi using `convert: true`. `Joi.boolean()` converts the strings
`"true"` and `"false"` to booleans before the evaluator runs, while values like `1` or `"yes"` are
rejected with the 400 above. The evaluator itself checks `met !== true` and `tests_passing !== true`
strictly. Both strict checks are covered in
`tests/deliverable-task-complete-policy.test.ts`: test 9b sends `tests_passing: "true"`, and tests 2b
and 2c send `met: "true"` and `met: 1`. Two tests are needed for `met` rather than one, because the two
plausible loosenings fail differently: `a.met != true` still denies the string (`"true" != true` is
true, since the string coerces to `NaN`) and is caught only by 2c, while `!a.met` is caught by both.
Send a JSON boolean and neither layer matters.

SDK helpers that call this endpoint: `@aporthq/sdk-node` `PolicyVerifier.verifyDeliverableTaskComplete(agentId, context, idempotencyKey?)`
(`sdk/node/src/thin-client.ts`) and the Python SDK's `verify_deliverable_task_complete(agent_id, context, idempotency_key=None)`
(`sdk/python/README.md`).

### No published local evaluator

`@aporthq/aport-agent-guardrails` does not implement this policy. Its tool-to-pack mapping
(`packages/core/src/core/tool-pack-mapping.json`) covers 14 packs (`system.command.execute.v1`,
`data.file.write.v1`, `code.repository.merge.v1`, `web.fetch.v1` and others) and does not include
`deliverable.task.complete.v1`. Its `mode: api` path posts to the hosted endpoint above; its local mode
runs a bash guardrail script with no deliverable rules. The only occurrences of "deliverable" in that
repository are in its vendored copy of this `policies/` directory.

### In-repo evaluator (in-repo only, not a published package)

The unit tests call the generic evaluator directly, without the API:

```ts
import { evaluateGenericPolicy } from "./functions/utils/policy/generic-evaluator";

const decision = await evaluateGenericPolicy(
  {} as any,                         // env: only needed by DB-backed validators, none here
  "deliverable.task.complete.v1",
  passport,                          // PassportData with limits["deliverable.task.complete"]
  context,                           // task_id, output_type, criteria_attestations, ...
  undefined,                         // idempotency key
  { skipSigning: true },
);
// decision.allow, decision.reasons[0].code
```

This resolves the pack from the in-repo registry and needs the repository's TypeScript sources,
`types/passport.ts` included. It is not exported from any npm package. It also skips the route's Joi
validation, so the strict `met !== true` check is the only type check on this path.

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

`acceptance_criteria` is the only registered limit that is an array of objects, `[{ id, description }]`.
Other limits are usually scalars or string arrays, and some are nested objects: `payments.charge` takes
`currency_limits`, keyed by currency code, with a `max_per_tx` under each. An array of objects is what
is unique here, not nesting.

Validator details worth knowing:

- `min_summary_words` defaults to 10 when `require_summary` is true and the field is absent. Words are
  counted by trimming and splitting on single spaces.
- `blocked_patterns` matching is a case-insensitive substring match on `output_content`. The scan only
  runs when `scan_output` is true and `output_content` is present; omitting `output_content` skips it.
- `blocked_patterns` is in passport limits (not API context). At evaluation, only the first 100
  patterns are checked; passports with more are truncated silently. Passport issuance APIs may
  validate this; the validator caps at 100 for DoS protection.

## Security Rationale (Validator Design)

- **`met !== true` (strict).** Strict equality, not truthy `!met`. PRD v1.2 fix: `met: "true"` or
  `met: 1` must not pass the evaluator; only `met: true` is valid. (The hosted route converts the
  string `"true"` before evaluation; see "Type coercion on the hosted route".)
- **Missing `author_agent_id` denies.** When `require_different_reviewer` is true, both
  `reviewer_agent_id` and `author_agent_id` must be present. Omitting `author_agent_id` would bypass
  the cross-agent check; we intentionally deny instead of skipping.
- **Custom validators over expressions.** Safer `undefined` handling and no expression-engine quirks.
  Expressions can mis-evaluate empty strings or `undefined`; validators give explicit control over
  deny codes.

## Evaluation Order

The generic evaluator checks, in order: passport status, presence of the required context fields,
capability, then the policy rules in the order they appear in `policy.json`. The first failure is the
deny code you get back.

1. `all_passport_criteria_attested` (`oap.criteria_incomplete`)
2. `all_criteria_have_evidence` (`oap.evidence_missing`)
3. `all_criteria_attested` (`oap.criteria_not_met`)
4. `summary_required` (`oap.summary_insufficient`)
5. `tests_passing_required` (`oap.tests_not_passing`)
6. `different_reviewer_required` (`oap.self_review_not_allowed`)
7. `no_blocked_patterns` (`oap.blocked_pattern_detected`)

So a receipt that is missing one attestation and has empty evidence on another gets
`oap.criteria_incomplete` first.

## Deny Codes

The deny code is meant to tell the agent what is missing so it can correct the receipt and retry.

| Code | Meaning | What the agent should do |
|------|---------|--------------------------|
| `oap.passport_suspended` | Passport status is not active | Stop. Nothing in the receipt fixes this; the passport owner has to reactivate it. |
| `oap.invalid_context` | A required field (`task_id`, `output_type`, `criteria_attestations`) is missing. On the hosted route this is usually caught earlier as HTTP 400 `context_validation_failed`. | Add the missing field and resubmit. |
| `oap.unknown_capability` | Passport does not list `deliverable.task.complete` | Stop. The passport needs the capability added. |
| `oap.criteria_incomplete` | At least one `id` in the passport's `acceptance_criteria` has no attestation | Add an attestation for every passport criterion, including ones not met. Compare the passport's `acceptance_criteria` ids to the receipt. Not raised when the passport has no criteria. |
| `oap.evidence_missing` | An attestation's `evidence` is missing, empty, or whitespace | Fill in concrete evidence for each attestation: CI run id, file path, command output, PR URL. |
| `oap.criteria_not_met` | An attestation has `met` that is not boolean `true` | Do the work for that criterion, then re-attest with `met: true`. The response does not name the criterion; find the `met: false` entry in your receipt. |
| `oap.summary_insufficient` | `require_summary` is on and `summary` is absent, not a string, or below `min_summary_words` | Write a summary of at least `min_summary_words` words (default 10) describing what was done. |
| `oap.tests_not_passing` | `require_tests_passing` is on and `tests_passing` is not boolean `true` (false, missing, or a string) | Fix the failing tests, run them, then resubmit with `tests_passing: true`. |
| `oap.self_review_not_allowed` | `require_different_reviewer` is on and either id is missing or the two ids are equal | Get a review from a different agent and submit both `reviewer_agent_id` and `author_agent_id`. |
| `oap.blocked_pattern_detected` | `scan_output` is on and `output_content` contains a blocked pattern (case-insensitive) | Remove the pattern named in the message from the output, then resubmit. Or omit `output_content` if the passport owner accepts an unscanned completion; the scan is skipped when it is absent. |

## Worked Example

A PRD for task `AUTH-142` (OAuth2 refresh token rotation) defines three criteria:

| id | Given / When / Then |
|----|---------------------|
| `refresh_rotates_token` | Given a valid refresh token, when `POST /oauth/token` is called with `grant_type=refresh_token`, then a new access token and a new refresh token are returned and the old refresh token no longer works. |
| `expired_refresh_rejected` | Given an expired refresh token, when it is used, then the API returns 401 with `error=invalid_grant`. |
| `docs_updated` | Given the change, when the docs are built, then `docs/auth.md` describes the refresh flow. |

Passport limits fragment for the agent that will complete `AUTH-142`:

```json
{
  "limits": {
    "deliverable.task.complete": {
      "require_summary": true,
      "min_summary_words": 20,
      "require_tests_passing": true,
      "acceptance_criteria": [
        { "id": "refresh_rotates_token", "description": "Given a valid refresh token, when POST /oauth/token is called with grant_type=refresh_token, then a new access token and a new refresh token are returned and the old refresh token no longer works" },
        { "id": "expired_refresh_rejected", "description": "Given an expired refresh token, when it is used, then the API returns 401 with error=invalid_grant" },
        { "id": "docs_updated", "description": "Given the change, when the docs are built, then docs/auth.md describes the refresh flow" }
      ]
    }
  }
}
```

Completion receipt the agent leaves in the PR body (the daemon lifts the JSON block out and sends it
as `context`):

```json
{
  "agent_id": "ap_auth_agent",
  "task_id": "AUTH-142",
  "output_type": "code",
  "summary": "Added refresh token rotation to the OAuth2 token endpoint. Each refresh issues a new token pair and revokes the old refresh token. Expired refresh tokens now return 401 invalid_grant. Added four tests and updated docs/auth.md.",
  "tests_passing": true,
  "criteria_attestations": [
    { "criterion_id": "refresh_rotates_token", "met": true, "evidence": "test/oauth/refresh.test.ts 'rotates refresh token and revokes old one' passed in CI run 8813 (https://ci.example.com/runs/8813)" },
    { "criterion_id": "expired_refresh_rejected", "met": true, "evidence": "test/oauth/refresh.test.ts 'expired refresh token returns 401 invalid_grant' passed in CI run 8813" },
    { "criterion_id": "docs_updated", "met": true, "evidence": "docs/auth.md section 'Refreshing tokens' added in PR #212, commit 4f1c9e2" }
  ]
}
```

Allow response (fields other than `decision.allow` and `decision.reasons` shortened):

```json
{
  "decision": {
    "decision_id": "dec_...",
    "allow": true,
    "reasons": [
      { "code": "oap.allowed", "message": "All policy checks passed", "severity": "info" }
    ],
    "expires_in": 3600,
    "policy_id": "deliverable.task.complete.v1",
    "agent_id": "ap_auth_agent"
  },
  "request_id": "..."
}
```

Same receipt, but the docs were not written and the agent says so:

```json
{ "criterion_id": "docs_updated", "met": false, "evidence": "docs/auth.md not yet updated" }
```

Deny response:

```json
{
  "decision": {
    "decision_id": "dec_...",
    "allow": false,
    "reasons": [
      { "code": "oap.criteria_not_met", "message": "One or more acceptance criteria were not met", "severity": "error" }
    ],
    "expires_in": 60,
    "policy_id": "deliverable.task.complete.v1",
    "agent_id": "ap_auth_agent"
  },
  "request_id": "..."
}
```

The daemon leaves the PR as a draft. The agent finds the `met: false` entry, writes the docs, re-attests
with `met: true` and real evidence, and the daemon re-verifies. If the agent had instead dropped the
`docs_updated` attestation from the receipt, the code would be `oap.criteria_incomplete`, because the
passport still lists that criterion.

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
