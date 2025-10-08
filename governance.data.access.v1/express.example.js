const express = require("express");
const { requirePolicy } = require("@aporthq/middleware-express");

const app = express();
app.use(express.json());

// Apply governance.data.access policy to all data access routes
app.get(
  "/data/access",
  requirePolicy("governance.data.access.v1"),
  async (req, res) => {
    try {
      const {
        data_classification,
        accessing_entity_id,
        accessing_entity_type,
        resource_id,
        action_type,
        jurisdiction,
        row_count,
        destination_jurisdiction,
        resource_attributes,
      } = req.query;

      const passport = req.policyResult.passport;

      // Additional business logic validation
      if (!data_classification || !accessing_entity_id || !resource_id) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      // Process data access using your data system
      const access_id = await processDataAccess({
        data_classification,
        accessing_entity_id,
        accessing_entity_type,
        resource_id,
        action_type: action_type || "read",
        jurisdiction,
        row_count: row_count ? parseInt(row_count) : undefined,
        destination_jurisdiction,
        resource_attributes: resource_attributes
          ? JSON.parse(resource_attributes)
          : undefined,
        agent_id: passport.passport_id,
        agent_name: passport.metadata?.template_name || "Unknown Agent",
      });

      // Log the data access
      console.log(
        `Data access processed: ${access_id} for ${data_classification} data by agent ${passport.passport_id}`
      );

      res.json({
        success: true,
        access_id,
        data_classification,
        resource_id,
        action_type: action_type || "read",
        status: "processed",
        decision_id: req.policyResult.decision_id,
      });
    } catch (error) {
      console.error("Data access processing error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Data export endpoint
app.post(
  "/data/export",
  requirePolicy("governance.data.access.v1"),
  async (req, res) => {
    try {
      const {
        data_classification,
        accessing_entity_id,
        accessing_entity_type,
        resource_id,
        action_type,
        jurisdiction,
        row_count,
        destination_jurisdiction,
        export_format,
        filters,
      } = req.body;

      const passport = req.policyResult.passport;

      // Check row count limits
      const maxRowsPerExport =
        passport.limits?.data?.access?.max_rows_per_export;
      if (maxRowsPerExport && row_count > maxRowsPerExport) {
        return res.status(403).json({
          error: "Export row count exceeds limit",
          row_count,
          limit: maxRowsPerExport,
        });
      }

      // Process data export
      const export_id = await processDataExport({
        data_classification,
        accessing_entity_id,
        accessing_entity_type,
        resource_id,
        action_type: action_type || "export",
        jurisdiction,
        row_count,
        destination_jurisdiction,
        export_format,
        filters,
        agent_id: passport.passport_id,
      });

      res.json({
        success: true,
        export_id,
        data_classification,
        row_count,
        export_format,
        status: "exported",
        decision_id: req.policyResult.decision_id,
      });
    } catch (error) {
      console.error("Data export error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Balance inquiry endpoint
app.get(
  "/data/balance/:account_id",
  requirePolicy("governance.data.access.v1"),
  async (req, res) => {
    try {
      const { account_id } = req.params;
      const { accessing_entity_id, accessing_entity_type } = req.query;
      const passport = req.policyResult.passport;

      // Get account balance
      const balance_info = await getAccountBalance(
        account_id,
        accessing_entity_id,
        passport.passport_id
      );

      if (!balance_info) {
        return res.status(404).json({ error: "Account not found" });
      }

      // Check balance inquiry limits
      const balanceInquiryCap =
        passport.limits?.data?.access?.balance_inquiry_cap_usd;
      if (balanceInquiryCap && balance_info.balance_usd >= balanceInquiryCap) {
        return res.status(403).json({
          error: "Account balance exceeds inquiry cap",
          balance: balance_info.balance_usd,
          cap: balanceInquiryCap,
        });
      }

      res.json({
        success: true,
        account_id,
        balance_usd: balance_info.balance_usd,
        currency: balance_info.currency,
        last_updated: balance_info.last_updated,
        decision_id: req.policyResult.decision_id,
      });
    } catch (error) {
      console.error("Balance inquiry error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Data access audit endpoint
app.get(
  "/data/access/audit",
  requirePolicy("governance.data.access.v1"),
  async (req, res) => {
    try {
      const { start_date, end_date, data_classification } = req.query;
      const passport = req.policyResult.passport;

      const audit_logs = await getDataAccessAuditLogs({
        start_date,
        end_date,
        data_classification,
        agent_id: passport.passport_id,
      });

      res.json({
        success: true,
        audit_logs,
        total_entries: audit_logs.length,
        decision_id: req.policyResult.decision_id,
      });
    } catch (error) {
      console.error("Audit log error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Mock data access processing function
async function processDataAccess({
  data_classification,
  accessing_entity_id,
  accessing_entity_type,
  resource_id,
  action_type,
  jurisdiction,
  row_count,
  destination_jurisdiction,
  resource_attributes,
  agent_id,
}) {
  // Simulate data system call
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Log data access details for audit
  console.log(`Processing data access:`, {
    data_classification,
    accessing_entity_id,
    accessing_entity_type,
    resource_id,
    action_type,
    jurisdiction,
    row_count,
    destination_jurisdiction,
    resource_attributes,
    agent_id,
  });

  return `access_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Mock data export processing function
async function processDataExport({
  data_classification,
  accessing_entity_id,
  accessing_entity_type,
  resource_id,
  action_type,
  jurisdiction,
  row_count,
  destination_jurisdiction,
  export_format,
  filters,
  agent_id,
}) {
  // Simulate data export processing
  await new Promise((resolve) => setTimeout(resolve, 200));

  console.log(`Processing data export:`, {
    data_classification,
    accessing_entity_id,
    accessing_entity_type,
    resource_id,
    action_type,
    jurisdiction,
    row_count,
    destination_jurisdiction,
    export_format,
    filters,
    agent_id,
  });

  return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Mock account balance lookup
async function getAccountBalance(account_id, accessing_entity_id, agent_id) {
  // Simulate account balance lookup
  await new Promise((resolve) => setTimeout(resolve, 50));
  return {
    account_id,
    balance_usd: 50000, // $500.00 in cents
    currency: "USD",
    last_updated: new Date().toISOString(),
  };
}

// Mock audit log lookup
async function getDataAccessAuditLogs({
  start_date,
  end_date,
  data_classification,
  agent_id,
}) {
  // Simulate audit log lookup
  await new Promise((resolve) => setTimeout(resolve, 100));
  return [
    {
      access_id: "access_123",
      data_classification: "PII",
      resource_id: "user_456",
      action_type: "read",
      timestamp: new Date().toISOString(),
      agent_id,
    },
    {
      access_id: "access_124",
      data_classification: "Financial",
      resource_id: "account_789",
      action_type: "export",
      timestamp: new Date().toISOString(),
      agent_id,
    },
  ];
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Data access governance service running on port ${PORT}`);
  console.log("Protected by APort governance.data.access.v1 policy pack");
});
