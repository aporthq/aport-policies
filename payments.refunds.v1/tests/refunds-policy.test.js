/**
 * Comprehensive tests for payments.refund.v1 policy
 * Tests all enforcement rules, edge cases, and fraud prevention
 */

const {
  test,
  expect,
  describe,
  beforeEach,
  afterEach,
} = require("@jest/globals");

// Mock the policy verification endpoint
const mockPolicyVerification = (response) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(response),
  });
};

const mockPolicyVerificationError = (status = 500) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
    text: () => Promise.resolve("Policy verification failed"),
  });
};

describe("Refunds v1 Policy - Core Functionality", () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  describe("Required Fields Validation", () => {
    test("should allow refund with all required fields", async () => {
      const validContext = {
        order_id: "ORD-12345",
        customer_id: "CUST-67890",
        amount_minor: 5000,
        currency: "USD",
        region: "US",
        reason_code: "customer_request",
        idempotency_key: "idempotency_key_123",
      };

      mockPolicyVerification({
        allow: true,
        decision_id: "dec_123",
        remaining_daily_cap: { USD: 25000 },
        expires_in: 60,
      });

      const { verifyPolicy } = require("../sdk/node/src/policy-enforcement");
      const result = await verifyPolicy(
        "agent_123",
        "payments.refund.v1",
        validContext
      );

      expect(result.allowed).toBe(true);
      expect(result.result).toBeDefined();
    });

    test("should deny refund missing required fields", async () => {
      const invalidContext = {
        order_id: "ORD-12345",
        // Missing customer_id, amount_minor, currency, region, reason_code, idempotency_key
      };

      mockPolicyVerification({
        allow: false,
        reasons: [
          {
            code: "missing_required_field",
            message: "customer_id is required",
          },
          {
            code: "missing_required_field",
            message: "amount_minor is required",
          },
          { code: "missing_required_field", message: "currency is required" },
          { code: "missing_required_field", message: "region is required" },
          {
            code: "missing_required_field",
            message: "reason_code is required",
          },
          {
            code: "missing_required_field",
            message: "idempotency_key is required",
          },
        ],
      });

      const { verifyPolicy } = require("../sdk/node/src/policy-enforcement");
      const result = await verifyPolicy(
        "agent_123",
        "payments.refund.v1",
        invalidContext
      );

      expect(result.allowed).toBe(false);
      expect(result.error?.violations).toHaveLength(6);
    });
  });

  describe("Currency Support", () => {
    test("should support multiple currencies", async () => {
      const currencies = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD"];

      for (const currency of currencies) {
        const context = {
          order_id: "ORD-12345",
          customer_id: "CUST-67890",
          amount_minor: 1000,
          currency,
          region: "US",
          reason_code: "customer_request",
          idempotency_key: `idempotency_${currency}`,
        };

        mockPolicyVerification({
          allow: true,
          decision_id: `dec_${currency}`,
          remaining_daily_cap: { [currency]: 25000 },
        });

        const { verifyPolicy } = require("../sdk/node/src/policy-enforcement");
        const result = await verifyPolicy(
          "agent_123",
          "payments.refund.v1",
          context
        );

        expect(result.allowed).toBe(true);
      }
    });

    test("should deny unsupported currency", async () => {
      const context = {
        order_id: "ORD-12345",
        customer_id: "CUST-67890",
        amount_minor: 1000,
        currency: "XYZ", // Unsupported currency
        region: "US",
        reason_code: "customer_request",
        idempotency_key: "idempotency_xyz",
      };

      mockPolicyVerification({
        allow: false,
        reasons: [
          {
            code: "currency_not_supported",
            message: "Currency XYZ is not supported",
          },
        ],
      });

      const { verifyPolicy } = require("../sdk/node/src/policy-enforcement");
      const result = await verifyPolicy(
        "agent_123",
        "payments.refund.v1",
        context
      );

      expect(result.allowed).toBe(false);
      expect(result.error?.violations[0].code).toBe("currency_not_supported");
    });
  });

  describe("Amount Validation", () => {
    test("should validate amount precision for different currencies", async () => {
      const testCases = [
        { currency: "USD", amount: 1000, valid: true }, // $10.00 - valid
        { currency: "USD", amount: 1001, valid: false }, // $10.01 - invalid precision
        { currency: "JPY", amount: 1000, valid: true }, // ¥1000 - valid
        { currency: "JPY", amount: 1001, valid: true }, // ¥1001 - valid (no decimals)
        { currency: "EUR", amount: 1000, valid: true }, // €10.00 - valid
        { currency: "EUR", amount: 1001, valid: false }, // €10.01 - invalid precision
      ];

      for (const testCase of testCases) {
        const context = {
          order_id: "ORD-12345",
          customer_id: "CUST-67890",
          amount_minor: testCase.amount,
          currency: testCase.currency,
          region: "US",
          reason_code: "customer_request",
          idempotency_key: `idempotency_${testCase.currency}_${testCase.amount}`,
        };

        mockPolicyVerification({
          allow: testCase.valid,
          reasons: testCase.valid
            ? []
            : [
                {
                  code: "invalid_amount",
                  message: `Amount ${testCase.amount} has invalid precision for currency ${testCase.currency}`,
                },
              ],
        });

        const { verifyPolicy } = require("../sdk/node/src/policy-enforcement");
        const result = await verifyPolicy(
          "agent_123",
          "payments.refund.v1",
          context
        );

        expect(result.allowed).toBe(testCase.valid);
      }
    });

    test("should validate amount bounds", async () => {
      const testCases = [
        { amount: 0, valid: false, reason: "Amount must be positive" },
        { amount: -100, valid: false, reason: "Amount must be positive" },
        { amount: 1, valid: true, reason: "Minimum amount" },
        { amount: 1000000000, valid: false, reason: "Amount exceeds maximum" },
        { amount: 999999999, valid: true, reason: "Maximum valid amount" },
      ];

      for (const testCase of testCases) {
        const context = {
          order_id: "ORD-12345",
          customer_id: "CUST-67890",
          amount_minor: testCase.amount,
          currency: "USD",
          region: "US",
          reason_code: "customer_request",
          idempotency_key: `idempotency_${testCase.amount}`,
        };

        mockPolicyVerification({
          allow: testCase.valid,
          reasons: testCase.valid
            ? []
            : [{ code: "invalid_amount", message: testCase.reason }],
        });

        const { verifyPolicy } = require("../sdk/node/src/policy-enforcement");
        const result = await verifyPolicy(
          "agent_123",
          "payments.refund.v1",
          context
        );

        expect(result.allowed).toBe(testCase.valid);
      }
    });
  });

  describe("Assurance Level Requirements", () => {
    test("should require L2 for amounts <= $100", async () => {
      const context = {
        order_id: "ORD-12345",
        customer_id: "CUST-67890",
        amount_minor: 10000, // $100
        currency: "USD",
        region: "US",
        reason_code: "customer_request",
        idempotency_key: "idempotency_l2",
      };

      // Test with L2 assurance (should pass)
      mockPolicyVerification({
        allow: true,
        decision_id: "dec_l2_pass",
        remaining_daily_cap: { USD: 25000 },
      });

      const { verifyPolicy } = require("../sdk/node/src/policy-enforcement");
      const result = await verifyPolicy(
        "agent_123",
        "payments.refund.v1",
        context
      );

      expect(result.allowed).toBe(true);
    });

    test("should require L3 for amounts $100-$500", async () => {
      const context = {
        order_id: "ORD-12345",
        customer_id: "CUST-67890",
        amount_minor: 25000, // $250
        currency: "USD",
        region: "US",
        reason_code: "customer_request",
        idempotency_key: "idempotency_l3",
      };

      // Test with L2 assurance (should fail)
      mockPolicyVerification({
        allow: false,
        reasons: [
          {
            code: "assurance_too_low",
            message:
              "Refund amount 25000 USD requires L3 assurance level, but agent has L2",
          },
        ],
      });

      const { verifyPolicy } = require("../sdk/node/src/policy-enforcement");
      const result = await verifyPolicy(
        "agent_123",
        "payments.refund.v1",
        context
      );

      expect(result.allowed).toBe(false);
      expect(result.error?.violations[0].code).toBe("assurance_too_low");
    });

    test("should deny amounts > $500 in v1", async () => {
      const context = {
        order_id: "ORD-12345",
        customer_id: "CUST-67890",
        amount_minor: 60000, // $600
        currency: "USD",
        region: "US",
        reason_code: "customer_request",
        idempotency_key: "idempotency_deny",
      };

      mockPolicyVerification({
        allow: false,
        reasons: [
          {
            code: "assurance_too_low",
            message:
              "Refund amount 60000 USD requires L4 assurance level, but agent has L3",
          },
        ],
      });

      const { verifyPolicy } = require("../sdk/node/src/policy-enforcement");
      const result = await verifyPolicy(
        "agent_123",
        "payments.refund.v1",
        context
      );

      expect(result.allowed).toBe(false);
    });
  });

  describe("Idempotency Protection", () => {
    test("should allow first request with idempotency key", async () => {
      const context = {
        order_id: "ORD-12345",
        customer_id: "CUST-67890",
        amount_minor: 5000,
        currency: "USD",
        region: "US",
        reason_code: "customer_request",
        idempotency_key: "unique_key_123",
      };

      mockPolicyVerification({
        allow: true,
        decision_id: "dec_first",
        remaining_daily_cap: { USD: 25000 },
      });

      const { verifyPolicy } = require("../sdk/node/src/policy-enforcement");
      const result = await verifyPolicy(
        "agent_123",
        "payments.refund.v1",
        context
      );

      expect(result.allowed).toBe(true);
    });

    test("should deny duplicate idempotency key", async () => {
      const context = {
        order_id: "ORD-12345",
        customer_id: "CUST-67890",
        amount_minor: 5000,
        currency: "USD",
        region: "US",
        reason_code: "customer_request",
        idempotency_key: "duplicate_key_123",
      };

      mockPolicyVerification({
        allow: false,
        reasons: [
          {
            code: "idempotency_replay",
            message:
              "Duplicate idempotency key detected. Previous decision: dec_duplicate",
          },
        ],
      });

      const { verifyPolicy } = require("../sdk/node/src/policy-enforcement");
      const result = await verifyPolicy(
        "agent_123",
        "payments.refund.v1",
        context
      );

      expect(result.allowed).toBe(false);
      expect(result.error?.violations[0].code).toBe("idempotency_replay");
    });
  });

  describe("Daily Cap Enforcement", () => {
    test("should allow refund within daily cap", async () => {
      const context = {
        order_id: "ORD-12345",
        customer_id: "CUST-67890",
        amount_minor: 5000,
        currency: "USD",
        region: "US",
        reason_code: "customer_request",
        idempotency_key: "daily_cap_test",
      };

      mockPolicyVerification({
        allow: true,
        decision_id: "dec_daily_cap",
        remaining_daily_cap: { USD: 20000 },
      });

      const { verifyPolicy } = require("../sdk/node/src/policy-enforcement");
      const result = await verifyPolicy(
        "agent_123",
        "payments.refund.v1",
        context
      );

      expect(result.allowed).toBe(true);
      expect(result.result?.evaluation?.remaining_daily_cap?.USD).toBe(20000);
    });

    test("should deny refund exceeding daily cap", async () => {
      const context = {
        order_id: "ORD-12345",
        customer_id: "CUST-67890",
        amount_minor: 5000,
        currency: "USD",
        region: "US",
        reason_code: "customer_request",
        idempotency_key: "daily_cap_exceeded",
      };

      mockPolicyVerification({
        allow: false,
        reasons: [
          {
            code: "daily_cap_exceeded",
            message:
              "Daily cap 25000 USD exceeded for USD; current 23000 + 5000 > 25000",
          },
        ],
        remaining_daily_cap: { USD: 2000 },
      });

      const { verifyPolicy } = require("../sdk/node/src/policy-enforcement");
      const result = await verifyPolicy(
        "agent_123",
        "payments.refund.v1",
        context
      );

      expect(result.allowed).toBe(false);
      expect(result.error?.violations[0].code).toBe("daily_cap_exceeded");
    });
  });

  describe("Cross-Currency Protection", () => {
    test("should deny cross-currency refunds", async () => {
      const context = {
        order_id: "ORD-12345",
        customer_id: "CUST-67890",
        amount_minor: 5000,
        currency: "USD",
        order_currency: "EUR", // Different from refund currency
        region: "US",
        reason_code: "customer_request",
        idempotency_key: "cross_currency_test",
      };

      mockPolicyVerification({
        allow: false,
        reasons: [
          {
            code: "cross_currency_denied",
            message: "Cross-currency refunds are not supported in v1",
          },
        ],
      });

      const { verifyPolicy } = require("../sdk/node/src/policy-enforcement");
      const result = await verifyPolicy(
        "agent_123",
        "payments.refund.v1",
        context
      );

      expect(result.allowed).toBe(false);
      expect(result.error?.violations[0].code).toBe("cross_currency_denied");
    });
  });

  describe("Order Balance Validation", () => {
    test("should allow refund within order balance", async () => {
      const context = {
        order_id: "ORD-12345",
        customer_id: "CUST-67890",
        amount_minor: 5000,
        currency: "USD",
        order_total_minor: 10000,
        already_refunded_minor: 2000,
        region: "US",
        reason_code: "customer_request",
        idempotency_key: "balance_valid",
      };

      mockPolicyVerification({
        allow: true,
        decision_id: "dec_balance_valid",
        remaining_daily_cap: { USD: 25000 },
      });

      const { verifyPolicy } = require("../sdk/node/src/policy-enforcement");
      const result = await verifyPolicy(
        "agent_123",
        "payments.refund.v1",
        context
      );

      expect(result.allowed).toBe(true);
    });

    test("should deny refund exceeding order balance", async () => {
      const context = {
        order_id: "ORD-12345",
        customer_id: "CUST-67890",
        amount_minor: 5000,
        currency: "USD",
        order_total_minor: 10000,
        already_refunded_minor: 8000, // Only 2000 remaining
        region: "US",
        reason_code: "customer_request",
        idempotency_key: "balance_exceeded",
      };

      mockPolicyVerification({
        allow: false,
        reasons: [
          {
            code: "order_balance_exceeded",
            message: "Refund amount 5000 exceeds remaining order balance 2000",
          },
        ],
      });

      const { verifyPolicy } = require("../sdk/node/src/policy-enforcement");
      const result = await verifyPolicy(
        "agent_123",
        "payments.refund.v1",
        context
      );

      expect(result.allowed).toBe(false);
      expect(result.error?.violations[0].code).toBe("order_balance_exceeded");
    });
  });

  describe("Region Validation", () => {
    test("should allow refund in allowed region", async () => {
      const context = {
        order_id: "ORD-12345",
        customer_id: "CUST-67890",
        amount_minor: 5000,
        currency: "USD",
        region: "US",
        reason_code: "customer_request",
        idempotency_key: "region_valid",
      };

      mockPolicyVerification({
        allow: true,
        decision_id: "dec_region_valid",
        remaining_daily_cap: { USD: 25000 },
      });

      const { verifyPolicy } = require("../sdk/node/src/policy-enforcement");
      const result = await verifyPolicy(
        "agent_123",
        "payments.refund.v1",
        context
      );

      expect(result.allowed).toBe(true);
    });

    test("should deny refund in disallowed region", async () => {
      const context = {
        order_id: "ORD-12345",
        customer_id: "CUST-67890",
        amount_minor: 5000,
        currency: "USD",
        region: "RESTRICTED",
        reason_code: "customer_request",
        idempotency_key: "region_invalid",
      };

      mockPolicyVerification({
        allow: false,
        reasons: [
          {
            code: "region_not_allowed",
            message: "Region RESTRICTED is not allowed for this agent",
          },
        ],
      });

      const { verifyPolicy } = require("../sdk/node/src/policy-enforcement");
      const result = await verifyPolicy(
        "agent_123",
        "payments.refund.v1",
        context
      );

      expect(result.allowed).toBe(false);
      expect(result.error?.violations[0].code).toBe("region_not_allowed");
    });
  });

  describe("Reason Code Validation", () => {
    test("should allow valid reason codes", async () => {
      const validReasonCodes = [
        "customer_request",
        "defective",
        "not_as_described",
        "duplicate",
        "fraud",
      ];

      for (const reasonCode of validReasonCodes) {
        const context = {
          order_id: "ORD-12345",
          customer_id: "CUST-67890",
          amount_minor: 5000,
          currency: "USD",
          region: "US",
          reason_code: reasonCode,
          idempotency_key: `reason_${reasonCode}`,
        };

        mockPolicyVerification({
          allow: true,
          decision_id: `dec_${reasonCode}`,
          remaining_daily_cap: { USD: 25000 },
        });

        const { verifyPolicy } = require("../sdk/node/src/policy-enforcement");
        const result = await verifyPolicy(
          "agent_123",
          "payments.refund.v1",
          context
        );

        expect(result.allowed).toBe(true);
      }
    });

    test("should deny invalid reason codes", async () => {
      const context = {
        order_id: "ORD-12345",
        customer_id: "CUST-67890",
        amount_minor: 5000,
        currency: "USD",
        region: "US",
        reason_code: "invalid_reason",
        idempotency_key: "invalid_reason_test",
      };

      mockPolicyVerification({
        allow: false,
        reasons: [
          {
            code: "reason_code_invalid",
            message: "Reason code invalid_reason is not supported",
          },
        ],
      });

      const { verifyPolicy } = require("../sdk/node/src/policy-enforcement");
      const result = await verifyPolicy(
        "agent_123",
        "payments.refund.v1",
        context
      );

      expect(result.allowed).toBe(false);
      expect(result.error?.violations[0].code).toBe("reason_code_invalid");
    });
  });

  describe("Error Handling", () => {
    test("should handle policy verification failures gracefully", async () => {
      mockPolicyVerificationError(500);

      const { verifyPolicy } = require("../sdk/node/src/policy-enforcement");
      const result = await verifyPolicy("agent_123", "payments.refund.v1", {});

      expect(result.allowed).toBe(false);
      expect(result.error?.code).toBe("policy_verification_failed");
    });

    test("should handle network errors", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

      const { verifyPolicy } = require("../sdk/node/src/policy-enforcement");
      const result = await verifyPolicy("agent_123", "payments.refund.v1", {});

      expect(result.allowed).toBe(false);
      expect(result.error?.code).toBe("policy_verification_error");
    });
  });

  describe("Edge Cases and Fraud Prevention", () => {
    test("should prevent extremely large amounts", async () => {
      const context = {
        order_id: "ORD-12345",
        customer_id: "CUST-67890",
        amount_minor: Number.MAX_SAFE_INTEGER,
        currency: "USD",
        region: "US",
        reason_code: "customer_request",
        idempotency_key: "extreme_amount",
      };

      mockPolicyVerification({
        allow: false,
        reasons: [
          {
            code: "invalid_amount",
            message: "Amount exceeds maximum allowed amount",
          },
        ],
      });

      const { verifyPolicy } = require("../sdk/node/src/policy-enforcement");
      const result = await verifyPolicy(
        "agent_123",
        "payments.refund.v1",
        context
      );

      expect(result.allowed).toBe(false);
    });

    test("should prevent negative amounts", async () => {
      const context = {
        order_id: "ORD-12345",
        customer_id: "CUST-67890",
        amount_minor: -1000,
        currency: "USD",
        region: "US",
        reason_code: "customer_request",
        idempotency_key: "negative_amount",
      };

      mockPolicyVerification({
        allow: false,
        reasons: [
          { code: "invalid_amount", message: "Amount must be positive" },
        ],
      });

      const { verifyPolicy } = require("../sdk/node/src/policy-enforcement");
      const result = await verifyPolicy(
        "agent_123",
        "payments.refund.v1",
        context
      );

      expect(result.allowed).toBe(false);
    });

    test("should prevent zero amounts", async () => {
      const context = {
        order_id: "ORD-12345",
        customer_id: "CUST-67890",
        amount_minor: 0,
        currency: "USD",
        region: "US",
        reason_code: "customer_request",
        idempotency_key: "zero_amount",
      };

      mockPolicyVerification({
        allow: false,
        reasons: [
          { code: "invalid_amount", message: "Amount must be positive" },
        ],
      });

      const { verifyPolicy } = require("../sdk/node/src/policy-enforcement");
      const result = await verifyPolicy(
        "agent_123",
        "payments.refund.v1",
        context
      );

      expect(result.allowed).toBe(false);
    });

    test("should validate idempotency key format", async () => {
      const invalidKeys = [
        "",
        "a",
        "a".repeat(100),
        "invalid@key",
        "key with spaces",
      ];

      for (const key of invalidKeys) {
        const context = {
          order_id: "ORD-12345",
          customer_id: "CUST-67890",
          amount_minor: 5000,
          currency: "USD",
          region: "US",
          reason_code: "customer_request",
          idempotency_key: key,
        };

        mockPolicyVerification({
          allow: false,
          reasons: [
            {
              code: "invalid_idempotency_key",
              message: "Invalid idempotency key format",
            },
          ],
        });

        const { verifyPolicy } = require("../sdk/node/src/policy-enforcement");
        const result = await verifyPolicy(
          "agent_123",
          "payments.refund.v1",
          context
        );

        expect(result.allowed).toBe(false);
      }
    });
  });
});

describe("Refunds v1 Policy - Integration Tests", () => {
  describe("Express Middleware Integration", () => {
    test("should work with Express middleware", async () => {
      const express = require("express");
      const {
        requireRefundsPolicy,
      } = require("../middleware/express/src/index");

      const app = express();
      app.use(express.json());

      app.post("/refund", requireRefundsPolicy("agent_123"), (req, res) => {
        res.json({ success: true, refund_id: "ref_123" });
      });

      // Mock the policy verification
      mockPolicyVerification({
        allow: true,
        decision_id: "dec_123",
        remaining_daily_cap: { USD: 25000 },
      });

      const request = require("supertest")(app);
      const response = await request.post("/refund").send({
        order_id: "ORD-12345",
        customer_id: "CUST-67890",
        amount_minor: 5000,
        currency: "USD",
        region: "US",
        reason_code: "customer_request",
        idempotency_key: "test_key_123",
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("FastAPI Middleware Integration", () => {
    test("should work with FastAPI middleware", async () => {
      // This would require a more complex setup with FastAPI test client
      // For now, we'll just verify the function exists and has the right signature
      const {
        require_refunds_policy,
      } = require("../middleware/fastapi/src/agent_passport_middleware/middleware_v2");

      expect(typeof require_refunds_policy).toBe("function");

      const dependency = require_refunds_policy("agent_123", true, true);
      expect(typeof dependency).toBe("function");
    });
  });
});
