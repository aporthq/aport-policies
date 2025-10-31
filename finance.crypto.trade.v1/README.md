# Crypto Asset Trading Policy Pack v1

Protect your crypto trading endpoints with APort's standardized policy pack. This pack ensures only verified agents with proper capabilities, assurance levels, and trading limits can execute crypto asset trades with appropriate security controls.

## What This Pack Protects

- **Route**: `/finance/crypto/trade/*` (POST)
- **Risk**: Crypto trading, market manipulation, security breaches, regulatory compliance
- **Impact**: Financial loss, regulatory violations, security incidents, market disruption

## Requirements

| Requirement | Value | Description |
|-------------|-------|-------------|
| **Capability** | `finance.crypto.trade` | Agent must have crypto trading capability |
| **Assurance** | `L3` or higher | Enhanced verification minimum |
| **Limits** | `allowed_exchanges[]` | Allowed crypto exchanges (coinbase, binance, etc.) |
| **Limits** | `allowed_tokens[]` | Allowed cryptocurrency tokens |
| **Limits** | `max_trade_size_usd` | Maximum trade size in USD |
| **Limits** | `max_hot_wallet_trade_usd` | Maximum hot wallet trade size |
| **Limits** | `max_daily_trade_volume_usd` | Maximum daily trading volume |
| **Limits** | `max_trades_per_day` | Maximum number of trades per day |
| **Regions** | Must match | Agent must be authorized in caller's region |
| **Idempotency** | Required | Prevents duplicate trades |

## Implementation

### Express.js

```javascript
const { requirePolicy } = require('@aporthq/middleware-express');

// Option 1: Explicit agent ID (preferred)
app.post('/finance/crypto/trade', 
  requirePolicy('finance.crypto.trade.v1', 'ap_a2d10232c6534523812423eec8a1425c45678'), 
  async (req, res) => {
    // Your crypto trading logic here
    // req.policyResult contains the verified passport
    const { exchange_id, pair, side, amount_usd } = req.body;
    const passport = req.policyResult.passport;
    
    // Process crypto trade...
    res.json({ success: true, trade_id: generateId() });
  }
);
```

**Client Request Example:**
```javascript
fetch('/finance/crypto/trade', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Agent-Passport-Id': 'ap_a2d10232c6534523812423eec8a1425c45678'
  },
  body: JSON.stringify({
    exchange_id: "coinbase",
    pair: "BTC-USD",
    side: "buy",
    amount_usd: 1000,
    source_wallet_type: "hot",
    idempotency_key: "crypto-trade-123"
  })
});
```

## Best Practices

1. **Cache Verification**: Cache `/verify` responses with ETag for 30 seconds
2. **Webhook Integration**: Subscribe to `status.changed` webhooks for instant suspension
3. **Verifiable Attestation**: Log all crypto trade attempts for compliance
4. **Real-time Price Validation**: Implement real-time price validation before trade execution
5. **Wallet Security**: Use cold storage for large amounts and hot wallets for small trades
6. **Exchange Monitoring**: Monitor exchange connectivity and implement circuit breakers
7. **Slippage Protection**: Implement slippage protection for volatile markets
8. **Idempotency**: Always use unique idempotency keys to prevent duplicate trades
9. **Exchange Allowlists**: Maintain exchange allowlists for trusted platforms only
10. **Progressive Limits**: Implement progressive limits for new trading pairs
11. **Pattern Monitoring**: Monitor for unusual trading patterns and potential manipulation
12. **Multi-signature Wallets**: Use multi-signature wallets for high-value transactions

## Support

- [Documentation](https://aport.io/docs/policies/finance.crypto.trade.v1)
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
    "exchange_id",
    "pair",
    "side",
    "amount_usd"
  ],
  "properties": {
    "exchange_id": {
      "type": "string",
      "description": "The exchange where the trade is being executed (e.g., 'coinbase', 'binance')."
    },
    "pair": {
      "type": "string",
      "pattern": "^[A-Z]+-[A-Z]+$",
      "description": "The trading pair (e.g., 'BTC-USD')."
    },
    "side": {
      "type": "string",
      "enum": [
        "buy",
        "sell"
      ],
      "description": "The side of the trade."
    },
    "amount_usd": {
      "type": "integer",
      "description": "The total value of the trade in USD minor units (cents)."
    },
    "source_wallet_type": {
      "type": "string",
      "enum": [
        "hot",
        "cold",
        "custodial"
      ],
      "description": "The type of wallet initiating the trade."
    }
  }
}
```

You can also fetch this live via the discovery endpoint:

```bash
curl -s "https://aport.io/api/policies/finance.crypto.trade.v1?format=schema"
```

