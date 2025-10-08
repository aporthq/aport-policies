/**
 * Minimal Example: data.report.ingest.v1 Policy
 *
 * This is a quick-start example showing the basic usage of the data.report.ingest.v1 policy.
 * For production use, see the full express.example.js file.
 */

const express = require("express");
const { requirePolicy } = require("@aporthq/middleware-express");

const app = express();
app.use(express.json());

// Minimal data ingestion endpoint with policy protection
app.post(
  "/data/ingest",
  requirePolicy("data.report.ingest.v1"),
  async (req, res) => {
    try {
      const { report_type, data_source_id, data_timestamp } = req.body;
      const passport = req.policyResult.passport;

      // Process the data ingestion (your business logic here)
      const ingest_id = `ingest_${Date.now()}`;

      console.log(
        `Data ingestion processed: ${ingest_id} for ${report_type} report`
      );

      res.json({
        success: true,
        ingest_id,
        report_type,
        data_source_id,
        data_timestamp,
        decision_id: req.policyResult.decision_id,
      });
    } catch (error) {
      console.error("Data ingestion error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Example client request
const exampleRequest = {
  report_type: "ESG",
  data_source_id: "api.climate-data.com",
  data_timestamp: "2025-01-30T10:00:00Z",
  metric_type: "carbon_emissions",
  data_size_mb: 5.2,
  validation_checks: ["schema_validation", "range_check"],
  data_quality_score: 0.95,
  idempotency_key: "ingest-esg-123",
};

console.log("Example request:", JSON.stringify(exampleRequest, null, 2));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Minimal data ingestion service running on port ${PORT}`);
  console.log("Protected by APort data.report.ingest.v1 policy");
  console.log(
    `Try: curl -X POST http://localhost:${PORT}/data/ingest -H "Content-Type: application/json" -d '${JSON.stringify(
      exampleRequest
    )}'`
  );
});
