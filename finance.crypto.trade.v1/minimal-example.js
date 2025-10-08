/**
 * Minimal Example: finance.crypto.trade.v1 Policy
 *
 * This is a quick-start example showing the basic usage of the finance.crypto.trade.v1 policy.
 * For production use, see the full express.example.js file.
 */

const express = require("express");
const { requirePolicy } = require("@aporthq/middleware-express");

const app = express();
app.use(express.json());

// Minimal crypto trade endpoint with policy protection
app.post(
  "/crypto/trade",
  requirePolicy("finance.crypto.trade.v1"),
  async (req, res) => {
    try {
      const { exchange_id, pair, side, amount_usd } = req.body;
      const passport = req.policyResult.passport;

      // Process the crypto trade (your business logic here)
      const trade_id = `trade_${Date.now()}`;

      console.log(`Crypto trade processed: ${trade_id} for ${amount_usd} USD`);

      res.json({
        success: true,
        trade_id,
        exchange_id,
        pair,
        side,
        amount_usd,
        decision_id: req.policyResult.decision_id,
      });
    } catch (error) {
      console.error("Crypto trade error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Example client request
const exampleRequest = {
  exchange_id: "coinbase",
  pair: "BTC-USD",
  side: "buy",
  amount_usd: 1000,
  source_wallet_type: "hot",
  idempotency_key: "crypto-trade-123",
};

console.log("Example request:", JSON.stringify(exampleRequest, null, 2));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Minimal crypto trading service running on port ${PORT}`);
  console.log("Protected by APort finance.crypto.trade.v1 policy");
  console.log(
    `Try: curl -X POST http://localhost:${PORT}/crypto/trade -H "Content-Type: application/json" -d '${JSON.stringify(
      exampleRequest
    )}'`
  );
});
