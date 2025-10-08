const express = require("express");
const { requirePolicy } = require("@aporthq/middleware-express");

const app = express();
app.use(express.json());

// Apply payments.charge policy to all charge routes
app.post(
  "/payments/charge",
  requirePolicy("finance.payment.charge.v1"),
  async (req, res) => {
    try {
      const {
        amount,
        currency,
        merchant_id,
        region,
        shipping_country,
        items,
        risk_score,
        idempotency_key,
      } = req.body;

      const passport = req.policyResult.passport;

      // Additional business logic validation
      if (amount <= 0) {
        return res.status(400).json({ error: "Invalid charge amount" });
      }

      // Check if items are provided
      if (!items || items.length === 0) {
        return res.status(400).json({ error: "Items are required" });
      }

      // Process charge using your payment processor
      const charge_id = await processCharge({
        amount,
        currency,
        merchant_id,
        region,
        shipping_country,
        items,
        risk_score,
        idempotency_key,
        agent_id: passport.passport_id,
        agent_name: passport.metadata?.template_name || "Unknown Agent",
      });

      // Log the transaction
      console.log(
        `Charge processed: ${charge_id} for ${amount} ${currency} by agent ${passport.passport_id}`
      );

      res.json({
        success: true,
        charge_id,
        amount,
        currency,
        status: "processed",
        decision_id: req.policyResult.decision_id,
      });
    } catch (error) {
      console.error("Charge processing error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Batch charges endpoint
app.post(
  "/payments/charge/batch",
  requirePolicy("finance.payment.charge.v1"),
  async (req, res) => {
    try {
      const { charges } = req.body;
      const passport = req.policyResult.passport;

      // Group charges by currency for daily cap checking
      const currencyTotals = {};
      for (const charge of charges) {
        const currency = charge.currency || "USD";
        currencyTotals[currency] =
          (currencyTotals[currency] || 0) + (charge.amount || 0);
      }

      // Check daily caps per currency
      for (const [currency, totalAmount] of Object.entries(currencyTotals)) {
        const currencyLimits =
          passport.limits?.payments?.charge?.currency_limits?.[currency];
        if (
          currencyLimits?.daily_cap &&
          totalAmount > currencyLimits.daily_cap
        ) {
          return res.status(403).json({
            error: "Batch total exceeds daily cap",
            currency,
            total: totalAmount,
            limit: currencyLimits.daily_cap,
          });
        }
      }

      // Process batch charges
      const results = await Promise.all(
        charges.map((charge) =>
          processCharge({
            ...charge,
            agent_id: passport.passport_id,
          })
        )
      );

      res.json({
        success: true,
        processed: results.length,
        currency_totals: currencyTotals,
        decision_id: req.policyResult.decision_id,
      });
    } catch (error) {
      console.error("Batch charge error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Get charge status
app.get(
  "/payments/charge/:charge_id",
  requirePolicy("finance.payment.charge.v1"),
  async (req, res) => {
    try {
      const { charge_id } = req.params;
      const passport = req.policyResult.passport;

      const charge_info = await getChargeStatus(
        charge_id,
        passport.passport_id
      );

      if (!charge_info) {
        return res.status(404).json({ error: "Charge not found" });
      }

      res.json(charge_info);
    } catch (error) {
      console.error("Charge status error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Refund charge endpoint
app.post(
  "/payments/charge/:charge_id/refund",
  requirePolicy("finance.payment.charge.v1"),
  async (req, res) => {
    try {
      const { charge_id } = req.params;
      const { amount, reason } = req.body;
      const passport = req.policyResult.passport;

      const refund_id = await processRefund({
        charge_id,
        amount,
        reason,
        agent_id: passport.passport_id,
      });

      res.json({
        success: true,
        refund_id,
        charge_id,
        amount,
        status: "refunded",
        decision_id: req.policyResult.decision_id,
      });
    } catch (error) {
      console.error("Refund processing error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Mock charge processing function
async function processCharge({
  amount,
  currency,
  merchant_id,
  region,
  shipping_country,
  items,
  risk_score,
  idempotency_key,
  agent_id,
}) {
  // Simulate payment processor call
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Log charge details for audit
  console.log(`Processing charge:`, {
    amount,
    currency,
    merchant_id,
    region,
    shipping_country,
    items: items?.length || 0,
    risk_score,
    idempotency_key,
    agent_id,
  });

  return `chg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Mock charge status lookup
async function getChargeStatus(charge_id, agent_id) {
  // Simulate charge status lookup
  await new Promise((resolve) => setTimeout(resolve, 50));
  return {
    charge_id,
    status: "completed",
    created_at: new Date().toISOString(),
    amount: 1299,
    currency: "USD",
    merchant_id: "merch_abc",
    items: [{ sku: "SKU-1", qty: 1, category: "electronics" }],
  };
}

// Mock refund processing function
async function processRefund({ charge_id, amount, reason, agent_id }) {
  // Simulate refund processing
  await new Promise((resolve) => setTimeout(resolve, 100));

  console.log(`Processing refund:`, {
    charge_id,
    amount,
    reason,
    agent_id,
  });

  return `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Payment charge service running on port ${PORT}`);
  console.log("Protected by APort finance.payment.charge.v1 policy pack");
});
