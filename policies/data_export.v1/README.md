# Data Export Protection Policy Pack v1

Protect your data export endpoints with APort's standardized policy pack. This pack ensures only verified agents with proper capabilities, row limits, and PII handling can export sensitive data.

## What This Pack Protects

- **Route**: `/exports/*` (GET, POST)
- **Risk**: Data breaches, privacy violations, regulatory non-compliance
- **Impact**: Customer data exposure, GDPR/CCPA violations, reputation damage

## Requirements

| Requirement | Value | Description |
|-------------|-------|-------------|
| **Capability** | `data.export` | Agent must have data export capability |
| **Assurance** | `L1` or higher | Email verification minimum |
| **Limits** | `max_export_rows` | Maximum number of rows per export |
| **Limits** | `allow_pii` | Whether PII can be included in exports |

## Implementation

### Express.js

```javascript
const { requirePolicy } = require('@aporthq/middleware-express');

app.post('/exports', requirePolicy('data_export.v1'), async (req, res) => {
  // Your export logic here
  // req.policyResult contains the verified passport
  const { format, include_pii } = req.body;
  const passport = req.policyResult.passport;
  
  // Check PII permission
  if (include_pii && !passport.limits.allow_pii) {
    return res.status(403).json({ error: 'PII export not allowed' });
  }
  
  // Process export...
  res.json({ success: true, export_id: generateId() });
});
```

### FastAPI

```python
from aport.middleware import require_policy

@app.post("/exports")
@require_policy("data_export.v1")
async def create_export(request: Request, export_data: ExportRequest):
    # Your export logic here
    # request.state.policy_result contains the verified passport
    passport = request.state.policy_result.passport
    
    # Check PII permission
    if export_data.include_pii and not passport.limits.allow_pii:
        raise HTTPException(status_code=403, detail="PII export not allowed")
    
    # Process export...
    return {"success": True, "export_id": generate_id()}
```

## Error Responses

When policy checks fail, you'll receive a `403 Forbidden` with detailed error information:

```json
{
  "error": "policy_violation",
  "code": "EXCEEDS_ROW_LIMIT",
  "message": "Requested 10000 rows exceeds limit 5000",
  "policy_id": "data_export.v1",
  "agent_id": "ap_128094d345678",
  "upgrade_instructions": "Request smaller export or upgrade limits"
}
```

## Test Payloads

### Valid Request (CSV export)
```json
{
  "format": "csv",
  "include_pii": false,
  "filters": {
    "date_range": "2024-01-01 to 2024-12-31"
  }
}
```

### Valid Request (with PII)
```json
{
  "format": "json",
  "include_pii": true,
  "filters": {
    "user_id": "12345"
  }
}
```
*Requires `allow_pii: true` in agent limits*

### Invalid Request (exceeds row limit)
```json
{
  "format": "csv",
  "include_pii": false,
  "filters": {
    "date_range": "2020-01-01 to 2024-12-31"
  }
}
```
*Returns 403: "Requested 50000 rows exceeds limit 10000"*

## Best Practices

1. **Cache Verification**: Cache `/verify` responses with ETag for 60 seconds
2. **Webhook Integration**: Subscribe to `status.changed` webhooks for instant suspension
3. **Data Retention**: Implement data retention policies for exported files
4. **Audit Logging**: Log all export attempts for compliance
5. **PII Handling**: Clearly separate PII and non-PII export capabilities

## Compliance Badge

Agents that meet this policy's requirements can display the "Data Export-Ready" badge:

```markdown
[![Data Export-Ready](https://api.aport.io/badge/ap_128094d345678.svg)](https://aport.io/agents/ap_128094d345678)
```

## Support

- [Documentation](https://aport.io/docs/policies/data_export.v1)
- [Community](https://github.com/aporthq/community)
- [Support](https://aport.io/support)
