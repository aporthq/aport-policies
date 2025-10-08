/**
 * Minimal Example: finance.payment.charge.v1 Policy
 *
 * This is a quick-start example showing the basic usage of the finance.payment.charge.v1 policy.
 * For production use, see the full express.example.js file.
 */

const express = require("express");
const { requirePolicy } = require("@aporthq/middleware-express");

const app = express();
app.use(express.json());

// Minimal charge endpoint with policy protection
app.post(
  "/charge",
  requirePolicy("finance.payment.charge.v1"),
  async (req, res) => {
    try {
      const { amount, currency, merchant_id, items } = req.body;
      const passport = req.policyResult.passport;

      // Process the charge (your business logic here)
      const charge_id = `chg_${Date.now()}`;

      console.log(`Charge processed: ${charge_id} for ${amount} ${currency}`);

      res.json({
        success: true,
        charge_id,
        amount,
        currency,
        decision_id: req.policyResult.decision_id,
      });
    } catch (error) {
      console.error("Charge error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Example client request
const exampleRequest = {
  amount: 1299, // $12.99 in cents
  currency: "USD",
  merchant_id: "merch_abc",
  region: "US",
  shipping_country: "US",
  items: [{ sku: "SKU-1", qty: 1, category: "electronics" }],
  idempotency_key: "charge-ord-123",
};

console.log("Example request:", JSON.stringify(exampleRequest, null, 2));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Minimal charge service running on port ${PORT}`);
  console.log("Protected by APort finance.payment.charge.v1 policy");
  console.log(
    `Try: curl -X POST http://localhost:${PORT}/charge -H "Content-Type: application/json" -d '${JSON.stringify(
      exampleRequest
    )}'`
  );
});
