/**
 * Minimal Refunds v1 Policy Example
 *
 * This is a simple, working example of how to use the refunds.v1 policy
 * with all required fields and proper error handling.
 */

const express = require("express");
const { requirePolicy } = require("@aporthq/middleware-express"); // Assuming this exists

const app = express();
app.use(express.json());

// Mock Agent ID for demonstration
const AGENT_ID = "agents/ap_minimal_refund_agent";

// Minimal Refund Endpoint
app.post(
  "/minimal-refund",
  requirePolicy("refunds.v1", AGENT_ID),
  async (req, res) => {
    try {
      // Extract required fields from request
      const {
        amount_minor, // Amount in smallest currency unit (e.g., cents)
        currency, // Currency code (e.g., "USD", "EUR", "JPY")
        order_id, // Unique order identifier
        customer_id, // Customer identifier
        reason_code, // Reason for refund (e.g., "defective")
        region, // Region code (e.g., "US", "EU", "APAC")
        idempotency_key, // Unique key to prevent duplicate refunds
      } = req.body;

      // Optional fields
      const {
        order_currency, // Original order currency
        order_total_minor, // Total order amount
        already_refunded_minor, // Already refunded amount
        note, // Additional notes
        merchant_case_id, // Merchant's case ID
      } = req.body;

      // Policy is already verified by middleware
      const policyResult = req.policyResult;

      if (!policyResult.allow) {
        return res.status(403).json({
          success: false,
          decision_id: policyResult.decision_id,
          error: "Policy violation",
          reasons: policyResult.reasons,
        });
      }

      // Simulate processing the refund
      const refund_id = `ref_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      console.log(
        `Minimal Refund Processed: ${refund_id} for ${amount_minor} ${currency} by agent ${policyResult.passport.agent_id}`
      );

      res.json({
        success: true,
        refund_id,
        amount_minor,
        currency,
        status: "processed",
        decision_id: policyResult.decision_id,
        remaining_daily_cap: policyResult.remaining_daily_cap,
      });
    } catch (error) {
      console.error("Minimal refund processing error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to process refund",
      });
    }
  }
);

// Batch Refund Endpoint (for multiple refunds)
app.post(
  "/minimal-batch-refund",
  requirePolicy("refunds.v1", AGENT_ID),
  async (req, res) => {
    try {
      const { refunds } = req.body; // Array of refund objects

      if (!Array.isArray(refunds) || refunds.length === 0) {
        return res.status(400).json({
          error: "Invalid request",
          message: "refunds array is required and must not be empty",
        });
      }

      const policyResult = req.policyResult;

      if (!policyResult.allow) {
        return res.status(403).json({
          success: false,
          decision_id: policyResult.decision_id,
          error: "Policy violation",
          reasons: policyResult.reasons,
        });
      }

      // Process each refund
      const results = [];
      for (const refund of refunds) {
        const refund_id = `ref_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;
        results.push({
          refund_id,
          amount_minor: refund.amount_minor,
          currency: refund.currency,
          status: "processed",
        });
      }

      res.json({
        success: true,
        processed_count: results.length,
        refunds: results,
        decision_id: policyResult.decision_id,
        remaining_daily_cap: policyResult.remaining_daily_cap,
      });
    } catch (error) {
      console.error("Batch refund processing error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to process batch refunds",
      });
    }
  }
);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "minimal-refunds",
    policy: "refunds.v1",
    agent_id: AGENT_ID,
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Minimal Refunds service running on port ${PORT}`);
  console.log("Protected by APort refunds.v1 policy pack");
  console.log("\nTo test (example for allowed refund):");
  console.log(`curl -X POST http://localhost:${PORT}/minimal-refund \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{`);
  console.log(`    "amount_minor": 7500,`);
  console.log(`    "currency": "USD",`);
  console.log(`    "order_id": "ORD-MIN-001",`);
  console.log(`    "customer_id": "CUST-MIN-001",`);
  console.log(`    "reason_code": "customer_request",`);
  console.log(`    "region": "US",`);
  console.log(`    "idempotency_key": "min_idempotency_key_123"`);
  console.log(`  }'`);
  console.log("\nTo test batch refunds:");
  console.log(`curl -X POST http://localhost:${PORT}/minimal-batch-refund \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{`);
  console.log(`    "refunds": [`);
  console.log(`      {`);
  console.log(`        "amount_minor": 5000,`);
  console.log(`        "currency": "USD",`);
  console.log(`        "order_id": "ORD-MIN-002",`);
  console.log(`        "customer_id": "CUST-MIN-002",`);
  console.log(`        "reason_code": "defective",`);
  console.log(`        "region": "US",`);
  console.log(`        "idempotency_key": "batch_key_001"`);
  console.log(`      }`);
  console.log(`    ]`);
  console.log(`  }'`);
});

module.exports = app;
