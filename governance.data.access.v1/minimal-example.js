/**
 * Minimal Example: governance.data.access.v1 Policy
 *
 * This is a quick-start example showing the basic usage of the governance.data.access.v1 policy.
 * For production use, see the full express.example.js file.
 */

const express = require("express");
const { requirePolicy } = require("@aporthq/middleware-express");

const app = express();
app.use(express.json());

// Minimal data access endpoint with policy protection
app.get(
  "/data/access",
  requirePolicy("governance.data.access.v1"),
  async (req, res) => {
    try {
      const { data_classification, accessing_entity_id, resource_id } =
        req.query;
      const passport = req.policyResult.passport;

      // Process the data access (your business logic here)
      const access_id = `access_${Date.now()}`;

      console.log(
        `Data access processed: ${access_id} for ${data_classification} data`
      );

      res.json({
        success: true,
        access_id,
        data_classification,
        resource_id,
        decision_id: req.policyResult.decision_id,
      });
    } catch (error) {
      console.error("Data access error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Example client request
const exampleRequest = {
  data_classification: "PII",
  accessing_entity_id: "emp_123",
  accessing_entity_type: "employee",
  resource_id: "user_456",
  action_type: "read",
  jurisdiction: "US",
  row_count: 100,
};

console.log("Example request:", JSON.stringify(exampleRequest, null, 2));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Minimal data access service running on port ${PORT}`);
  console.log("Protected by APort governance.data.access.v1 policy");
  console.log(
    `Try: curl -X GET "http://localhost:${PORT}/data/access?data_classification=PII&accessing_entity_id=emp_123&resource_id=user_456"`
  );
});
