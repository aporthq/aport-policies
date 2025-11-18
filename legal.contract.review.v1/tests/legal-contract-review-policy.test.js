/**
 * Test Suite: legal.contract.review.v1 Policy
 *
 * Tests the legal contract review policy with various scenarios
 * including valid reviews, document type violations, jurisdiction controls,
 * attorney review requirements, and privilege protection.
 */

const {
  test,
  expect,
  describe,
  beforeEach,
  afterEach,
} = require("@jest/globals");

const fs = require("fs");
const path = require("path");

// Load passport template
const passportTemplate = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "passport.template.json"),
    "utf8"
  )
);

// Mock the policy evaluation function
async function evaluateLegalContractReviewV1(passport, context) {
  const reasons = [];
  let allow = true;

  // Check agent status
  if (passport.status === "suspended" || passport.status === "revoked") {
    return {
      allow: false,
      reasons: [
        {
          code: "oap.passport_suspended",
          message: `Agent is ${passport.status} and cannot perform operations`,
          severity: "error",
        },
      ],
    };
  }

  // Check capabilities
  const hasLegalContractReviewCapability = passport.capabilities?.some(
    (cap) => cap.id === "legal.contract.review"
  );
  if (!hasLegalContractReviewCapability) {
    return {
      allow: false,
      reasons: [
        {
          code: "oap.unknown_capability",
          message: "Agent does not have legal.contract.review capability",
          severity: "error",
        },
      ],
    };
  }

  // Check assurance level
  const requiredAssurance =
    passport.limits?.legal?.contract?.review?.require_assurance_at_least ||
    "L3";
  const assuranceLevels = ["L0", "L1", "L2", "L3", "L4KYC", "L4FIN"];
  const currentLevel = assuranceLevels.indexOf(passport.assurance_level);
  const requiredLevel = assuranceLevels.indexOf(requiredAssurance);
  if (currentLevel < requiredLevel) {
    return {
      allow: false,
      reasons: [
        {
          code: "oap.assurance_insufficient",
          message: `Assurance level ${passport.assurance_level} is insufficient, requires ${requiredAssurance}`,
          severity: "error",
        },
      ],
    };
  }

  // Check required fields
  const requiredFields = [
    "document_type",
    "client_id",
    "jurisdiction",
    "action_type",
    "idempotency_key",
  ];
  const missingFields = requiredFields.filter((field) => !context[field]);
  if (missingFields.length > 0) {
    return {
      allow: false,
      reasons: [
        {
          code: "oap.invalid_context",
          message: `Missing required fields: ${missingFields.join(", ")}`,
          severity: "error",
        },
      ],
    };
  }

  // Check document type is allowed
  const allowedDocumentTypes =
    passport.limits?.legal?.contract?.review?.allowed_document_types || [];
  if (
    allowedDocumentTypes.length > 0 &&
    !allowedDocumentTypes.includes(context.document_type)
  ) {
    return {
      allow: false,
      reasons: [
        {
          code: "oap.document_type_forbidden",
          message: `Document type ${context.document_type} is not allowed`,
          severity: "error",
        },
      ],
    };
  }

  // Check document size limit
  const maxDocumentSizeMb =
    passport.limits?.legal?.contract?.review?.max_document_size_mb;
  if (
    context.document_size_mb &&
    maxDocumentSizeMb &&
    context.document_size_mb > maxDocumentSizeMb
  ) {
    return {
      allow: false,
      reasons: [
        {
          code: "oap.document_size_exceeded",
          message: `Document size ${context.document_size_mb}MB exceeds maximum allowed ${maxDocumentSizeMb}MB`,
          severity: "error",
        },
      ],
    };
  }

  // Check jurisdiction is authorized
  const allowedJurisdictions =
    passport.limits?.legal?.contract?.review?.allowed_contract_jurisdictions ||
    [];
  if (
    allowedJurisdictions.length > 0 &&
    !allowedJurisdictions.includes(context.jurisdiction)
  ) {
    return {
      allow: false,
      reasons: [
        {
          code: "oap.jurisdiction_blocked",
          message: `Jurisdiction ${context.jurisdiction} is not authorized for contract review`,
          severity: "error",
        },
      ],
    };
  }

  // Check high-value contract review requirement FIRST (over $10,000 requires attorney review)
  // This check takes precedence to provide specific error code for high-value contracts
  const contractValueUsd = context.contract_value_usd;
  if (contractValueUsd && contractValueUsd >= 1000000 && !context.attorney_reviewer_id) {
    // 1000000 = $10,000 in minor units (cents)
    return {
      allow: false,
      reasons: [
        {
          code: "oap.high_value_review_required",
          message: "High-value contracts (over $10,000) require attorney review",
          severity: "error",
        },
      ],
    };
  }

  // Check general attorney review requirement (for all contracts when configured)
  const requireAttorneyReview =
    passport.limits?.legal?.contract?.review?.require_attorney_review;
  if (requireAttorneyReview && !context.attorney_reviewer_id) {
    return {
      allow: false,
      reasons: [
        {
          code: "oap.attorney_review_required",
          message: "Attorney review is required but attorney_reviewer_id is missing",
          severity: "error",
        },
      ],
    };
  }

  // Check privilege protection
  const privilegeProtectionEnabled =
    passport.limits?.legal?.contract?.review?.privilege_protection_enabled;
  if (privilegeProtectionEnabled && !context.privilege_level) {
    return {
      allow: false,
      reasons: [
        {
          code: "oap.privilege_protection_violation",
          message: "Privilege protection is enabled but privilege_level is missing",
          severity: "error",
        },
      ],
    };
  }

  // Check client tier authorization
  const allowedClientTiers =
    passport.limits?.legal?.contract?.review?.allowed_client_tiers || [];
  if (
    context.client_tier &&
    allowedClientTiers.length > 0 &&
    !allowedClientTiers.includes(context.client_tier)
  ) {
    return {
      allow: false,
      reasons: [
        {
          code: "oap.client_tier_forbidden",
          message: `Client tier ${context.client_tier} is not authorized`,
          severity: "error",
        },
      ],
    };
  }

  // Check idempotency
  const idempotencyRequired =
    passport.limits?.legal?.contract?.review?.idempotency_required ?? false;
  if (idempotencyRequired && !context.idempotency_key) {
    return {
      allow: false,
      reasons: [
        {
          code: "oap.idempotency_conflict",
          message: "Idempotency key is required",
          severity: "error",
        },
      ],
    };
  }

  return {
    allow: true,
    reasons: [],
  };
}

// Test cases
describe("Legal Contract Review v1 Policy - Core Functionality", () => {
  describe("Required Fields Validation", () => {
    test("should allow contract review with all required fields", async () => {
      const validContext = {
        document_type: "contract",
        client_id: "client_abc123",
        jurisdiction: "US",
        action_type: "review",
        idempotency_key: "unique-key-12345",
        attorney_reviewer_id: "attorney_xyz789",
        privilege_level: "privileged",
      };

      const result = await evaluateLegalContractReviewV1(
        passportTemplate,
        validContext
      );

      expect(result.allow).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    test("should deny contract review missing required fields", async () => {
      const invalidContext = {
        document_type: "contract",
        // Missing client_id, jurisdiction, action_type, idempotency_key
      };

      const result = await evaluateLegalContractReviewV1(
        passportTemplate,
        invalidContext
      );

      expect(result.allow).toBe(false);
      expect(result.reasons[0].code).toBe("oap.invalid_context");
    });
  });

  describe("Document Type Validation", () => {
    test("should allow allowed document types", async () => {
      const validContext = {
        document_type: "contract",
        client_id: "client_abc123",
        jurisdiction: "US",
        action_type: "review",
        idempotency_key: "unique-key-12345",
        attorney_reviewer_id: "attorney_xyz789",
        privilege_level: "privileged",
      };

      const result = await evaluateLegalContractReviewV1(
        passportTemplate,
        validContext
      );

      expect(result.allow).toBe(true);
    });

    test("should deny forbidden document types", async () => {
      const invalidContext = {
        document_type: "forbidden_type",
        client_id: "client_abc123",
        jurisdiction: "US",
        action_type: "review",
        idempotency_key: "unique-key-12345",
        attorney_reviewer_id: "attorney_xyz789",
        privilege_level: "privileged",
      };

      const result = await evaluateLegalContractReviewV1(
        passportTemplate,
        invalidContext
      );

      expect(result.allow).toBe(false);
      expect(result.reasons[0].code).toBe("oap.document_type_forbidden");
    });
  });

  describe("Document Size Limits", () => {
    test("should allow documents within size limit", async () => {
      const validContext = {
        document_type: "contract",
        client_id: "client_abc123",
        jurisdiction: "US",
        action_type: "review",
        idempotency_key: "unique-key-12345",
        document_size_mb: 5,
        attorney_reviewer_id: "attorney_xyz789",
        privilege_level: "privileged",
      };

      const result = await evaluateLegalContractReviewV1(
        passportTemplate,
        validContext
      );

      expect(result.allow).toBe(true);
    });

    test("should deny documents exceeding size limit", async () => {
      const invalidContext = {
        document_type: "contract",
        client_id: "client_abc123",
        jurisdiction: "US",
        action_type: "review",
        idempotency_key: "unique-key-12345",
        document_size_mb: 15, // Exceeds 10MB limit
        attorney_reviewer_id: "attorney_xyz789",
        privilege_level: "privileged",
      };

      const result = await evaluateLegalContractReviewV1(
        passportTemplate,
        invalidContext
      );

      expect(result.allow).toBe(false);
      expect(result.reasons[0].code).toBe("oap.document_size_exceeded");
    });
  });

  describe("Jurisdiction Controls", () => {
    test("should allow authorized jurisdictions", async () => {
      const validContext = {
        document_type: "contract",
        client_id: "client_abc123",
        jurisdiction: "US",
        action_type: "review",
        idempotency_key: "unique-key-12345",
        attorney_reviewer_id: "attorney_xyz789",
        privilege_level: "privileged",
      };

      const result = await evaluateLegalContractReviewV1(
        passportTemplate,
        validContext
      );

      expect(result.allow).toBe(true);
    });

    test("should deny unauthorized jurisdictions", async () => {
      const invalidContext = {
        document_type: "contract",
        client_id: "client_abc123",
        jurisdiction: "FR", // Not in allowed list
        action_type: "review",
        idempotency_key: "unique-key-12345",
        attorney_reviewer_id: "attorney_xyz789",
        privilege_level: "privileged",
      };

      const result = await evaluateLegalContractReviewV1(
        passportTemplate,
        invalidContext
      );

      expect(result.allow).toBe(false);
      expect(result.reasons[0].code).toBe("oap.jurisdiction_blocked");
    });
  });

  describe("Attorney Review Requirements", () => {
    test("should require attorney review when configured", async () => {
      const invalidContext = {
        document_type: "contract",
        client_id: "client_abc123",
        jurisdiction: "US",
        action_type: "review",
        idempotency_key: "unique-key-12345",
        // Missing attorney_reviewer_id
        privilege_level: "privileged",
      };

      const result = await evaluateLegalContractReviewV1(
        passportTemplate,
        invalidContext
      );

      expect(result.allow).toBe(false);
      expect(result.reasons[0].code).toBe("oap.attorney_review_required");
    });

    test("should require attorney review for high-value contracts", async () => {
      const invalidContext = {
        document_type: "contract",
        client_id: "client_abc123",
        jurisdiction: "US",
        action_type: "review",
        idempotency_key: "unique-key-12345",
        contract_value_usd: 1500000, // $15,000 - over $10,000 threshold
        privilege_level: "privileged",
        // Missing attorney_reviewer_id
      };

      const result = await evaluateLegalContractReviewV1(
        passportTemplate,
        invalidContext
      );

      expect(result.allow).toBe(false);
      expect(result.reasons[0].code).toBe("oap.high_value_review_required");
    });
  });

  describe("Privilege Protection", () => {
    test("should require privilege level when protection is enabled", async () => {
      const invalidContext = {
        document_type: "contract",
        client_id: "client_abc123",
        jurisdiction: "US",
        action_type: "review",
        idempotency_key: "unique-key-12345",
        attorney_reviewer_id: "attorney_xyz789",
        // Missing privilege_level
      };

      const result = await evaluateLegalContractReviewV1(
        passportTemplate,
        invalidContext
      );

      expect(result.allow).toBe(false);
      expect(result.reasons[0].code).toBe("oap.privilege_protection_violation");
    });
  });

  describe("Client Tier Authorization", () => {
    test("should allow authorized client tiers", async () => {
      const validContext = {
        document_type: "contract",
        client_id: "client_abc123",
        jurisdiction: "US",
        action_type: "review",
        idempotency_key: "unique-key-12345",
        client_tier: "tier1",
        attorney_reviewer_id: "attorney_xyz789",
        privilege_level: "privileged",
      };

      const result = await evaluateLegalContractReviewV1(
        passportTemplate,
        validContext
      );

      expect(result.allow).toBe(true);
    });

    test("should deny unauthorized client tiers", async () => {
      const invalidContext = {
        document_type: "contract",
        client_id: "client_abc123",
        jurisdiction: "US",
        action_type: "review",
        idempotency_key: "unique-key-12345",
        client_tier: "tier4", // Not in allowed list
        attorney_reviewer_id: "attorney_xyz789",
        privilege_level: "privileged",
      };

      const result = await evaluateLegalContractReviewV1(
        passportTemplate,
        invalidContext
      );

      expect(result.allow).toBe(false);
      expect(result.reasons[0].code).toBe("oap.client_tier_forbidden");
    });
  });

  describe("Capability Checks", () => {
    test("should deny if agent lacks legal.contract.review capability", async () => {
      const passportWithoutCapability = {
        ...passportTemplate,
        capabilities: [],
      };

      const validContext = {
        document_type: "contract",
        client_id: "client_abc123",
        jurisdiction: "US",
        action_type: "review",
        idempotency_key: "unique-key-12345",
        attorney_reviewer_id: "attorney_xyz789",
        privilege_level: "privileged",
      };

      const result = await evaluateLegalContractReviewV1(
        passportWithoutCapability,
        validContext
      );

      expect(result.allow).toBe(false);
      expect(result.reasons[0].code).toBe("oap.unknown_capability");
    });
  });

  describe("Assurance Level Checks", () => {
    test("should deny if assurance level is insufficient", async () => {
      const passportWithLowAssurance = {
        ...passportTemplate,
        assurance_level: "L2", // Below required L3
      };

      const validContext = {
        document_type: "contract",
        client_id: "client_abc123",
        jurisdiction: "US",
        action_type: "review",
        idempotency_key: "unique-key-12345",
        attorney_reviewer_id: "attorney_xyz789",
        privilege_level: "privileged",
      };

      const result = await evaluateLegalContractReviewV1(
        passportWithLowAssurance,
        validContext
      );

      expect(result.allow).toBe(false);
      expect(result.reasons[0].code).toBe("oap.assurance_insufficient");
    });
  });

  describe("Agent Status Checks", () => {
    test("should deny if agent is suspended", async () => {
      const suspendedPassport = {
        ...passportTemplate,
        status: "suspended",
      };

      const validContext = {
        document_type: "contract",
        client_id: "client_abc123",
        jurisdiction: "US",
        action_type: "review",
        idempotency_key: "unique-key-12345",
        attorney_reviewer_id: "attorney_xyz789",
        privilege_level: "privileged",
      };

      const result = await evaluateLegalContractReviewV1(
        suspendedPassport,
        validContext
      );

      expect(result.allow).toBe(false);
      expect(result.reasons[0].code).toBe("oap.passport_suspended");
    });
  });
});

