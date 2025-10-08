const express = require("express");
const { requirePolicy } = require("@aporthq/middleware-express");

const app = express();
app.use(express.json());

// Apply finance.crypto.trade policy to all crypto trading routes
app.post(
  "/finance/crypto/trade",
  requirePolicy("finance.crypto.trade.v1"),
  async (req, res) => {
    try {
      const {
        exchange_id,
        pair,
        side,
        amount_usd,
        source_wallet_type,
        idempotency_key,
        trade_reason,
        risk_score,
      } = req.body;

      const passport = req.policyResult.passport;

      // Additional business logic validation
      if (amount_usd <= 0) {
        return res.status(400).json({ error: "Invalid trade amount" });
      }

      // Check if required fields are provided
      if (!exchange_id || !pair || !side) {
        return res
          .status(400)
          .json({ error: "Exchange, pair, and side are required" });
      }

      // Process crypto trade using your trading system
      const trade_id = await processCryptoTrade({
        exchange_id,
        pair,
        side,
        amount_usd,
        source_wallet_type,
        idempotency_key,
        trade_reason,
        risk_score,
        agent_id: passport.passport_id,
        agent_name: passport.metadata?.template_name || "Unknown Agent",
      });

      // Log the trade
      console.log(
        `Crypto trade processed: ${trade_id} for ${amount_usd} USD by agent ${passport.passport_id}`
      );

      res.json({
        success: true,
        trade_id,
        exchange_id,
        pair,
        side,
        amount_usd,
        status: "processed",
        decision_id: req.policyResult.decision_id,
      });
    } catch (error) {
      console.error("Crypto trade processing error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Mock crypto trade processing function
async function processCryptoTrade({
  exchange_id,
  pair,
  side,
  amount_usd,
  source_wallet_type,
  idempotency_key,
  trade_reason,
  risk_score,
  agent_id,
}) {
  // Simulate trading system call
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Log trade details for audit
  console.log(`Processing crypto trade:`, {
    exchange_id,
    pair,
    side,
    amount_usd,
    source_wallet_type,
    idempotency_key,
    trade_reason,
    risk_score,
    agent_id,
  });

  return `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Crypto trading service running on port ${PORT}`);
  console.log("Protected by APort finance.crypto.trade.v1 policy pack");
});
