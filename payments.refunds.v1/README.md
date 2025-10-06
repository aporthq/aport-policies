# Refunds Protection Policy Pack v1

Protect your refund endpoints with APort's standardized policy pack. This pack ensures only verified agents with proper capabilities, assurance levels, and transaction limits can process refunds.

## What This Pack Protects

- **Route**: `/refunds/*` (POST, PUT, PATCH)
- **Risk**: Financial transactions, potential fraud, regulatory compliance
- **Impact**: Direct monetary loss, customer disputes, audit findings

## Requirements

| Requirement | Value | Description |
|-------------|-------|-------------|
| **Capability** | `payments.refund` | Agent must have refund capability |
| **Assurance** | `L2` or higher | Email + GitHub verification minimum |
| **Limits** | `refund_amount_max_per_tx` | Maximum per-transaction refund amount |
| **Limits** | `refund_amount_daily_cap` | Maximum daily refund total |
| **Regions** | Must match | Agent must be authorized in caller's region |

## Implementation

### Express.js

```javascript
const { requirePolicy } = require('@aporthq/middleware-express');

// Option 1: Explicit agent ID (preferred)
app.post('/refunds', 
  requirePolicy('payments.refund.v1', 'ap_a2d10232c6534523812423eec8a1425c45678'), 
  async (req, res) => {
    // Your refund logic here
    // req.policyResult contains the verified passport
    const { amount, reason } = req.body;
    const passport = req.policyResult.passport;
    
    // Process refund...
    res.json({ success: true, refund_id: generateId() });
  }
);

// Option 2: Header fallback (backward compatible)
app.post('/refunds', 
  requirePolicy('payments.refund.v1'), 
  async (req, res) => {
    // Your refund logic here
    // req.policyResult contains the verified passport
    const { amount, reason } = req.body;
    const passport = req.policyResult.passport;
    
    // Process refund...
    res.json({ success: true, refund_id: generateId() });
  }
);
```

**Client Request Example:**
```javascript
// The client must include the agent ID in the header (for Option 2)
fetch('/refunds', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Agent-Passport-Id': 'ap_a2d10232c6534523812423eec8a1425c45678'  // ← Agent ID passed here
  },
  body: JSON.stringify({
    amount: 25.00,
    reason: 'Customer requested refund'
  })
});
```

### FastAPI

```python
from aport.middleware import require_policy

@app.post("/refunds")
@require_policy("payments.refund.v1")
async def process_refund(request: Request, refund_data: RefundRequest):
    # Your refund logic here
    # request.state.policy_result contains the verified passport
    passport = request.state.policy_result.passport
    
    # Process refund...
    return {"success": True, "refund_id": generate_id()}
```

**Client Request Example:**
```python
import requests

# The client must include the agent ID in the header
response = requests.post('/refunds', 
    headers={
        'Content-Type': 'application/json',
        'X-Agent-Passport-Id': 'ap_a2d10232c6534523812423eec8a1425c45678'  # ← Agent ID passed here
    },
    json={
        'amount': 25.00,
        'reason': 'Customer requested refund'
    }
)
```

## How It Works

The `requirePolicy('payments.refund.v1', agentId?)` middleware implements a flexible approach:

1. **Agent ID Resolution** (in order of preference):
   - **Function Parameter**: Uses explicit `agentId` if provided
   - **Header Fallback**: Reads `X-Agent-Passport-Id` header from request
   - **Validation**: Ensures agent ID format is valid (`ap_xxxxxxxxxxxxx`)
   - **Failure**: Returns 400 error if neither provided

2. **Policy Validation**:
   - **Format Check**: Validates policy ID format (`payments.refund.v1`)
   - **API Call**: Calls `/api/verify/policy/payments.refund.v1` with agent ID and context
   - **Requirements Check**: Validates agent meets payments.refund.v1 requirements:
     - Has `payments.refund` capability
     - Meets minimum assurance level (L2+)
     - Within transaction and daily limits
     - Authorized in the request region

3. **Result Handling**:
   - **Success**: Adds `req.policyResult` with verified data and continues
   - **Failure**: Returns 403 with detailed error information
   - **Logging**: Logs violations for monitoring and debugging

## Error Responses

When policy checks fail, you'll receive a `403 Forbidden` with detailed error information:

```json
{
  "error": "policy_violation",
  "code": "MISSING_CAPABILITY",
  "message": "Agent missing required capability: payments.refund",
  "policy_id": "payments.refund.v1",
  "agent_id": "ap_a2d10232c6534523812423eec8a1425c45678",
  "upgrade_instructions": "Add 'payments.refund' capability to your passport"
}
```

## Test Payloads

### Valid Request
```json
{
  "amount": 25.00,
  "reason": "Customer requested refund",
  "order_id": "ORD-12345"
}
```

### Invalid Request (exceeds limit)
```json
{
  "amount": 1000.00,
  "reason": "Customer requested refund",
  "order_id": "ORD-12345"
}
```
*Returns 403: "Amount $1000.00 exceeds limit $500.00"*

## Best Practices

1. **Cache Verification**: Cache `/verify` responses with ETag for 60 seconds
2. **Webhook Integration**: Subscribe to `status.changed` webhooks for instant suspension
3. **Verifiable Attestation**: Log all refund attempts for compliance
4. **Daily Tracking**: Implement daily spend tracking to prevent abuse
5. **Error Handling**: Provide clear error messages to help agents self-remediate

## Compliance Badge

Agents that meet this policy's requirements can display the "Refunds-Ready" badge:

```markdown
[![Refunds-Ready](https://api.aport.io/badge/ap_a2d10232c6534523812423eec8a1425c45678.svg)](https://aport.io/agents/ap_a2d10232c6534523812423eec8a1425c45678)
```

## Support

- [Documentation](https://aport.io/docs/policies/payments.refund.v1)
- [Community](https://github.com/aporthq/community)
- [Support](https://aport.io/support)

---
**Last Updated**: 2025-09-24 23:15:00 UTC
