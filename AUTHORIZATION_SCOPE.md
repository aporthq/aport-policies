# Customer and resource authorization scope

An agent passport identifies the agent and limits its actions. It does not identify
the human asking the agent for help. For a support agent, the application must
also bind each request to the customer and resource it actually concerns.

## One passport, different customers

The hosted policy verification endpoint supports an optional root-level
`limits.authorization_scope` constraint. It runs before the selected evaluator,
including registered manual, generic, and custom `IN_BODY` policies. It does not
grant a capability, replace payment limits, or bypass other policy checks.

For example, add these bindings to an agent passport's existing limits without
replacing its other limits:

```json
{
  "authorization_scope": {
    "bindings": [
      {
        "policies": ["governance.data.access.v1"],
        "subject_path": "accessing_entity_id",
        "resource_path": "resource_attributes.customer_id"
      },
      {
        "policies": ["finance.payment.refund.v1"],
        "subject_path": "requester.customer_id",
        "resource_path": "customer_id"
      }
    ]
  }
}
```

The data access request then includes:

```json
{
  "context": {
    "agent_id": "ap_support_agent",
    "accessing_entity_id": "CUS104",
    "accessing_entity_type": "client",
    "resource_id": "CASE205",
    "resource_attributes": { "customer_id": "CUS205" },
    "data_classification": "PII",
    "action_type": "read"
  }
}
```

This request is denied with `oap.authorization_scope_mismatch`. A request whose
resource customer is `CUS104` passes this precheck, but must still pass the data
policy's capabilities, assurance and limits. A refund uses the same mechanism:
the backend supplies `requester.customer_id` from the authenticated session and
`customer_id` from the actual order. The existing refund amount, currency, reason,
order and idempotency requirements still apply.

## The backend is the trust boundary

1. Authenticate the customer through the application's existing session system.
2. Resolve the requested record or order on the server. Read its owning customer
   from authoritative storage. Do not expose its sensitive contents yet.
3. Construct verification context from those facts, not from a model-provided
   customer ID, `authorized` flag, or copied request-body ownership metadata.
4. Call `POST /api/verify/policy/:pack_id` with a backend API key owned by the
   passport's owner. Keep the key outside the model and browser.
5. Execute only the same action checked in that call, only after a valid ALLOW.
   Fail closed on errors and keep the application's own access controls.

APort authenticates the backend and evaluates the comparison. It does not query
the CRM or prove that supplied ownership facts are true. For tenant isolation,
add another binding comparing a backend-derived tenant ID to the resource tenant
ID. All matching bindings must pass. Scope equality is not a relationship graph
or a replacement for the application's identity provider.

The current decision signature does not bind arbitrary request context. Do not
accept a receipt supplied by a browser or model as permission for a later action.
Keep the ALLOW associated with its original server-side request; do not reuse it
for another customer, order, amount or resource. If ownership can change between
check and action, revalidate it inside the application's transaction.

## Configuration and compatibility

- Bindings select exact policy IDs; `"*"` explicitly selects every policy.
- The subject must be a nonempty string. The resource may be a string or 1-1,000
  strings. Every resource ID must equal the subject, not just one item.
- Missing or malformed identifiers deny. Invalid scope configuration denies.
- A valid configuration with no binding for the selected policy has no effect.
  Passports without `authorization_scope` retain their existing behavior,
  including anonymous verification where already supported.
- Matching hosted requests require a passport-owner API key. Browser sessions,
  unrelated keys and caller-provided trust flags do not attest external facts.
- Paths use up to six own-property segments, with no prototype access or
  expressions. The configuration accepts 1-16 bindings and up to 32 selectors
  each. The root limits validator and passport JSON Schema publish this shape.
- Paths are relative to policy context. Resources are read from the context that
  survives that policy's validation. Strict schemas still reject unknown fields;
  this feature does not turn off validation or invent new accepted tool fields.
- Caller-supplied passports are evaluated as unsigned local simulations. They
  are not proof of owner identity or deployable substitutes for hosted decisions.
- This gate belongs to the hosted verify endpoint. Calling an evaluator helper
  directly, or using an offline guardrail, does not automatically enforce it.
  Integrations must use this endpoint or explicitly implement the same contract.

The check performs no network or database reads of its own and stores no state.
It uses existing passport retrieval, API-key authentication, denial signing and
audit logging. It does not change regional routing, tenant storage or private
instance configuration.

## Timestamp provenance

The hosted `governance.data.access.v1` and `data.report.ingest.v1` policies also
require a passport-owner backend API key when the applicable
`max_data_age_seconds` limit is configured, even without an ownership binding.
The backend must obtain `data_timestamp` from authoritative resource metadata,
not copy a timestamp supplied by the model. The key identifies the submitting
backend; APort does not independently measure the resource's age. Current-looking
timestamps and caller-provided trust flags do not bypass this requirement.

Authenticated submissions still undergo the configured age check: missing,
invalid, future and expired timestamps deny. Passports without an applicable
freshness limit retain existing anonymous verification behavior. Nested,
whole-capability dot-key and legacy root limits use the same resolver for
provenance admission and policy evaluation. Fallback is per freshness field and,
for ingestion, per report type: unrelated fields in a nested bucket cannot hide a
dot-key or root freshness limit. Explicit nested values take precedence, including
zero. Unsigned local simulations and direct
evaluator calls do not establish backend provenance.

## Adopting it

Deploy the endpoint and schema changes before configuring a passport. Older
verifiers do not enforce this new limit. Test own-customer ALLOW, other-customer
DENY, missing-identity DENY, anonymous DENY and mixed-customer batch DENY against
the deployed version. These source changes do not modify existing live passports.

For the support demo, the presenter-controlled fixture is the server's source of
customer and resource identity. Keep that provenance explicit in implementation:
it is not a live Salesforce authentication integration. Do not hardcode DENY for
the other-customer scene; display the decision returned by the verifier.
