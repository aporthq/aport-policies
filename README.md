# 🛡️ APort Policy Packs

> **Open Agent Passport (OAP) v1.0 compliant policy definitions for AI agent governance**

This directory contains production-ready policy packs that implement the [Open Agent Passport (OAP) v1.0 specification](https://github.com/aporthq/aport-spec) for real-time AI agent authorization and policy enforcement.

## 🎯 What Are Policy Packs?

Policy packs are **pre-built, OAP-compliant policy definitions** that provide instant governance for your most sensitive AI agent operations. Each pack includes:

- **📋 Standardized Rules** - OAP v1.0 compliant evaluation logic
- **🔐 Capability Requirements** - What agents need to perform actions
- **⚡ Real-time Enforcement** - Sub-100ms policy decisions
- **🛡️ Security Controls** - Multi-level assurance and limits
- **📊 Audit Trail** - Cryptographically signed decisions

## 🚀 Available Policy Packs

### 🤖 **Agent Management**

| Policy Pack | Capability | Min Assurance | Key Features |
|-------------|------------|---------------|--------------|
| **`agent.session.create.v1`** | `agent.session.create` | L0 | Session limits, duration restrictions, concurrent session controls |
| **`agent.tool.register.v1`** | `agent.tool.register` | L0 | Tool naming conventions, capability declarations, registration limits |

### 💳 **Finance & Payments**

| Policy Pack | Capability | Min Assurance | Key Features |
|-------------|------------|---------------|--------------|
| **`finance.payment.charge.v1`** | `payments.charge` | L2 | Multi-currency limits, merchant allowlists, category blocking |
| **`finance.payment.refund.v1`** | `finance.payment.refund` | L2 | Cross-currency denial, reason codes, order validation |
| **`finance.payment.payout.v1`** | `payments.payout` | L3 | Per-currency caps, destination restrictions, compliance requirements |
| **`finance.transaction.execute.v1`** | `finance.transaction` | L3 | Transaction limits, risk scoring, compliance checks |
| **`finance.crypto.trade.v1`** | `finance.crypto.trade` | L3 | Crypto trading limits, exchange validation, volatility controls |

### 📊 **Data & Privacy**

| Policy Pack | Capability | Min Assurance | Key Features |
|-------------|------------|---------------|--------------|
| **`data.export.create.v1`** | `data.export` | L1 | Row limits, PII handling, format validation |
| **`data.report.ingest.v1`** | `data.report.ingest` | L2 | Data quality checks, schema validation, rate limiting |
| **`governance.data.access.v1`** | `data.access` | L3 | Access controls, data classification, audit logging |

### 🔀 **Code & Infrastructure**

| Policy Pack | Capability | Min Assurance | Key Features |
|-------------|------------|---------------|--------------|
| **`code.repository.merge.v1`** | `repo.merge`, `repo.pr.create` | L2 | PR limits, path restrictions, review requirements |
| **`code.release.publish.v1`** | `release` | L3 | Release validation, environment checks, approval workflows |

### ⚙️ **System & Tools**

| Policy Pack | Capability | Min Assurance | Key Features |
|-------------|------------|---------------|--------------|
| **`system.command.execute.v1`** | `system.command.execute` | L0 | Command allowlists, blocked patterns, execution time limits |
| **`mcp.tool.execute.v1`** | `mcp.tool.execute` | L0 | Server allowlists, tool restrictions, parameter validation |

### 💬 **Communication**

| Policy Pack | Capability | Min Assurance | Key Features |
|-------------|------------|---------------|--------------|
| **`messaging.message.send.v1`** | `messaging.send` | L1 | Rate limiting, channel restrictions, mention policies |

### ⚖️ **Legal & Compliance**

| Policy Pack | Capability | Min Assurance | Key Features |
|-------------|------------|---------------|--------------|
| **`legal.contract.review.v1`** | `legal.contract.review` | L3 | Firm-specific guardrails, privilege protection, attorney supervision |

## 🏗️ Policy Pack Structure

All policy packs follow the [OAP v1.0 specification](https://github.com/aporthq/aport-spec) and include:

### **Core OAP Fields**
```json
{
  "id": "finance.payment.charge.v1",
  "name": "Payment Charge Policy", 
  "description": "Pre-action governance for agent-initiated payments...",
  "version": "1.0.0",
  "status": "active",
  "requires_capabilities": ["payments.charge"],
  "min_assurance": "L2"
}
```

### **OAP Compliance Features**
- ✅ **Standardized Error Codes** - Uses `oap.*` error codes
- ✅ **JSON Schema Validation** - Full context validation via `required_context`
- ✅ **Nested Limits Structure** - `limits.{capability}.*` format
- ✅ **Capability-based Authorization** - Proper capability checking
- ✅ **Assurance Level Validation** - Dynamic assurance requirements
- ✅ **Idempotency Support** - Duplicate prevention
- ✅ **Cache Configuration** - TTL and invalidation settings

### **Evaluation Rules**
```json
{
  "evaluation_rules_version": "1.0",
  "evaluation_rules": [
    {
      "name": "command_allowlist",
      "type": "expression",
      "condition": "limits.allowed_commands.includes('*') || limits.allowed_commands.includes(context.command)",
      "deny_code": "oap.command_not_allowed",
      "description": "Command must be in allowed list"
    },
    {
      "name": "blocked_patterns",
      "type": "custom_validator",
      "validator": "validateBlockedPatterns",
      "deny_code": "oap.blocked_pattern",
      "description": "Command must not contain blocked patterns"
    }
  ]
}
```

**Note**: Evaluation rules support two types:
- **`expression`**: Uses the `condition` field with JavaScript-like expressions
- **`custom_validator`**: Uses the `validator` field to reference custom validation functions

## 🛠️ Implementation Examples

### Express.js Middleware
```javascript
const { requirePolicy } = require("@aporthq/middleware-express");

// Apply payment charge policy
app.post("/api/charges", 
  requirePolicy("finance.payment.charge.v1"),
  async (req, res) => {
    // Policy already verified! Check specific limits
    const passport = req.policyResult.passport;
    
    if (req.body.amount > passport.limits.payments.charge.currency_limits.USD.max_per_tx) {
      return res.status(403).json({
        error: "Charge exceeds limit",
        requested: req.body.amount,
        limit: passport.limits.payments.charge.currency_limits.USD.max_per_tx
      });
    }

    // Process charge safely
    const charge = await stripe.charges.create(req.body);
    res.json({ success: true, charge });
  }
);
```

### FastAPI Middleware
```python
from aport.middleware import require_policy

@app.post("/api/charges")
@require_policy("finance.payment.charge.v1")
async def create_charge(request: Request, charge_data: dict):
    passport = request.state.policy_result.passport
    
    # Check currency limits
    currency_limits = passport.limits["payments.charge"]["currency_limits"]
    if charge_data["amount"] > currency_limits[charge_data["currency"]]["max_per_tx"]:
        raise HTTPException(403, {
            "error": "Charge exceeds limit",
            "requested": charge_data["amount"],
            "limit": currency_limits[charge_data["currency"]]["max_per_tx"]
        })
    
    # Process charge safely
    return {"success": True, "charge_id": f"chg_{int(time.time())}"}
```

### GitHub Actions Integration
```yaml
name: APort Verify PR
on: [pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Verify via APort
        run: |
          curl -s -X POST "https://api.aport.io/api/verify/policy/code.repository.merge.v1" \
            -H "Content-Type: application/json" \
            -d '{
              "agent_id": "${{ secrets.APORT_AGENT_ID }}",
              "context": {
                "repo": "${{ github.repository }}",
                "base": "${{ github.event.pull_request.base.ref }}",
                "head": "${{ github.event.pull_request.head.ref }}",
                "files_changed": ${{ toJson(github.event.pull_request.changed_files) }},
                "author": "${{ github.event.pull_request.user.login }}"
              }
            }'
        env:
          APORT_AGENT_ID: ${{ secrets.APORT_AGENT_ID }}
```

## 🔧 Creating Custom Policy Packs

### 1. Use the Template
Copy `policy-template.json` and replace placeholders:
```bash
cp policy-template.json my-custom-policy.v1.json
```

### 2. Define Context Schema
Update `required_context` with your specific fields:
```json
{
  "type": "object",
  "required": ["amount", "currency", "merchant_id"],
  "properties": {
    "amount": {
      "type": "number",
      "minimum": 0.01,
      "description": "Transaction amount"
    },
    "currency": {
      "type": "string",
      "enum": ["USD", "EUR", "GBP"],
      "description": "Transaction currency"
    }
  }
}
```

### 3. Add Evaluation Rules
Define OAP-compliant evaluation rules:
```json
{
  "evaluation_rules": [
    {
      "name": "amount_within_limits",
      "condition": "context.amount <= limits.my_capability.max_amount",
      "deny_code": "oap.limit_exceeded",
      "description": "Transaction amount exceeds allowed limit"
    }
  ]
}
```

### 4. Configure Enforcement
Set up enforcement rules in the `enforcement` object:
```json
{
  "enforcement": {
    "assurance_required": "limits.my_capability.require_assurance_at_least",
    "idempotency_required": true,
    "custom_rule": "limits.my_capability.custom_limit"
  }
}
```

## 🧪 Testing Policy Packs

Each policy pack includes comprehensive test suites:

### Test Structure
```
policy-name.v1/
├── policy.json              # Policy definition
├── README.md                # Documentation
├── express.example.js       # Express.js example
├── fastapi.example.py       # FastAPI example
├── minimal-example.js       # Minimal implementation
└── tests/
    ├── passport.template.json    # Template passport
    ├── passport.instance.json    # Instance passport
    ├── contexts.jsonl           # Test contexts
    ├── expected.jsonl           # Expected decisions
    ├── policy-name.test.js      # JavaScript tests
    └── test_policy_name.py      # Python tests
```

### Running Tests
```bash
# JavaScript tests
npm test

# Python tests  
python -m pytest

# Conformance testing
npx @aporthq/oap-conformance policy-name.v1/
```

## 📊 OAP Compliance Standards

### Error Codes
Always use OAP standard error codes:
- `oap.passport_suspended` - Agent is suspended
- `oap.assurance_insufficient` - Assurance level too low
- `oap.unknown_capability` - Missing required capability
- `oap.limit_exceeded` - Exceeded limits
- `oap.currency_unsupported` - Unsupported currency
- `oap.region_blocked` - Region not allowed
- `oap.idempotency_conflict` - Duplicate idempotency key

### Limits Structure
Use nested limits under capability names:
```json
{
  "limits": {
    "payments.charge": {
      "currency_limits": { 
        "USD": { "max_per_tx": 10000 },
        "EUR": { "max_per_tx": 8500 }
      },
      "require_assurance_at_least": "L2",
      "idempotency_required": true,
      "allowed_merchant_ids": ["merchant_123", "merchant_456"]
    }
  }
}
```

### Assurance Levels
- **L1** - Basic verification (email, domain)
- **L2** - Enhanced verification (GitHub, social proof)
- **L3** - High assurance (KYC, legal verification)

## 🔄 Migration Guide

### From Legacy Policies
1. Add missing OAP fields (`status`, `cache`, `evaluation_rules`)
2. Update error codes to OAP standard (`oap.*`)
3. Add JSON Schema validation (`required_context`)
4. Update limits structure to nested format
5. Add comprehensive evaluation rules

### Version Updates
- Update `version` field
- Update `updated_at` timestamp
- Document changes in policy description
- Maintain backward compatibility where possible

## 📚 Resources

- **[OAP v1.0 Specification](https://github.com/aporthq/aport-spec)** - Complete normative specification
- **[Policy Verification API](../functions/api/verify/policy/)** - Real-time policy evaluation
- **[Middleware Examples](../middleware/)** - Framework integrations
- **[SDK Documentation](../sdk/)** - Client libraries
- **[Conformance Testing](https://github.com/aporthq/aport-spec/tree/main/conformance)** - OAP compliance validation

## 🤝 Contributing

We welcome contributions to policy packs! Whether it's:

- 🐛 **Bug fixes** in existing policies
- ✨ **New policy packs** for additional use cases
- 📚 **Documentation** improvements
- 🧪 **Test coverage** enhancements

Check out our [Contributing Guide](CONTRIBUTING.md) to get started.

---

**🛡️ Secure your AI agents. Trust but verify.**

**Last Updated**: 2026-02-15 18:32:09 UTC