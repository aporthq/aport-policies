# Legal Contract Review Policy (`legal.contract.review.v1`)

## Overview

The Legal Contract Review Policy provides pre-action governance for AI agents performing legal contract review, drafting, and redlining operations. This policy enforces firm-specific guardrails, privilege protection, attorney supervision requirements, and jurisdiction controls to prevent malpractice risk and ensure ABA ethics compliance.

## Use Cases

- **Contract Review**: AI agents review contracts with firm-specific guardrails
- **Contract Drafting**: AI agents draft contracts within defined parameters
- **Contract Redlining**: AI agents redline contracts with privilege protection
- **Attorney Supervision**: Enforces ABA Formal Opinion 512 requirements for AI supervision

## Requirements

### Capability
- `legal.contract.review` - Required capability for contract review operations

### Minimum Assurance Level
- **L3** - High assurance required for legal operations

### Required Limits

The following limits must be configured in the passport:

```json
{
  "legal": {
    "contract": {
      "review": {
        "allowed_document_types": ["contract", "nda", "msa", "sla"],
        "max_document_size_mb": 10,
        "allowed_contract_jurisdictions": ["US", "CA", "GB"],
        "require_attorney_review": true,
        "privilege_protection_enabled": true,
        "max_contracts_per_day": 50,
        "allowed_client_tiers": ["tier1", "tier2", "enterprise"]
      }
    }
  }
}
```

## Context Fields

### Required Fields

- `document_type` (string): Type of legal document (contract, nda, msa, sla, etc.)
- `client_id` (string): Unique identifier for the client
- `jurisdiction` (string): ISO 3166-1 alpha-2 country code
- `action_type` (string): Type of action (review, draft, redline, approve)
- `idempotency_key` (string): Idempotency key for duplicate prevention

### Optional Fields

- `document_size_mb` (number): Size of the document in megabytes
- `client_tier` (string): Client tier classification
- `attorney_reviewer_id` (string): ID of supervising attorney (required if `require_attorney_review` is true)
- `privilege_level` (string): Attorney-client privilege level
- `contract_value_usd` (integer): Contract value in USD minor units
- `matter_id` (string): Legal matter identifier
- `review_deadline` (string): Deadline for contract review completion

## Enforcement Rules

1. **Document Type Validation**: Only allowed document types can be reviewed
2. **Document Size Limits**: Documents exceeding `max_document_size_mb` are rejected
3. **Jurisdiction Authorization**: Only authorized jurisdictions are allowed
4. **Attorney Review**: Required for high-value contracts or when `require_attorney_review` is true
5. **Privilege Protection**: Privilege level must be specified when protection is enabled
6. **Daily Limits**: Maximum contracts per day are enforced
7. **Client Tier Authorization**: Only authorized client tiers can be serviced
8. **High-Value Review**: Contracts over $10,000 require attorney review

## Example Request

```json
{
  "agent_id": "ap_1234567890",
  "policy_id": "legal.contract.review.v1",
  "context": {
    "document_type": "contract",
    "client_id": "client_abc123",
    "jurisdiction": "US",
    "action_type": "review",
    "idempotency_key": "unique-key-12345",
    "document_size_mb": 2.5,
    "client_tier": "tier1",
    "attorney_reviewer_id": "attorney_xyz789",
    "privilege_level": "privileged",
    "contract_value_usd": 5000000,
    "matter_id": "matter_001"
  }
}
```

## Compliance

This policy ensures compliance with:

- **ABA Formal Opinion 512**: Requires attorney supervision of AI operations
- **Attorney-Client Privilege**: Protects privileged communications
- **Malpractice Risk Mitigation**: Prevents unauthorized contract operations
- **Jurisdictional Compliance**: Enforces jurisdiction-specific requirements

## Integration

The policy is automatically applied when a passport has the `legal.contract.review` capability. The verification endpoint `/api/verify/policy/legal.contract.review.v1` evaluates all enforcement rules and returns an allow/deny decision with detailed reasons.

