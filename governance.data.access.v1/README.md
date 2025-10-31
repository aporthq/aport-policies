# Data Access Governance Policy Pack v1

Protect your data access endpoints with APort's standardized policy pack. This pack ensures only verified agents with proper capabilities, assurance levels, and data access permissions can access sensitive data based on classification, entity types, and jurisdictional boundaries.

## What This Pack Protects

- **Route**: `/data/access/*` (GET, POST)
- **Risk**: Data breaches, privacy violations, regulatory compliance, unauthorized access
- **Impact**: Data exposure, GDPR violations, audit findings, reputational damage

## Requirements

| Requirement | Value | Description |
|-------------|-------|-------------|
| **Capability** | `data.access` | Agent must have data access capability |
| **Assurance** | `L3` or higher | Enhanced verification minimum |
| **Limits** | `allowed_classifications[]` | Allowed data classifications (PII, Financial, HR, ClientTier1) |
| **Limits** | `permissions.{classification}.allowed_entity_types[]` | Entity types allowed per classification |
| **Limits** | `permissions.{classification}.allowed_actions[]` | Actions allowed per classification |
| **Limits** | `allowed_jurisdictions[]` | Allowed data jurisdictions |
| **Limits** | `max_rows_per_export` | Maximum rows per data export |
| **Limits** | `allowed_destination_jurisdictions[]` | Allowed destination jurisdictions for data transfer |
| **Limits** | `balance_inquiry_cap_usd` | Maximum account balance for inquiry access |
| **Regions** | Must match | Agent must be authorized in caller's region |

## Implementation

### Express.js

```javascript
const { requirePolicy } = require('@aporthq/middleware-express');

// Option 1: Explicit agent ID (preferred)
app.get('/data/access', 
  requirePolicy('governance.data.access.v1', 'ap_a2d10232c6534523812423eec8a1425c45678'), 
  async (req, res) => {
    // Your data access logic here
    // req.policyResult contains the verified passport
    const { data_classification, accessing_entity_id, resource_id } = req.query;
    const passport = req.policyResult.passport;
    
    // Process data access...
    res.json({ success: true, data: retrievedData });
  }
);

// Option 2: Header fallback (backward compatible)
app.get('/data/access', 
  requirePolicy('governance.data.access.v1'), 
  async (req, res) => {
    // Your data access logic here
    // req.policyResult contains the verified passport
    const { data_classification, accessing_entity_id, resource_id } = req.query;
    const passport = req.policyResult.passport;
    
    // Process data access...
    res.json({ success: true, data: retrievedData });
  }
);
```

**Client Request Example:**
```javascript
// The client must include the agent ID in the header (for Option 2)
fetch('/data/access?data_classification=PII&accessing_entity_id=emp_123&resource_id=user_456', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'X-Agent-Passport-Id': 'ap_a2d10232c6534523812423eec8a1425c45678'  // ← Agent ID passed here
  }
});
```

### FastAPI

```python
from aport.middleware import require_policy

@app.get("/data/access")
@require_policy("governance.data.access.v1")
async def access_data(request: Request, data_classification: str, accessing_entity_id: str, resource_id: str):
    # Your data access logic here
    # request.state.policy_result contains the verified passport
    passport = request.state.policy_result.passport
    
    # Process data access...
    return {"success": True, "data": retrieved_data}
```

**Client Request Example:**
```python
import requests

# The client must include the agent ID in the header
response = requests.get('/data/access', 
    headers={
        'Content-Type': 'application/json',
        'X-Agent-Passport-Id': 'ap_a2d10232c6534523812423eec8a1425c45678'  # ← Agent ID passed here
    },
    params={
        'data_classification': 'PII',
        'accessing_entity_id': 'emp_123',
        'resource_id': 'user_456'
    }
)
```

## How It Works

The `requirePolicy('governance.data.access.v1', agentId?)` middleware implements a flexible approach:

1. **Agent ID Resolution** (in order of preference):
   - **Function Parameter**: Uses explicit `agentId` if provided
   - **Header Fallback**: Reads `X-Agent-Passport-Id` header from request
   - **Validation**: Ensures agent ID format is valid (`ap_xxxxxxxxxxxxx`)
   - **Failure**: Returns 400 error if neither provided

2. **Policy Validation**:
   - **Format Check**: Validates policy ID format (`governance.data.access.v1`)
   - **API Call**: Calls `/api/verify/policy/governance.data.access.v1` with agent ID and context
   - **Requirements Check**: Validates agent meets governance.data.access.v1 requirements:
     - Has `data.access` capability
     - Meets minimum assurance level (L3+)
     - Data classification is allowed
     - Entity type is allowed for the classification
     - Action type is allowed for the classification
     - Jurisdiction is allowed
     - Row count within limits (for exports)
     - Destination jurisdiction allowed (for transfers)
     - Balance inquiry within limits
     - Access frequency within limits
     - Data retention policy compliance

3. **Result Handling**:
   - **Success**: Adds `req.policyResult` with verified data and continues
   - **Failure**: Returns 403 with detailed error information
   - **Logging**: Logs violations for monitoring and debugging

## Error Responses

When policy checks fail, you'll receive a `403 Forbidden` with detailed error information:

```json
{
  "error": "policy_violation",
  "code": "oap.classification_forbidden",
  "message": "Data classification 'Sensitive' is not allowed",
  "policy_id": "governance.data.access.v1",
  "agent_id": "ap_a2d10232c6534523812423eec8a1425c45678",
  "upgrade_instructions": "Request access to this data classification in your passport"
}
```

## Test Payloads

### Valid Request
```json
{
  "data_classification": "PII",
  "accessing_entity_id": "emp_123",
  "accessing_entity_type": "employee",
  "resource_id": "user_456",
  "action_type": "read",
  "jurisdiction": "US",
  "row_count": 100
}
```

### Invalid Request (classification forbidden)
```json
{
  "data_classification": "Sensitive",
  "accessing_entity_id": "emp_123",
  "accessing_entity_type": "employee",
  "resource_id": "user_456"
}
```
*Returns 403: "Data classification 'Sensitive' is not allowed"*

## Best Practices

1. **Cache Verification**: Cache `/verify` responses with ETag for 60 seconds
2. **Webhook Integration**: Subscribe to `status.changed` webhooks for instant suspension
3. **Verifiable Attestation**: Log all data access attempts for compliance
4. **Data Classification**: Implement data classification tagging for all resources
5. **Entity Access Matrices**: Maintain entity access matrices for different data types
6. **Jurisdiction Awareness**: Use jurisdiction-aware data routing for compliance
7. **Progressive Disclosure**: Implement progressive disclosure for sensitive data access
8. **Access Monitoring**: Monitor access patterns for unusual behavior
9. **Audit Trails**: Maintain audit trails for all data access operations
10. **Encryption**: Use encryption for data in transit and at rest
11. **Data Retention**: Implement data retention policies based on classification

## Compliance Badge

Agents that meet this policy's requirements can display the "Data-Access-Ready" badge:

```markdown
[![Data-Access-Ready](https://api.aport.io/badge/ap_a2d10232c6534523812423eec8a1425c45678.svg)](https://aport.io/agents/ap_a2d10232c6534523812423eec8a1425c45678)
```

## Support

- [Documentation](https://aport.io/docs/policies/governance.data.access.v1)
- [Community](https://github.com/aporthq/community)
- [Support](https://aport.io/support)

---
**Last Updated**: 2025-01-30 00:00:00 UTC


## Required Context

This policy requires the following context (JSON Schema):

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": [
    "data_classification",
    "accessing_entity_id",
    "accessing_entity_type",
    "resource_id"
  ],
  "properties": {
    "data_classification": {
      "type": "string",
      "description": "The classification of the data being accessed (e.g., 'PII', 'Financial', 'HR', 'ClientTier1')."
    },
    "accessing_entity_id": {
      "type": "string",
      "description": "The unique ID of the entity (user, agent, employee) attempting the access."
    },
    "accessing_entity_type": {
      "type": "string",
      "enum": [
        "employee",
        "client",
        "system_agent"
      ],
      "description": "The type of entity attempting the access."
    },
    "resource_id": {
      "type": "string",
      "description": "The unique ID of the data resource being accessed (e.g., account number, user profile ID)."
    },
    "action_type": {
      "type": "string",
      "enum": [
        "read",
        "export",
        "delete",
        "update"
      ],
      "default": "read",
      "description": "The type of data access action being performed."
    },
    "jurisdiction": {
      "type": "string",
      "pattern": "^[A-Z]{2}$",
      "description": "The ISO 3166-1 alpha-2 country code relevant to the data's jurisdiction."
    },
    "row_count": {
      "type": "integer",
      "description": "The number of rows/records being accessed or exported. Solves for Row Limits."
    },
    "destination_jurisdiction": {
      "type": "string",
      "pattern": "^[A-Z]{2}$",
      "description": "The destination country code for data transfers. Solves for Data Locality."
    },
    "resource_attributes": {
      "type": "object",
      "description": "A flexible object for passing specific attributes of the resource being accessed. Solves for Balance Inquiry.",
      "properties": {
        "account_balance_usd": {
          "type": "integer",
          "description": "The balance of the account in USD minor units, used for balance-based access rules."
        }
      }
    }
  }
}
```

You can also fetch this live via the discovery endpoint:

```bash
curl -s "https://aport.io/api/policies/governance.data.access.v1?format=schema"
```

