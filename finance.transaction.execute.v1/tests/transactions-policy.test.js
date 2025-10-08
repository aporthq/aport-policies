/**
 * Test Suite: finance.transaction.execute.v1 Policy
 *
 * Tests the financial transaction execution policy with various scenarios
 * including valid transactions, limit violations, and security controls.
 */

const fs = require("fs");
const path = require("path");

// Mock the policy evaluation function
async function evaluateFinanceTransactionExecuteV1(passport, context) {
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
  const hasTransactionCapability = passport.capabilities?.some(
    (cap) => cap.id === "finance.transaction"
  );
  if (!hasTransactionCapability) {
    return {
      allow: false,
      reasons: [
        {
          code: "oap.unknown_capability",
          message: "Agent does not have finance.transaction capability",
          severity: "error",
        },
      ],
    };
  }

  // Check assurance level
  const requiredAssurance =
    passport.limits?.finance?.transaction?.require_assurance_at_least || "L3";
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
    "transaction_type",
    "amount",
    "currency",
    "asset_class",
    "source_account_id",
    "destination_account_id",
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

  // Check transaction type is allowed
  const allowedTransactionTypes =
    passport.limits?.finance?.transaction?.allowed_transaction_types || [];
  if (
    allowedTransactionTypes.length > 0 &&
    !allowedTransactionTypes.includes(context.transaction_type)
  ) {
    return {
      allow: false,
      reasons: [
        {
          code: "oap.action_forbidden",
          message: `Transaction type ${context.transaction_type} is not allowed`,
          severity: "error",
        },
      ],
    };
  }

  // Check asset class is allowed
  const allowedAssetClasses =
    passport.limits?.finance?.transaction?.allowed_asset_classes || [];
  if (
    allowedAssetClasses.length > 0 &&
    !allowedAssetClasses.includes(context.asset_class)
  ) {
    return {
      allow: false,
      reasons: [
        {
          code: "oap.asset_class_forbidden",
          message: `Asset class ${context.asset_class} is not allowed`,
          severity: "error",
        },
      ],
    };
  }

  // Check exposure limit
  const maxExposure =
    passport.limits?.finance?.transaction?.max_exposure_per_tx_usd;
  if (maxExposure && context.amount > maxExposure) {
    return {
      allow: false,
      reasons: [
        {
          code: "oap.limit_exceeded",
          message: `Amount ${context.amount} exceeds maximum exposure limit ${maxExposure}`,
          severity: "error",
        },
      ],
    };
  }

  // Check source account type restrictions
  const restrictedAccountTypes =
    passport.limits?.finance?.transaction?.restricted_source_account_types ||
    [];
  if (
    context.source_account_type &&
    restrictedAccountTypes.includes(context.source_account_type)
  ) {
    return {
      allow: false,
      reasons: [
        {
          code: "oap.account_type_restricted",
          message: `Source account type ${context.source_account_type} is restricted`,
          severity: "error",
        },
      ],
    };
  }

  // Check allowed source account types
  const allowedSourceAccountTypes =
    passport.limits?.finance?.transaction?.allowed_source_account_types || [];
  if (
    allowedSourceAccountTypes.length > 0 &&
    context.source_account_type &&
    !allowedSourceAccountTypes.includes(context.source_account_type)
  ) {
    return {
      allow: false,
      reasons: [
        {
          code: "oap.account_type_restricted",
          message: `Source account type ${context.source_account_type} is not allowed`,
          severity: "error",
        },
      ],
    };
  }

  // Check segregation of funds (prevent commingling)
  if (
    context.source_account_type === "client_funds" &&
    context.destination_account_type === "proprietary"
  ) {
    return {
      allow: false,
      reasons: [
        {
          code: "oap.commingling_of_funds_forbidden",
          message: "Cannot transfer from client funds to proprietary accounts",
          severity: "error",
        },
      ],
    };
  }

  // Check counterparty exposure limit
  const maxCounterpartyExposure =
    passport.limits?.finance?.transaction?.max_exposure_per_counterparty_usd;
  if (
    maxCounterpartyExposure &&
    context.counterparty_id &&
    context.amount > maxCounterpartyExposure
  ) {
    return {
      allow: false,
      reasons: [
        {
          code: "oap.counterparty_limit_exceeded",
          message: `Amount ${context.amount} exceeds counterparty exposure limit ${maxCounterpartyExposure}`,
          severity: "error",
        },
      ],
    };
  }

  // If all checks pass, allow the transaction
  return {
    allow: true,
    reasons: [
      {
        code: "oap.allowed",
        message: "Transaction within limits and policy requirements",
        severity: "info",
      },
    ],
  };
}

// Test runner
async function runTests() {
  console.log("🧪 Running finance.transaction.execute.v1 Policy Tests\n");

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
      const result = await evaluateFinanceTransactionExecuteV1(
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

module.exports = { evaluateFinanceTransactionExecuteV1, runTests };
