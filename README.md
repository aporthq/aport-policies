# Policy Templates and Guidelines

This directory contains OAP-compliant policy definitions and a unified template for creating new policies.

## 📋 **Policy Structure Overview**

All policies follow the Open Agent Protocol (OAP) specification and include:

### **Required Fields**
- `id` - Unique policy identifier (e.g., "finance.payment.charge.v1")
- `name` - Human-readable policy name
- `description` - Detailed policy description
- `version` - Semantic version (e.g., "1.0.0")
- `status` - Policy status ("active", "draft", "deprecated")
- `requires_capabilities` - Array of required capabilities
- `min_assurance` - Minimum assurance level required
- `limits_required` - Array of required limit keys
- `required_fields` - Required context fields
- `optional_fields` - Optional context fields
- `enforcement` - Policy enforcement rules
- `mcp` - Model Context Protocol configuration
- `advice` - Implementation guidance
- `required_context` - JSON Schema for context validation
- `evaluation_rules` - OAP-compliant evaluation rules
- `cache` - Caching configuration
- `created_at` / `updated_at` - Timestamps

### **OAP Compliance Features**
- ✅ **Standardized Error Codes** - Uses `oap.*` error codes
- ✅ **JSON Schema Validation** - Full context validation
- ✅ **Nested Limits Structure** - `limits.{capability}.*` format
- ✅ **Capability-based Authorization** - Proper capability checking
- ✅ **Assurance Level Validation** - Dynamic assurance requirements
- ✅ **Idempotency Support** - Duplicate prevention
- ✅ **Cache Configuration** - TTL and invalidation settings

## 🏗️ **Creating New Policies**

### **1. Use the Template**
Copy `policy-template.json` and replace placeholders:
- `{operation}` - Operation name (e.g., "charge", "refund")
- `{capability.name}` - Capability identifier (e.g., "payments.charge")
- `{Brief description}` - Policy purpose description

### **2. Define Context Schema**
Update `required_context` with your specific fields:
```json
{
  "required": ["field1", "field2"],
  "properties": {
    "field1": {
      "type": "string",
      "minLength": 1,
      "description": "Field description"
    }
  }
}
```

### **3. Add Evaluation Rules**
Define OAP-compliant evaluation rules:
```json
{
  "name": "rule_name",
  "condition": "passport.status == 'active'",
  "deny_code": "oap.passport_suspended",
  "description": "Rule description"
}
```

### **4. Configure Enforcement**
Set up enforcement rules in the `enforcement` object:
```json
{
  "assurance_required": "limits.{capability}.require_assurance_at_least",
  "idempotency_required": true,
  "custom_rule": "limits.{capability}.custom_limit"
}
```

## 📊 **Policy Comparison**

| **Policy** | **Capability** | **Min Assurance** | **Key Features** |
|------------|----------------|-------------------|------------------|
| `finance.payment.charge.v1` | `payments.charge` | L2 | Multi-currency, merchant allowlists, category blocking |
| `finance.payment.refund.v1` | `finance.payment.refund` | L2 | Cross-currency denial, reason codes, order validation |
| `data.export.create.v1` | `data.export` | L1 | Row limits, PII handling, format validation |
| `messaging.message.send.v1` | `messaging.send` | L1 | Rate limiting, channel restrictions, mention policies |
| `code.repository.merge.v1` | `repo.pr.create`, `repo.merge` | L2 | PR limits, path restrictions, review requirements |

## 🔧 **Implementation Guidelines**

### **Error Codes**
Always use OAP standard error codes:
- `oap.passport_suspended` - Agent is suspended
- `oap.assurance_insufficient` - Assurance level too low
- `oap.unknown_capability` - Missing required capability
- `oap.limit_exceeded` - Exceeded limits
- `oap.currency_unsupported` - Unsupported currency
- `oap.region_blocked` - Region not allowed
- `oap.idempotency_conflict` - Duplicate idempotency key

### **Limits Structure**
Use nested limits under capability names:
```json
{
  "limits": {
    "payments.charge": {
      "currency_limits": { "USD": { "max_per_tx": 10000 } },
      "require_assurance_at_least": "L2",
      "idempotency_required": true
    }
  }
}
```

### **Evaluation Rules**
Follow OAP evaluation rule format:
- Use clear, descriptive names
- Write conditions in simple expressions
- Use OAP deny codes
- Include helpful descriptions

## 🧪 **Testing**

Each policy should include:
- `tests/passport.template.json` - Template passport
- `tests/passport.instance.json` - Instance passport
- `tests/contexts.jsonl` - Test contexts
- `tests/expected.jsonl` - Expected decisions
- `tests/{policy-name}.test.js` - JavaScript tests
- `tests/test_{policy_name}.py` - Python tests

## 📚 **Resources**

- [OAP Specification](../spec/oap/)
- [Policy Verification API](../functions/api/verify/policy/)
- [Middleware Examples](../middleware/)
- [SDK Documentation](../sdk/)

## 🔄 **Migration Guide**

### **From Legacy Policies**
1. Add missing OAP fields (`status`, `cache`, `evaluation_rules`)
2. Update error codes to OAP standard (`oap.*`)
3. Add JSON Schema validation (`required_context`)
4. Update limits structure to nested format
5. Add comprehensive evaluation rules

### **Version Updates**
- Update `version` field
- Update `updated_at` timestamp
- Document changes in policy description
- Maintain backward compatibility where possible

---

**Last Updated**: 2025-10-08 14:54:16 UTC
