# Report Data Ingestion Policy Pack v1

Protect your data ingestion endpoints with APort's standardized policy pack. This pack ensures only verified agents with proper capabilities, assurance levels, and data quality controls can ingest report data with appropriate validation and monitoring.

## What This Pack Protects

- **Route**: `/data/report/ingest/*` (POST)
- **Risk**: Data quality issues, stale data, unauthorized sources, compliance violations
- **Impact**: Poor reporting quality, regulatory violations, audit findings, data integrity issues

## Requirements

| Requirement | Value | Description |
|-------------|-------|-------------|
| **Capability** | `data.report.ingest` | Agent must have data ingestion capability |
| **Assurance** | `L2` or higher | Standard verification minimum |
| **Limits** | `approved_sources.{report_type}[]` | Approved data sources per report type |
| **Limits** | `max_data_age_seconds.{report_type}` | Maximum data age per report type |
| **Limits** | `max_data_size_mb.{report_type}` | Maximum data size per report type |
| **Limits** | `max_ingest_frequency_per_hour.{report_type}` | Maximum ingestion frequency |
| **Limits** | `data_quality_threshold.{report_type}` | Minimum data quality score |
| **Limits** | `required_validation_checks.{report_type}[]` | Required validation checks |
| **Regions** | Must match | Agent must be authorized in caller's region |
| **Idempotency** | Required | Prevents duplicate ingestion |

## Implementation

### Express.js

```javascript
const { requirePolicy } = require('@aporthq/middleware-express');

// Option 1: Explicit agent ID (preferred)
app.post('/data/report/ingest', 
  requirePolicy('data.report.ingest.v1', 'ap_a2d10232c6534523812423eec8a1425c45678'), 
  async (req, res) => {
    // Your data ingestion logic here
    // req.policyResult contains the verified passport
    const { report_type, data_source_id, data_timestamp } = req.body;
    const passport = req.policyResult.passport;
    
    // Process data ingestion...
    res.json({ success: true, ingest_id: generateId() });
  }
);
```

**Client Request Example:**
```javascript
fetch('/data/report/ingest', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Agent-Passport-Id': 'ap_a2d10232c6534523812423eec8a1425c45678'
  },
  body: JSON.stringify({
    report_type: "ESG",
    data_source_id: "api.climate-data.com",
    data_timestamp: "2025-01-30T10:00:00Z",
    metric_type: "carbon_emissions",
    data_size_mb: 5.2,
    validation_checks: ["schema_validation", "range_check"],
    data_quality_score: 0.95,
    idempotency_key: "ingest-esg-123"
  })
});
```

## Best Practices

1. **Cache Verification**: Cache `/verify` responses with ETag for 300 seconds
2. **Webhook Integration**: Subscribe to `status.changed` webhooks for instant suspension
3. **Verifiable Attestation**: Log all data ingestion attempts for compliance
4. **Data Quality Scoring**: Implement data quality scoring before ingestion
5. **Data Lineage Tracking**: Use data lineage tracking for audit compliance
6. **Progressive Validation**: Implement progressive data validation checks
7. **Anomaly Monitoring**: Monitor for data anomalies and unusual patterns
8. **Data Encryption**: Use data encryption for sensitive report data
9. **Data Retention**: Implement data retention policies based on report type
10. **Source Reputation**: Maintain data source reputation scoring
11. **Idempotency**: Use idempotency keys to prevent duplicate ingestion
12. **Freshness Monitoring**: Implement data freshness monitoring and alerts

## Support

- [Documentation](https://aport.io/docs/policies/data.report.ingest.v1)
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
    "report_type",
    "data_source_id",
    "data_timestamp"
  ],
  "properties": {
    "report_type": {
      "type": "string",
      "description": "The type of report being generated (e.g., 'ESG', 'QuarterlyFinancials')."
    },
    "data_source_id": {
      "type": "string",
      "description": "A unique identifier for the source of the data being ingested (e.g., 'api.climate-data.com', 'internal-hr-db')."
    },
    "data_timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "The ISO 8601 timestamp of when the data was generated."
    },
    "metric_type": {
      "type": "string",
      "description": "The specific metric this data point relates to (e.g., 'carbon_emissions', 'employee_diversity')."
    }
  }
}
```

You can also fetch this live via the discovery endpoint:

```bash
curl -s "https://aport.io/api/policies/data.report.ingest.v1?format=schema"
```

