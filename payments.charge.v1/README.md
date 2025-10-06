# Payment Charge Policy Pack v1

Protect your payment charge endpoints with APort's standardized policy pack. This pack ensures only verified agents with proper capabilities, assurance levels, and transaction limits can initiate payments.

## What This Pack Protects

- **Route**: `/payments/charge/*` (POST)
- **Risk**: Financial transactions, fraud prevention, regulatory compliance
- **Impact**: Direct monetary loss, chargeback disputes, audit findings

## Requirements

| Requirement | Value | Description |
|-------------|-------|-------------|
| **Capability** | `payments.charge` | Agent must have charge capability |
| **Assurance** | `L2` or higher | Email + GitHub verification minimum |
| **Limits** | `currency_limits.{ISO4217}.{max_per_tx,daily_cap}` | Per-currency transaction and daily limits |
| **Limits** | `allowed_merchant_ids[]` | Merchant allowlist (optional) |
| **Limits** | `allowed_countries[]` | Country allowlist (optional) |
| **Limits** | `blocked_categories[]` | Category blocklist (optional) |
| **Limits** | `max_items_per_tx` | Maximum items per transaction (optional) |
| **Regions** | Must match | Agent must be authorized in caller's region |
| **Idempotency** | Required | Prevents duplicate charges |

## Implementation

### Express.js

```javascript
const { requirePolicy } = require('@aporthq/middleware-express');

// Option 1: Explicit agent ID (preferred)
app.post('/payments/charge', 
  requirePolicy('payments.charge.v1', 'ap_a2d10232c6534523812423eec8a1425c45678'), 
  async (req, res) => {
    // Your charge logic here
    // req.policyResult contains the verified passport
    const { amount, currency, merchant_id, items } = req.body;
    const passport = req.policyResult.passport;
    
    // Process charge...
    res.json({ success: true, charge_id: generateId() });
  }
);

// Option 2: Header fallback (backward compatible)
app.post('/payments/charge', 
  requirePolicy('payments.charge.v1'), 
  async (req, res) => {
    // Your charge logic here
    // req.policyResult contains the verified passport
    const { amount, currency, merchant_id, items } = req.body;
    const passport = req.policyResult.passport;
    
    // Process charge...
    res.json({ success: true, charge_id: generateId() });
  }
);
```

**Client Request Example:**
```javascript
// The client must include the agent ID in the header (for Option 2)
fetch('/payments/charge', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Agent-Passport-Id': 'ap_a2d10232c6534523812423eec8a1425c45678'  // ← Agent ID passed here
  },
  body: JSON.stringify({
    amount: 1299,
    currency: "USD",
    merchant_id: "merch_abc",
    region: "US",
    shipping_country: "US",
    items: [
      { sku: "SKU-1", qty: 1, category: "electronics" }
    ],
    idempotency_key: "charge-ord-123"
  })
});
```

### FastAPI

```python
from aport.middleware import require_policy

@app.post("/payments/charge")
@require_policy("payments.charge.v1")
async def process_charge(request: Request, charge_data: ChargeRequest):
    # Your charge logic here
    # request.state.policy_result contains the verified passport
    passport = request.state.policy_result.passport
    
    # Process charge...
    return {"success": True, "charge_id": generate_id()}
```

**Client Request Example:**
```python
import requests

# The client must include the agent ID in the header
response = requests.post('/payments/charge', 
    headers={
        'Content-Type': 'application/json',
        'X-Agent-Passport-Id': 'ap_a2d10232c6534523812423eec8a1425c45678'  # ← Agent ID passed here
    },
    json={
        'amount': 1299,
        'currency': 'USD',
        'merchant_id': 'merch_abc',
        'region': 'US',
        'shipping_country': 'US',
        'items': [
            {'sku': 'SKU-1', 'qty': 1, 'category': 'electronics'}
        ],
        'idempotency_key': 'charge-ord-123'
    }
)
```

## How It Works

The `requirePolicy('payments.charge.v1', agentId?)` middleware implements a flexible approach:

1. **Agent ID Resolution** (in order of preference):
   - **Function Parameter**: Uses explicit `agentId` if provided
   - **Header Fallback**: Reads `X-Agent-Passport-Id` header from request
   - **Validation**: Ensures agent ID format is valid (`ap_xxxxxxxxxxxxx`)
   - **Failure**: Returns 400 error if neither provided

2. **Policy Validation**:
   - **Format Check**: Validates policy ID format (`payments.charge.v1`)
   - **API Call**: Calls `/api/verify/policy/payments.charge.v1` with agent ID and context
   - **Requirements Check**: Validates agent meets payments.charge.v1 requirements:
     - Has `payments.charge` capability
     - Meets minimum assurance level (L2+)
     - Within per-currency transaction and daily limits
     - Merchant is allowed (if allowlist configured)
     - Country is allowed (if allowlist configured)
     - No blocked categories in items
     - Item count within limits
     - Idempotency key is unique
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
  "code": "oap.limit_exceeded",
  "message": "Amount $25.00 exceeds per-transaction limit $20.00",
  "policy_id": "payments.charge.v1",
  "agent_id": "ap_a2d10232c6534523812423eec8a1425c45678",
  "upgrade_instructions": "Request higher limits in your passport"
}
```

## Test Payloads

### Valid Request
```json
{
  "amount": 1299,
  "currency": "USD",
  "merchant_id": "merch_abc",
  "region": "US",
  "shipping_country": "US",
  "items": [
    { "sku": "SKU-1", "qty": 1, "category": "electronics" }
  ],
  "idempotency_key": "charge-ord-123"
}
```

### Invalid Request (exceeds limit)
```json
{
  "amount": 25000,
  "currency": "USD",
  "merchant_id": "merch_abc",
  "region": "US",
  "items": [
    { "sku": "SKU-1", "qty": 1, "category": "electronics" }
  ],
  "idempotency_key": "charge-ord-124"
}
```
*Returns 403: "Amount $250.00 exceeds per-transaction limit $200.00"*

## Best Practices

1. **Cache Verification**: Cache `/verify` responses with ETag for 60 seconds
2. **Webhook Integration**: Subscribe to `status.changed` webhooks for instant suspension
3. **Verifiable Attestation**: Log all charge attempts for compliance
4. **Daily Tracking**: Implement daily spend tracking per currency to prevent abuse
5. **Idempotency**: Always use unique idempotency keys to prevent duplicate charges
6. **Error Handling**: Provide clear error messages to help agents self-remediate
7. **Merchant Validation**: Maintain merchant allowlists for trusted partners
8. **Category Filtering**: Block high-risk categories (weapons, illicit goods)

## Compliance Badge

Agents that meet this policy's requirements can display the "Charge-Ready" badge:

```markdown
[![Charge-Ready](https://api.aport.io/badge/ap_a2d10232c6534523812423eec8a1425c45678.svg)](https://aport.io/agents/ap_a2d10232c6534523812423eec8a1425c45678)
```

## Support

- [Documentation](https://aport.io/docs/policies/payments.charge.v1)
- [Community](https://github.com/aporthq/community)
- [Support](https://aport.io/support)

---
**Last Updated**: 2025-09-30 00:00:00 UTC
