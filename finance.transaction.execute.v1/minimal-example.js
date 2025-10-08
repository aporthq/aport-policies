/**
 * Minimal Example: finance.transaction.execute.v1 Policy
 *
 * This is a quick-start example showing the basic usage of the finance.transaction.execute.v1 policy.
 * For production use, see the full express.example.js file.
 */

const express = require("express");
const { requirePolicy } = require("@aporthq/middleware-express");

const app = express();
app.use(express.json());

// Minimal transaction endpoint with policy protection
app.post(
  "/transaction",
  requirePolicy("finance.transaction.execute.v1"),
  async (req, res) => {
    try {
      const {
        transaction_type,
        amount,
        currency,
        asset_class,
        source_account_id,
        destination_account_id,
      } = req.body;
      const passport = req.policyResult.passport;

      // Process the transaction (your business logic here)
      const transaction_id = `txn_${Date.now()}`;

      console.log(
        `Transaction processed: ${transaction_id} for ${amount} ${currency}`
      );

      res.json({
        success: true,
        transaction_id,
        transaction_type,
        amount,
        currency,
        asset_class,
        decision_id: req.policyResult.decision_id,
      });
    } catch (error) {
      console.error("Transaction error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Example client request
const exampleRequest = {
  transaction_type: "buy",
  amount: 10000, // $100.00 in cents
  currency: "USD",
  asset_class: "equity",
  source_account_id: "acc_client_123",
  destination_account_id: "acc_trading_456",
  source_account_type: "client_funds",
  destination_account_type: "trading",
  counterparty_id: "cpty_broker_789",
  idempotency_key: "txn-buy-123",
};

console.log("Example request:", JSON.stringify(exampleRequest, null, 2));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Minimal transaction service running on port ${PORT}`);
  console.log("Protected by APort finance.transaction.execute.v1 policy");
  console.log(
    `Try: curl -X POST http://localhost:${PORT}/transaction -H "Content-Type: application/json" -d '${JSON.stringify(
      exampleRequest
    )}'`
  );
});
