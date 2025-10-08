const express = require("express");
const { requirePolicy } = require("@aporthq/middleware-express");

const app = express();
app.use(express.json());

// Apply finance.transaction policy to all transaction routes
app.post(
  "/finance/transaction",
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
        source_account_type,
        destination_account_type,
        counterparty_id,
        idempotency_key,
      } = req.body;

      const passport = req.policyResult.passport;

      // Additional business logic validation
      if (amount <= 0) {
        return res.status(400).json({ error: "Invalid transaction amount" });
      }

      // Check if required fields are provided
      if (!source_account_id || !destination_account_id) {
        return res
          .status(400)
          .json({ error: "Source and destination accounts are required" });
      }

      // Process transaction using your financial system
      const transaction_id = await processTransaction({
        transaction_type,
        amount,
        currency,
        asset_class,
        source_account_id,
        destination_account_id,
        source_account_type,
        destination_account_type,
        counterparty_id,
        idempotency_key,
        agent_id: passport.passport_id,
        agent_name: passport.metadata?.template_name || "Unknown Agent",
      });

      // Log the transaction
      console.log(
        `Transaction processed: ${transaction_id} for ${amount} ${currency} by agent ${passport.passport_id}`
      );

      res.json({
        success: true,
        transaction_id,
        transaction_type,
        amount,
        currency,
        asset_class,
        status: "processed",
        decision_id: req.policyResult.decision_id,
      });
    } catch (error) {
      console.error("Transaction processing error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Batch transactions endpoint
app.post(
  "/finance/transaction/batch",
  requirePolicy("finance.transaction.execute.v1"),
  async (req, res) => {
    try {
      const { transactions } = req.body;
      const passport = req.policyResult.passport;

      // Group transactions by counterparty for exposure checking
      const counterpartyTotals = {};
      for (const transaction of transactions) {
        const counterparty = transaction.counterparty_id || "default";
        counterpartyTotals[counterparty] =
          (counterpartyTotals[counterparty] || 0) + (transaction.amount || 0);
      }

      // Check counterparty exposure limits
      for (const [counterparty, totalAmount] of Object.entries(
        counterpartyTotals
      )) {
        const maxExposure =
          passport.limits?.finance?.transaction
            ?.max_exposure_per_counterparty_usd;
        if (maxExposure && totalAmount > maxExposure) {
          return res.status(403).json({
            error: "Batch total exceeds counterparty exposure limit",
            counterparty,
            total: totalAmount,
            limit: maxExposure,
          });
        }
      }

      // Process batch transactions
      const results = await Promise.all(
        transactions.map((transaction) =>
          processTransaction({
            ...transaction,
            agent_id: passport.passport_id,
          })
        )
      );

      res.json({
        success: true,
        processed: results.length,
        counterparty_totals: counterpartyTotals,
        decision_id: req.policyResult.decision_id,
      });
    } catch (error) {
      console.error("Batch transaction error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Get transaction status
app.get(
  "/finance/transaction/:transaction_id",
  requirePolicy("finance.transaction.execute.v1"),
  async (req, res) => {
    try {
      const { transaction_id } = req.params;
      const passport = req.policyResult.passport;

      const transaction_info = await getTransactionStatus(
        transaction_id,
        passport.passport_id
      );

      if (!transaction_info) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      res.json(transaction_info);
    } catch (error) {
      console.error("Transaction status error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Cancel transaction endpoint
app.post(
  "/finance/transaction/:transaction_id/cancel",
  requirePolicy("finance.transaction.execute.v1"),
  async (req, res) => {
    try {
      const { transaction_id } = req.params;
      const { reason } = req.body;
      const passport = req.policyResult.passport;

      const cancel_id = await cancelTransaction({
        transaction_id,
        reason,
        agent_id: passport.passport_id,
      });

      res.json({
        success: true,
        cancel_id,
        transaction_id,
        status: "cancelled",
        decision_id: req.policyResult.decision_id,
      });
    } catch (error) {
      console.error("Transaction cancellation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Mock transaction processing function
async function processTransaction({
  transaction_type,
  amount,
  currency,
  asset_class,
  source_account_id,
  destination_account_id,
  source_account_type,
  destination_account_type,
  counterparty_id,
  idempotency_key,
  agent_id,
}) {
  // Simulate financial system call
  await new Promise((resolve) => setTimeout(resolve, 150));

  // Log transaction details for audit
  console.log(`Processing transaction:`, {
    transaction_type,
    amount,
    currency,
    asset_class,
    source_account_id,
    destination_account_id,
    source_account_type,
    destination_account_type,
    counterparty_id,
    idempotency_key,
    agent_id,
  });

  return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Mock transaction status lookup
async function getTransactionStatus(transaction_id, agent_id) {
  // Simulate transaction status lookup
  await new Promise((resolve) => setTimeout(resolve, 50));
  return {
    transaction_id,
    status: "completed",
    created_at: new Date().toISOString(),
    transaction_type: "buy",
    amount: 10000,
    currency: "USD",
    asset_class: "equity",
    source_account_id: "acc_client_123",
    destination_account_id: "acc_trading_456",
  };
}

// Mock transaction cancellation function
async function cancelTransaction({ transaction_id, reason, agent_id }) {
  // Simulate transaction cancellation
  await new Promise((resolve) => setTimeout(resolve, 100));

  console.log(`Cancelling transaction:`, {
    transaction_id,
    reason,
    agent_id,
  });

  return `cancel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Financial transaction service running on port ${PORT}`);
  console.log("Protected by APort finance.transaction.execute.v1 policy pack");
});
