const express = require("express");
const { requirePolicy } = require("@aporthq/middleware-express");

const app = express();
app.use(express.json());

// Apply data export policy to all export routes
app.post("/exports", requirePolicy("data.export.v1"), async (req, res) => {
  try {
    const { format, include_pii, filters } = req.body;
    const passport = req.policyResult.passport;

    // Check PII permission
    if (include_pii && !passport.limits.allow_pii) {
      return res.status(403).json({
        error: "PII export not allowed",
        agent_id: passport.agent_id,
        upgrade_instructions:
          "Request PII export capability from your administrator",
      });
    }

    // Estimate row count (in real app, query your database)
    const estimatedRows = await estimateExportRows(filters);

    // Check row limit
    if (estimatedRows > passport.limits.max_export_rows) {
      return res.status(403).json({
        error: "Export exceeds row limit",
        requested: estimatedRows,
        limit: passport.limits.max_export_rows,
        upgrade_instructions: "Request smaller export or upgrade limits",
      });
    }

    // Process export
    const export_id = await createExport({
      format,
      include_pii,
      filters,
      agent_id: passport.agent_id,
      agent_name: passport.name,
      estimated_rows: estimatedRows,
    });

    // Log the export request
    console.log(
      `Export created: ${export_id} (${estimatedRows} rows) by agent ${passport.agent_id}`
    );

    res.json({
      success: true,
      export_id,
      format,
      estimated_rows: estimatedRows,
      status: "processing",
    });
  } catch (error) {
    console.error("Export creation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get export status
app.get(
  "/exports/:export_id",
  requirePolicy("data.export.v1"),
  async (req, res) => {
    try {
      const { export_id } = req.params;
      const passport = req.policyResult.passport;

      const export_info = await getExportStatus(export_id, passport.agent_id);

      if (!export_info) {
        return res.status(404).json({ error: "Export not found" });
      }

      res.json(export_info);
    } catch (error) {
      console.error("Export status error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Download export file
app.get(
  "/exports/:export_id/download",
  requirePolicy("data.export.v1"),
  async (req, res) => {
    try {
      const { export_id } = req.params;
      const passport = req.policyResult.passport;

      const export_file = await getExportFile(export_id, passport.agent_id);

      if (!export_file) {
        return res.status(404).json({ error: "Export file not found" });
      }

      if (export_file.status !== "completed") {
        return res.status(400).json({ error: "Export not ready for download" });
      }

      // Set appropriate headers for file download
      res.setHeader("Content-Type", export_file.content_type);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${export_file.filename}"`
      );
      res.send(export_file.data);
    } catch (error) {
      console.error("Export download error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Mock functions
async function estimateExportRows(filters) {
  // Simulate database query to estimate rows
  await new Promise((resolve) => setTimeout(resolve, 50));
  return Math.floor(Math.random() * 10000) + 1000;
}

async function createExport({
  format,
  include_pii,
  filters,
  agent_id,
  estimated_rows,
}) {
  // Simulate export creation
  await new Promise((resolve) => setTimeout(resolve, 100));
  return `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function getExportStatus(export_id, agent_id) {
  // Simulate export status lookup
  await new Promise((resolve) => setTimeout(resolve, 50));
  return {
    export_id,
    status: "completed",
    created_at: new Date().toISOString(),
    estimated_rows: 5000,
    actual_rows: 4876,
    format: "csv",
    include_pii: false,
  };
}

async function getExportFile(export_id, agent_id) {
  // Simulate file retrieval
  await new Promise((resolve) => setTimeout(resolve, 50));
  return {
    data: "name,email,created_at\nJohn Doe,john@example.com,2024-01-01",
    content_type: "text/csv",
    filename: `export_${export_id}.csv`,
    status: "completed",
  };
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Data export service running on port ${PORT}`);
  console.log("Protected by APort data.export.v1 policy pack");
});
