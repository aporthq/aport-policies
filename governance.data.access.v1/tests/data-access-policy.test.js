/**
 * Test Suite: governance.data.access.v1 Policy
 *
 * Tests the data access governance policy with various scenarios
 * including valid access, classification violations, and security controls.
 */

const fs = require("fs");
const path = require("path");

// Mock the policy evaluation function
async function evaluateGovernanceDataAccessV1(passport, context) {
  // Mock implementation based on the actual policy logic
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
  const hasDataAccessCapability = passport.capabilities?.some(
    (cap) => cap.id === "data.access"
  );
  if (!hasDataAccessCapability) {
    return {
      allow: false,
      reasons: [
        {
          code: "oap.unknown_capability",
          message: "Agent does not have data.access capability",
          severity: "error",
        },
      ],
    };
  }

  // Check assurance level
  const requiredAssurance =
    passport.limits?.data?.access?.require_assurance_at_least || "L3";
  if (
    passport.assurance_level !== requiredAssurance &&
    passport.assurance_level !== "L4KYC" &&
    passport.assurance_level !== "L4FIN"
  ) {
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
    "data_classification",
    "accessing_entity_id",
    "accessing_entity_type",
    "resource_id",
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

  // Check data classification is allowed
  const allowedClassifications =
    passport.limits?.data?.access?.allowed_classifications || [];
  if (
    allowedClassifications.length > 0 &&
    !allowedClassifications.includes(context.data_classification)
  ) {
    return {
      allow: false,
      reasons: [
        {
          code: "oap.classification_forbidden",
          message: `Data classification ${context.data_classification} is not allowed`,
          severity: "error",
        },
      ],
    };
  }

  // Check entity type is allowed for the data classification
  const permissions =
    passport.limits?.data?.access?.permissions?.[context.data_classification];
  if (
    permissions?.allowed_entity_types &&
    !permissions.allowed_entity_types.includes(context.accessing_entity_type)
  ) {
    return {
      allow: false,
      reasons: [
        {
          code: "oap.entity_type_forbidden",
          message: `Entity type ${context.accessing_entity_type} is not allowed for ${context.data_classification} data`,
          severity: "error",
        },
      ],
    };
  }

  // Check jurisdiction is allowed
  const allowedJurisdictions =
    passport.limits?.data?.access?.allowed_jurisdictions || [];
  if (
    context.jurisdiction &&
    allowedJurisdictions.length > 0 &&
    !allowedJurisdictions.includes(context.jurisdiction)
  ) {
    return {
      allow: false,
      reasons: [
        {
          code: "oap.jurisdiction_blocked",
          message: `Jurisdiction ${context.jurisdiction} is not allowed`,
          severity: "error",
        },
      ],
    };
  }

  // Check row limit for exports
  const maxRowsPerExport = passport.limits?.data?.access?.max_rows_per_export;
  if (
    context.row_count &&
    maxRowsPerExport &&
    context.row_count > maxRowsPerExport
  ) {
    return {
      allow: false,
      reasons: [
        {
          code: "oap.row_limit_exceeded",
          message: `Row count ${context.row_count} exceeds maximum allowed ${maxRowsPerExport}`,
          severity: "error",
        },
      ],
    };
  }

  // Check data locality (destination jurisdiction)
  const allowedDestinationJurisdictions =
    passport.limits?.data?.access?.allowed_destination_jurisdictions || [];
  if (
    context.destination_jurisdiction &&
    allowedDestinationJurisdictions.length > 0 &&
    !allowedDestinationJurisdictions.includes(context.destination_jurisdiction)
  ) {
    return {
      allow: false,
      reasons: [
        {
          code: "oap.jurisdiction_blocked",
          message: `Destination jurisdiction ${context.destination_jurisdiction} is not allowed`,
          severity: "error",
        },
      ],
    };
  }

  // Check balance inquiry limit
  const balanceInquiryCap =
    passport.limits?.data?.access?.balance_inquiry_cap_usd;
  if (
    context.resource_attributes?.account_balance_usd &&
    balanceInquiryCap &&
    context.resource_attributes.account_balance_usd >= balanceInquiryCap
  ) {
    return {
      allow: false,
      reasons: [
        {
          code: "oap.balance_inquiry_forbidden",
          message: `Account balance ${context.resource_attributes.account_balance_usd} exceeds inquiry cap ${balanceInquiryCap}`,
          severity: "error",
        },
      ],
    };
  }

  // Check action type is allowed
  if (
    context.action_type &&
    permissions?.allowed_actions &&
    !permissions.allowed_actions.includes(context.action_type)
  ) {
    return {
      allow: false,
      reasons: [
        {
          code: "oap.action_forbidden",
          message: `Action type ${context.action_type} is not allowed for ${context.data_classification} data`,
          severity: "error",
        },
      ],
    };
  }

  // If all checks pass, allow the data access
  return {
    allow: true,
    reasons: [
      {
        code: "oap.allowed",
        message: "Data access within limits and policy requirements",
        severity: "info",
      },
    ],
  };
}

// Test runner
async function runTests() {
  console.log("🧪 Running governance.data.access.v1 Policy Tests\n");

  // Load test data
  const passportPath = path.join(__dirname, "passport.instance.json");
  const contextsPath = path.join(__dirname, "contexts.jsonl");
  const expectedPath = path.join(__dirname, "expected.jsonl");

  const passport = JSON.parse(fs.readFileSync(passportPath, "utf8"));
  const contexts = fs
    .readFileSync(contextsPath, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const expected = fs
    .readFileSync(expectedPath, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < contexts.length; i++) {
    const testCase = contexts[i];
    const expectedResult = expected[i];

    try {
      const result = await evaluateGovernanceDataAccessV1(
        passport,
        testCase.context
      );

      // Compare results
      const allowMatch = result.allow === expectedResult.expected.allow;
      const reasonsMatch =
        JSON.stringify(result.reasons) ===
        JSON.stringify(expectedResult.expected.reasons);

      if (allowMatch && reasonsMatch) {
        console.log(`✅ ${testCase.name}: PASS`);
        passed++;
      } else {
        console.log(`❌ ${testCase.name}: FAIL`);
        console.log(`   Expected: ${JSON.stringify(expectedResult.expected)}`);
        console.log(`   Got: ${JSON.stringify(result)}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${testCase.name}: ERROR - ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log("🎉 All tests passed!");
    process.exit(0);
  } else {
    console.log("💥 Some tests failed!");
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { evaluateGovernanceDataAccessV1, runTests };
