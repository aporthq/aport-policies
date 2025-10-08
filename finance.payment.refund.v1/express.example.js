const express = require("express");
const { requirePolicy } = require("@aporthq/middleware-express");

const app = express();
app.use(express.json());

// Apply refunds policy to all refund routes
app.post(
  "/refunds",
  requirePolicy("finance.payment.refund.v1"),
  async (req, res) => {
    try {
      const {
        amount_minor,
        currency,
        order_id,
        customer_id,
        reason_code,
        region,
        idempotency_key,
        order_currency,
        order_total_minor,
        already_refunded_minor,
        note,
        merchant_case_id,
      } = req.body;

      const passport = req.policyResult.passport;

      // Additional business logic validation
      if (amount_minor <= 0) {
        return res.status(400).json({ error: "Invalid refund amount" });
      }

      // Process refund using your payment processor
      const refund_id = await processRefund({
        amount_minor,
        currency,
        order_id,
        customer_id,
        reason_code,
        region,
        idempotency_key,
        order_currency,
        order_total_minor,
        already_refunded_minor,
        note,
        merchant_case_id,
        agent_id: passport.agent_id,
        agent_name: passport.name,
      });

      // Log the transaction
      console.log(
        `Refund processed: ${refund_id} for ${amount_minor} ${currency} by agent ${passport.agent_id}`
      );

      res.json({
        success: true,
        refund_id,
        amount_minor,
        currency,
        status: "processed",
        decision_id: req.policyResult.decision_id,
      });
    } catch (error) {
      console.error("Refund processing error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Batch refunds endpoint
app.post(
  "/refunds/batch",
  requirePolicy("finance.payment.refund.v1"),
  async (req, res) => {
    try {
      const { refunds } = req.body;
      const passport = req.policyResult.passport;

      // Group refunds by currency for daily cap checking
      const currencyTotals = {};
      for (const refund of refunds) {
        const currency = refund.currency || "USD";
        currencyTotals[currency] =
          (currencyTotals[currency] || 0) + (refund.amount_minor || 0);
      }

      // Check daily caps per currency
      for (const [currency, totalAmount] of Object.entries(currencyTotals)) {
        const currencyLimits = passport.limits?.currency_limits?.[currency];
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

      // Process batch refunds
      const results = await Promise.all(
        refunds.map((refund) =>
          processRefund({
            ...refund,
            agent_id: passport.agent_id,
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
      console.error("Batch refund error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Mock refund processing function
async function processRefund({
  amount_minor,
  currency,
  order_id,
  customer_id,
  reason_code,
  region,
  idempotency_key,
  order_currency,
  order_total_minor,
  already_refunded_minor,
  note,
  merchant_case_id,
  agent_id,
}) {
  // Simulate payment processor call
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Log refund details for audit
  console.log(`Processing refund:`, {
    amount_minor,
    currency,
    order_id,
    customer_id,
    reason_code,
    region,
    idempotency_key,
    agent_id,
  });

  return `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Refunds service running on port ${PORT}`);
  console.log("Protected by APort finance.payment.refund.v1 policy pack");
});
