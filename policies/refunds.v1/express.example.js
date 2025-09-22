const express = require("express");
const { requirePolicy } = require("@aport/middleware");

const app = express();
app.use(express.json());

// Apply refunds policy to all refund routes
app.post("/refunds", requirePolicy("refunds.v1"), async (req, res) => {
  try {
    const { amount, reason, order_id } = req.body;
    const passport = req.policyResult.passport;

    // Additional business logic validation
    if (amount <= 0) {
      return res.status(400).json({ error: "Invalid refund amount" });
    }

    // Process refund using your payment processor
    const refund_id = await processRefund({
      amount,
      reason,
      order_id,
      agent_id: passport.agent_id,
      agent_name: passport.name,
    });

    // Log the transaction
    console.log(
      `Refund processed: ${refund_id} for $${amount} by agent ${passport.agent_id}`
    );

    res.json({
      success: true,
      refund_id,
      amount,
      status: "processed",
    });
  } catch (error) {
    console.error("Refund processing error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Batch refunds endpoint
app.post("/refunds/batch", requirePolicy("refunds.v1"), async (req, res) => {
  try {
    const { refunds } = req.body;
    const passport = req.policyResult.passport;

    // Check total batch amount against daily cap
    const totalAmount = refunds.reduce((sum, refund) => sum + refund.amount, 0);
    if (totalAmount > passport.limits.refund_usd_daily_cap) {
      return res.status(403).json({
        error: "Batch total exceeds daily cap",
        total: totalAmount,
        limit: passport.limits.refund_usd_daily_cap,
      });
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
      total_amount: totalAmount,
    });
  } catch (error) {
    console.error("Batch refund error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Mock refund processing function
async function processRefund({ amount, reason, order_id, agent_id }) {
  // Simulate payment processor call
  await new Promise((resolve) => setTimeout(resolve, 100));
  return `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Refunds service running on port ${PORT}`);
  console.log("Protected by APort refunds.v1 policy pack");
});
