const express = require("express");
const { requirePolicy } = require("@aporthq/middleware-express");

const app = express();
app.use(express.json());

// Apply data.report.ingest policy to all data ingestion routes
app.post(
  "/data/report/ingest",
  requirePolicy("data.report.ingest.v1"),
  async (req, res) => {
    try {
      const {
        report_type,
        data_source_id,
        data_timestamp,
        metric_type,
        data_size_mb,
        validation_checks,
        data_quality_score,
        ingest_reason,
        idempotency_key,
      } = req.body;

      const passport = req.policyResult.passport;

      // Additional business logic validation
      if (!report_type || !data_source_id || !data_timestamp) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Process data ingestion using your data system
      const ingest_id = await processDataIngestion({
        report_type,
        data_source_id,
        data_timestamp,
        metric_type,
        data_size_mb,
        validation_checks,
        data_quality_score,
        ingest_reason,
        idempotency_key,
        agent_id: passport.passport_id,
        agent_name: passport.metadata?.template_name || "Unknown Agent",
      });

      // Log the ingestion
      console.log(
        `Data ingestion processed: ${ingest_id} for ${report_type} report by agent ${passport.passport_id}`
      );

      res.json({
        success: true,
        ingest_id,
        report_type,
        data_source_id,
        data_timestamp,
        status: "processed",
        decision_id: req.policyResult.decision_id,
      });
    } catch (error) {
      console.error("Data ingestion processing error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Mock data ingestion processing function
async function processDataIngestion({
  report_type,
  data_source_id,
  data_timestamp,
  metric_type,
  data_size_mb,
  validation_checks,
  data_quality_score,
  ingest_reason,
  idempotency_key,
  agent_id,
}) {
  // Simulate data system call
  await new Promise((resolve) => setTimeout(resolve, 150));

  // Log ingestion details for audit
  console.log(`Processing data ingestion:`, {
    report_type,
    data_source_id,
    data_timestamp,
    metric_type,
    data_size_mb,
    validation_checks,
    data_quality_score,
    ingest_reason,
    idempotency_key,
    agent_id,
  });

  return `ingest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Data ingestion service running on port ${PORT}`);
  console.log("Protected by APort data.report.ingest.v1 policy pack");
});
