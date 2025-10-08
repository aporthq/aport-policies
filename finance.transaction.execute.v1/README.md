# Financial Transaction Execution Policy Pack v1

Protect your financial transaction endpoints with APort's standardized policy pack. This pack ensures only verified agents with proper capabilities, assurance levels, and transaction limits can execute financial transactions like trades, transfers, and asset movements.

## What This Pack Protects

- **Route**: `/finance/transaction/*` (POST)
- **Risk**: Financial transactions, fraud prevention, regulatory compliance, fund segregation
- **Impact**: Direct monetary loss, regulatory violations, audit findings, counterparty risk

## Requirements

| Requirement | Value | Description |
|-------------|-------|-------------|
| **Capability** | `finance.transaction` | Agent must have transaction capability |
| **Assurance** | `L3` or higher | Enhanced verification minimum |
| **Limits** | `allowed_transaction_types[]` | Allowed transaction types (buy, sell, transfer, short_sell) |
| **Limits** | `allowed_asset_classes[]` | Allowed asset classes (equity, bond, crypto, cash) |
| **Limits** | `max_exposure_per_tx_usd` | Maximum exposure per transaction |
| **Limits** | `allowed_source_account_types[]` | Allowed source account types |
| **Limits** | `restricted_source_account_types[]` | Restricted account types |
| **Limits** | `max_exposure_per_counterparty_usd` | Maximum exposure per counterparty |
| **Regions** | Must match | Agent must be authorized in caller's region |
| **Idempotency** | Required | Prevents duplicate transactions |

## Implementation

### Express.js

```javascript
const { requirePolicy } = require('@aporthq/middleware-express');

// Option 1: Explicit agent ID (preferred)
app.post('/finance/transaction', 
  requirePolicy('finance.transaction.execute.v1', 'ap_a2d10232c6534523812423eec8a1425c45678'), 
  async (req, res) => {
    // Your transaction logic here
    // req.policyResult contains the verified passport
    const { transaction_type, amount, currency, asset_class, source_account_id, destination_account_id } = req.body;
    const passport = req.policyResult.passport;
    
    // Process transaction...
    res.json({ success: true, transaction_id: generateId() });
  }
);

// Option 2: Header fallback (backward compatible)
app.post('/finance/transaction', 
  requirePolicy('finance.transaction.execute.v1'), 
  async (req, res) => {
    // Your transaction logic here
    // req.policyResult contains the verified passport
    const { transaction_type, amount, currency, asset_class, source_account_id, destination_account_id } = req.body;
    const passport = req.policyResult.passport;
    
    // Process transaction...
    res.json({ success: true, transaction_id: generateId() });
  }
);
```

**Client Request Example:**
```javascript
// The client must include the agent ID in the header (for Option 2)
fetch('/finance/transaction', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Agent-Passport-Id': 'ap_a2d10232c6534523812423eec8a1425c45678'  // ← Agent ID passed here
  },
  body: JSON.stringify({
    transaction_type: "buy",
    amount: 10000,
    currency: "USD",
    asset_class: "equity",
    source_account_id: "acc_client_123",
    destination_account_id: "acc_trading_456",
    source_account_type: "client_funds",
    destination_account_type: "trading",
    counterparty_id: "cpty_broker_789",
    idempotency_key: "txn-buy-123"
  })
});
```

### FastAPI

```python
from aport.middleware import require_policy

@app.post("/finance/transaction")
@require_policy("finance.transaction.execute.v1")
async def execute_transaction(request: Request, transaction_data: TransactionRequest):
    # Your transaction logic here
    # request.state.policy_result contains the verified passport
    passport = request.state.policy_result.passport
    
    # Process transaction...
    return {"success": True, "transaction_id": generate_id()}
```

**Client Request Example:**
```python
import requests

# The client must include the agent ID in the header
response = requests.post('/finance/transaction', 
    headers={
        'Content-Type': 'application/json',
        'X-Agent-Passport-Id': 'ap_a2d10232c6534523812423eec8a1425c45678'  # ← Agent ID passed here
    },
    json={
        'transaction_type': 'buy',
        'amount': 10000,
        'currency': 'USD',
        'asset_class': 'equity',
        'source_account_id': 'acc_client_123',
        'destination_account_id': 'acc_trading_456',
        'source_account_type': 'client_funds',
        'destination_account_type': 'trading',
        'counterparty_id': 'cpty_broker_789',
        'idempotency_key': 'txn-buy-123'
    }
)
```

## How It Works

The `requirePolicy('finance.transaction.execute.v1', agentId?)` middleware implements a flexible approach:

1. **Agent ID Resolution** (in order of preference):
   - **Function Parameter**: Uses explicit `agentId` if provided
   - **Header Fallback**: Reads `X-Agent-Passport-Id` header from request
   - **Validation**: Ensures agent ID format is valid (`ap_xxxxxxxxxxxxx`)
   - **Failure**: Returns 400 error if neither provided

2. **Policy Validation**:
   - **Format Check**: Validates policy ID format (`finance.transaction.execute.v1`)
   - **API Call**: Calls `/api/verify/policy/finance.transaction.execute.v1` with agent ID and context
   - **Requirements Check**: Validates agent meets finance.transaction.execute.v1 requirements:
     - Has `finance.transaction` capability
     - Meets minimum assurance level (L3+)
     - Transaction type is allowed
     - Asset class is allowed
     - Within exposure limits per transaction
     - Source account type is allowed
     - No restricted account types
     - Segregation of funds enforced (no client→proprietary)
     - Counterparty exposure within limits
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
  "message": "Amount $100,000 exceeds per-transaction limit $50,000",
  "policy_id": "finance.transaction.execute.v1",
  "agent_id": "ap_a2d10232c6534523812423eec8a1425c45678",
  "upgrade_instructions": "Request higher limits in your passport"
}
```

## Test Payloads

### Valid Request
```json
{
  "transaction_type": "buy",
  "amount": 10000,
  "currency": "USD",
  "asset_class": "equity",
  "source_account_id": "acc_client_123",
  "destination_account_id": "acc_trading_456",
  "source_account_type": "client_funds",
  "destination_account_type": "trading",
  "counterparty_id": "cpty_broker_789",
  "idempotency_key": "txn-buy-123"
}
```

### Invalid Request (exceeds limit)
```json
{
  "transaction_type": "buy",
  "amount": 100000,
  "currency": "USD",
  "asset_class": "equity",
  "source_account_id": "acc_client_123",
  "destination_account_id": "acc_trading_456",
  "idempotency_key": "txn-buy-124"
}
```
*Returns 403: "Amount $100,000 exceeds per-transaction limit $50,000"*

## Best Practices

1. **Cache Verification**: Cache `/verify` responses with ETag for 60 seconds
2. **Webhook Integration**: Subscribe to `status.changed` webhooks for instant suspension
3. **Verifiable Attestation**: Log all transaction attempts for compliance
4. **Daily Tracking**: Implement daily exposure tracking per counterparty to prevent concentration risk
5. **Idempotency**: Always use unique idempotency keys to prevent duplicate transactions
6. **Error Handling**: Provide clear error messages to help agents self-remediate
7. **Fund Segregation**: Maintain strict segregation between client and proprietary funds
8. **Counterparty Monitoring**: Monitor counterparty exposure limits to prevent over-concentration
9. **Real-time Balance Checks**: Implement real-time balance checks before transaction execution
10. **Progressive Limits**: Use progressive limits for new counterparties

## Compliance Badge

Agents that meet this policy's requirements can display the "Transaction-Ready" badge:

```markdown
[![Transaction-Ready](https://api.aport.io/badge/ap_a2d10232c6534523812423eec8a1425c45678.svg)](https://aport.io/agents/ap_a2d10232c6534523812423eec8a1425c45678)
```

## Support

- [Documentation](https://aport.io/docs/policies/finance.transaction.execute.v1)
- [Community](https://github.com/aporthq/community)
- [Support](https://aport.io/support)

---
**Last Updated**: 2025-01-30 00:00:00 UTC
