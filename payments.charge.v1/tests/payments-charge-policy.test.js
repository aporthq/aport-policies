/**
 * Comprehensive tests for payments.charge.v1 policy
 * Tests all enforcement rules, edge cases, and OAP compliance
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

describe("Payments Charge v1 Policy - OAP Compliance", () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  describe("OAP Decision Structure", () => {
    test("should return OAP-compliant decision structure", async () => {
      const validContext = {
        amount: 1299,
        currency: "USD",
        merchant_id: "merch_abc",
        region: "US",
        shipping_country: "US",
        items: [{ sku: "SKU-1", qty: 1, category: "electronics" }],
        idempotency_key: "charge-ord-1001",
      };

      const expectedDecision = {
        decision_id: "550e8400-e29b-41d4-a716-446655440002",
        policy_id: "payments.charge.v1",
        agent_id: "550e8400-e29b-41d4-a716-446655440001",
        owner_id: "org_demo_co",
        assurance_level: "L2",
        allow: true,
        reasons: [
          {
            code: "oap.allowed",
            message: "Transaction within limits and policy requirements",
          },
        ],
        created_at: "2025-01-30T10:30:00Z",
        expires_in: 3600,
        passport_digest:
          "sha256:abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234yzab5678cdef",
        signature:
          "ed25519:abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234yzab5678cdef==",
        kid: "oap:registry:key-2025-01",
      };

      mockPolicyVerification(expectedDecision);

      const response = await fetch("/api/verify/policy/payments.charge.v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: "550e8400-e29b-41d4-a716-446655440001",
          context: validContext,
        }),
      });

      const decision = await response.json();

      expect(decision).toMatchObject({
        decision_id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        ),
        policy_id: "payments.charge.v1",
        agent_id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        ),
        owner_id: expect.any(String),
        assurance_level: expect.stringMatching(/^L[0-4](KYC|FIN)?$/),
        allow: expect.any(Boolean),
        reasons: expect.arrayContaining([
          expect.objectContaining({
            code: expect.any(String),
            message: expect.any(String),
          }),
        ]),
        created_at: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
        ),
        expires_in: expect.any(Number),
        passport_digest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        signature: expect.stringMatching(/^ed25519:[A-Za-z0-9+/=]+$/),
        kid: expect.stringMatching(/^oap:(registry|owner):[a-zA-Z0-9._-]+$/),
      });
    });
  });

  describe("Required Context Validation", () => {
    test("should allow charge with all required fields", async () => {
      const validContext = {
        amount: 1299,
        currency: "USD",
        merchant_id: "merch_abc",
        region: "US",
        items: [{ sku: "SKU-1", qty: 1, category: "electronics" }],
        idempotency_key: "charge-ord-1001",
      };

      mockPolicyVerification({
        allow: true,
        decision_id: "dec_123",
        reasons: [
          { code: "oap.allowed", message: "Transaction within limits" },
        ],
      });

      const response = await fetch("/api/verify/policy/payments.charge.v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: "550e8400-e29b-41d4-a716-446655440001",
          context: validContext,
        }),
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.allow).toBe(true);
    });

    test("should deny charge with missing required fields", async () => {
      const invalidContext = {
        amount: 1299,
        currency: "USD",
        // Missing merchant_id, region, items, idempotency_key
      };

      mockPolicyVerificationError(400);

      const response = await fetch("/api/verify/policy/payments.charge.v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: "550e8400-e29b-41d4-a716-446655440001",
          context: invalidContext,
        }),
      });

      expect(response.ok).toBe(false);
    });
  });

  describe("Currency Validation", () => {
    test("should allow supported currencies", async () => {
      const validContext = {
        amount: 1000,
        currency: "EUR",
        merchant_id: "merch_abc",
        region: "EU",
        items: [{ sku: "SKU-1", qty: 1 }],
        idempotency_key: "charge-ord-1002",
      };

      mockPolicyVerification({
        allow: true,
        decision_id: "dec_124",
        reasons: [
          { code: "oap.allowed", message: "Transaction within limits" },
        ],
      });

      const response = await fetch("/api/verify/policy/payments.charge.v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: "550e8400-e29b-41d4-a716-446655440001",
          context: validContext,
        }),
      });

      expect(response.ok).toBe(true);
    });

    test("should deny unsupported currencies", async () => {
      const invalidContext = {
        amount: 1000,
        currency: "GBP", // Not supported
        merchant_id: "merch_abc",
        region: "US",
        items: [{ sku: "SKU-1", qty: 1 }],
        idempotency_key: "charge-ord-1003",
      };

      mockPolicyVerification({
        allow: false,
        decision_id: "dec_125",
        reasons: [
          {
            code: "oap.currency_unsupported",
            message: "Currency GBP is not supported",
          },
        ],
      });

      const response = await fetch("/api/verify/policy/payments.charge.v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: "550e8400-e29b-41d4-a716-446655440001",
          context: invalidContext,
        }),
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.allow).toBe(false);
      expect(result.reasons[0].code).toBe("oap.currency_unsupported");
    });
  });

  describe("Amount Limits", () => {
    test("should allow amounts within per-transaction limit", async () => {
      const validContext = {
        amount: 15000, // Within 20000 limit
        currency: "USD",
        merchant_id: "merch_abc",
        region: "US",
        items: [{ sku: "SKU-1", qty: 1 }],
        idempotency_key: "charge-ord-1004",
      };

      mockPolicyVerification({
        allow: true,
        decision_id: "dec_126",
        reasons: [
          { code: "oap.allowed", message: "Transaction within limits" },
        ],
      });

      const response = await fetch("/api/verify/policy/payments.charge.v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: "550e8400-e29b-41d4-a716-446655440001",
          context: validContext,
        }),
      });

      expect(response.ok).toBe(true);
    });

    test("should deny amounts exceeding per-transaction limit", async () => {
      const invalidContext = {
        amount: 25000, // Exceeds 20000 limit
        currency: "USD",
        merchant_id: "merch_abc",
        region: "US",
        items: [{ sku: "SKU-1", qty: 1 }],
        idempotency_key: "charge-ord-1005",
      };

      mockPolicyVerification({
        allow: false,
        decision_id: "dec_127",
        reasons: [
          {
            code: "oap.limit_exceeded",
            message: "Amount exceeds per-transaction limit",
          },
        ],
      });

      const response = await fetch("/api/verify/policy/payments.charge.v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: "550e8400-e29b-41d4-a716-446655440001",
          context: invalidContext,
        }),
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.allow).toBe(false);
      expect(result.reasons[0].code).toBe("oap.limit_exceeded");
    });
  });

  describe("Item Count Limits", () => {
    test("should allow items within count limit", async () => {
      const validContext = {
        amount: 5000,
        currency: "USD",
        merchant_id: "merch_abc",
        region: "US",
        items: [
          { sku: "SKU-1", qty: 1 },
          { sku: "SKU-2", qty: 1 },
          { sku: "SKU-3", qty: 1 },
        ], // 3 items, within 5 limit
        idempotency_key: "charge-ord-1006",
      };

      mockPolicyVerification({
        allow: true,
        decision_id: "dec_128",
        reasons: [
          { code: "oap.allowed", message: "Transaction within limits" },
        ],
      });

      const response = await fetch("/api/verify/policy/payments.charge.v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: "550e8400-e29b-41d4-a716-446655440001",
          context: validContext,
        }),
      });

      expect(response.ok).toBe(true);
    });

    test("should deny items exceeding count limit", async () => {
      const invalidContext = {
        amount: 5000,
        currency: "USD",
        merchant_id: "merch_abc",
        region: "US",
        items: [
          { sku: "A", qty: 1 },
          { sku: "B", qty: 1 },
          { sku: "C", qty: 1 },
          { sku: "D", qty: 1 },
          { sku: "E", qty: 1 },
          { sku: "F", qty: 1 },
        ], // 6 items, exceeds 5 limit
        idempotency_key: "charge-ord-1007",
      };

      mockPolicyVerification({
        allow: false,
        decision_id: "dec_129",
        reasons: [
          {
            code: "oap.limit_exceeded",
            message: "Item count exceeds maximum allowed",
          },
        ],
      });

      const response = await fetch("/api/verify/policy/payments.charge.v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: "550e8400-e29b-41d4-a716-446655440001",
          context: invalidContext,
        }),
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.allow).toBe(false);
      expect(result.reasons[0].code).toBe("oap.limit_exceeded");
    });
  });

  describe("Merchant Validation", () => {
    test("should allow charges from allowed merchants", async () => {
      const validContext = {
        amount: 5000,
        currency: "USD",
        merchant_id: "merch_abc", // In allowlist
        region: "US",
        items: [{ sku: "SKU-1", qty: 1 }],
        idempotency_key: "charge-ord-1008",
      };

      mockPolicyVerification({
        allow: true,
        decision_id: "dec_130",
        reasons: [
          { code: "oap.allowed", message: "Transaction within limits" },
        ],
      });

      const response = await fetch("/api/verify/policy/payments.charge.v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: "550e8400-e29b-41d4-a716-446655440001",
          context: validContext,
        }),
      });

      expect(response.ok).toBe(true);
    });

    test("should deny charges from forbidden merchants", async () => {
      const invalidContext = {
        amount: 5000,
        currency: "USD",
        merchant_id: "merch_bad", // Not in allowlist
        region: "US",
        items: [{ sku: "SKU-1", qty: 1 }],
        idempotency_key: "charge-ord-1009",
      };

      mockPolicyVerification({
        allow: false,
        decision_id: "dec_131",
        reasons: [
          {
            code: "oap.merchant_forbidden",
            message: "Merchant not in allowlist",
          },
        ],
      });

      const response = await fetch("/api/verify/policy/payments.charge.v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: "550e8400-e29b-41d4-a716-446655440001",
          context: invalidContext,
        }),
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.allow).toBe(false);
      expect(result.reasons[0].code).toBe("oap.merchant_forbidden");
    });
  });

  describe("Country Validation", () => {
    test("should allow charges to allowed countries", async () => {
      const validContext = {
        amount: 5000,
        currency: "USD",
        merchant_id: "merch_abc",
        region: "US",
        shipping_country: "US", // In allowlist
        items: [{ sku: "SKU-1", qty: 1 }],
        idempotency_key: "charge-ord-1010",
      };

      mockPolicyVerification({
        allow: true,
        decision_id: "dec_132",
        reasons: [
          { code: "oap.allowed", message: "Transaction within limits" },
        ],
      });

      const response = await fetch("/api/verify/policy/payments.charge.v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: "550e8400-e29b-41d4-a716-446655440001",
          context: validContext,
        }),
      });

      expect(response.ok).toBe(true);
    });

    test("should deny charges to blocked countries", async () => {
      const invalidContext = {
        amount: 5000,
        currency: "USD",
        merchant_id: "merch_abc",
        region: "US",
        shipping_country: "BR", // Not in allowlist
        items: [{ sku: "SKU-1", qty: 1 }],
        idempotency_key: "charge-ord-1011",
      };

      mockPolicyVerification({
        allow: false,
        decision_id: "dec_133",
        reasons: [
          {
            code: "oap.region_blocked",
            message: "Shipping country not allowed",
          },
        ],
      });

      const response = await fetch("/api/verify/policy/payments.charge.v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: "550e8400-e29b-41d4-a716-446655440001",
          context: invalidContext,
        }),
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.allow).toBe(false);
      expect(result.reasons[0].code).toBe("oap.region_blocked");
    });
  });

  describe("Category Blocking", () => {
    test("should allow charges for allowed categories", async () => {
      const validContext = {
        amount: 5000,
        currency: "USD",
        merchant_id: "merch_abc",
        region: "US",
        items: [
          { sku: "SKU-1", qty: 1, category: "electronics" }, // Not blocked
        ],
        idempotency_key: "charge-ord-1012",
      };

      mockPolicyVerification({
        allow: true,
        decision_id: "dec_134",
        reasons: [
          { code: "oap.allowed", message: "Transaction within limits" },
        ],
      });

      const response = await fetch("/api/verify/policy/payments.charge.v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: "550e8400-e29b-41d4-a716-446655440001",
          context: validContext,
        }),
      });

      expect(response.ok).toBe(true);
    });

    test("should deny charges for blocked categories", async () => {
      const invalidContext = {
        amount: 5000,
        currency: "USD",
        merchant_id: "merch_abc",
        region: "US",
        items: [
          { sku: "SKU-1", qty: 1, category: "weapons" }, // Blocked category
        ],
        idempotency_key: "charge-ord-1013",
      };

      mockPolicyVerification({
        allow: false,
        decision_id: "dec_135",
        reasons: [
          { code: "oap.category_blocked", message: "Item category is blocked" },
        ],
      });

      const response = await fetch("/api/verify/policy/payments.charge.v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: "550e8400-e29b-41d4-a716-446655440001",
          context: invalidContext,
        }),
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.allow).toBe(false);
      expect(result.reasons[0].code).toBe("oap.category_blocked");
    });
  });

  describe("Idempotency Validation", () => {
    test("should allow charges with unique idempotency keys", async () => {
      const validContext = {
        amount: 5000,
        currency: "USD",
        merchant_id: "merch_abc",
        region: "US",
        items: [{ sku: "SKU-1", qty: 1 }],
        idempotency_key: "charge-ord-unique-123",
      };

      mockPolicyVerification({
        allow: true,
        decision_id: "dec_136",
        reasons: [
          { code: "oap.allowed", message: "Transaction within limits" },
        ],
      });

      const response = await fetch("/api/verify/policy/payments.charge.v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: "550e8400-e29b-41d4-a716-446655440001",
          context: validContext,
        }),
      });

      expect(response.ok).toBe(true);
    });

    test("should deny charges with duplicate idempotency keys", async () => {
      const invalidContext = {
        amount: 5000,
        currency: "USD",
        merchant_id: "merch_abc",
        region: "US",
        items: [{ sku: "SKU-1", qty: 1 }],
        idempotency_key: "charge-ord-1001", // Already used
      };

      mockPolicyVerification({
        allow: false,
        decision_id: "dec_137",
        reasons: [
          {
            code: "oap.idempotency_conflict",
            message: "Idempotency key already used",
          },
        ],
      });

      const response = await fetch("/api/verify/policy/payments.charge.v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: "550e8400-e29b-41d4-a716-446655440001",
          context: invalidContext,
        }),
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.allow).toBe(false);
      expect(result.reasons[0].code).toBe("oap.idempotency_conflict");
    });
  });

  describe("Assurance Level Validation", () => {
    test("should allow charges with sufficient assurance level", async () => {
      const validContext = {
        amount: 5000,
        currency: "USD",
        merchant_id: "merch_abc",
        region: "US",
        items: [{ sku: "SKU-1", qty: 1 }],
        idempotency_key: "charge-ord-1014",
      };

      mockPolicyVerification({
        allow: true,
        decision_id: "dec_138",
        reasons: [
          { code: "oap.allowed", message: "Transaction within limits" },
        ],
      });

      const response = await fetch("/api/verify/policy/payments.charge.v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: "550e8400-e29b-41d4-a716-446655440001",
          context: validContext,
        }),
      });

      expect(response.ok).toBe(true);
    });

    test("should deny charges with insufficient assurance level", async () => {
      const invalidContext = {
        amount: 5000,
        currency: "USD",
        merchant_id: "merch_abc",
        region: "US",
        items: [{ sku: "SKU-1", qty: 1 }],
        idempotency_key: "charge-ord-1015",
      };

      mockPolicyVerification({
        allow: false,
        decision_id: "dec_139",
        reasons: [
          {
            code: "oap.assurance_insufficient",
            message: "Assurance level too low",
          },
        ],
      });

      const response = await fetch("/api/verify/policy/payments.charge.v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: "550e8400-e29b-41d4-a716-446655440001",
          context: invalidContext,
        }),
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.allow).toBe(false);
      expect(result.reasons[0].code).toBe("oap.assurance_insufficient");
    });
  });

  describe("Error Handling", () => {
    test("should handle policy verification errors gracefully", async () => {
      mockPolicyVerificationError(500);

      const response = await fetch("/api/verify/policy/payments.charge.v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: "550e8400-e29b-41d4-a716-446655440001",
          context: {},
        }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });

    test("should handle malformed requests", async () => {
      mockPolicyVerificationError(400);

      const response = await fetch("/api/verify/policy/payments.charge.v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json",
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });
  });
});
