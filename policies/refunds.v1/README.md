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

app.post('/refunds', requirePolicy('refunds.v1'), async (req, res) => {
  // Your refund logic here
  // req.policyResult contains the verified passport
  const { amount, reason } = req.body;
  const passport = req.policyResult.passport;
  
  // Process refund...
  res.json({ success: true, refund_id: generateId() });
});
```

### FastAPI

```python
from aport.middleware import require_policy

@app.post("/refunds")
@require_policy("refunds.v1")
async def process_refund(request: Request, refund_data: RefundRequest):
    # Your refund logic here
    # request.state.policy_result contains the verified passport
    passport = request.state.policy_result.passport
    
    # Process refund...
    return {"success": True, "refund_id": generate_id()}
```

## Error Responses

When policy checks fail, you'll receive a `403 Forbidden` with detailed error information:

```json
{
  "error": "policy_violation",
  "code": "MISSING_CAPABILITY",
  "message": "Agent missing required capability: payments.refund",
  "policy_id": "refunds.v1",
  "agent_id": "ap_128094d345678",
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
3. **Audit Logging**: Log all refund attempts for compliance
4. **Daily Tracking**: Implement daily spend tracking to prevent abuse
5. **Error Handling**: Provide clear error messages to help agents self-remediate

## Compliance Badge

Agents that meet this policy's requirements can display the "Refunds-Ready" badge:

```markdown
[![Refunds-Ready](https://api.aport.io/badge/ap_128094d345678.svg)](https://aport.io/agents/ap_128094d345678)
```

## Support

- [Documentation](https://aport.io/docs/policies/refunds.v1)
- [Community](https://github.com/aporthq/community)
- [Support](https://aport.io/support)

---
**Last Updated**: 2025-09-24 23:02:26 UTC
