/**
 * Test Suite: deliverable.task.complete.v1 Policy
 *
 * Covers all 18 PRD test cases for the Task Completion Gate policy.
 * Tests via direct generic evaluator invocation (no API required).
 */

import { describe, it, expect } from "vitest";
import { evaluateGenericPolicy } from "../../../functions/utils/policy/generic-evaluator";
import type { PassportData } from "../../../types/passport";

const PACK_ID = "deliverable.task.complete.v1";

const mockEnv = {} as any;

const DEFAULT_DELIVERABLE_LIMITS: Record<string, any> = {
  require_summary: false,
  min_summary_words: 10,
  require_tests_passing: false,
  require_different_reviewer: false,
  scan_output: false,
  blocked_patterns: [],
  acceptance_criteria: [],
};

function deliverableLimits(overrides: Record<string, any> = {}) {
  return { ...DEFAULT_DELIVERABLE_LIMITS, ...overrides };
}

function basePassport(overrides: Partial<PassportData> & { limits?: Record<string, any> } = {}): PassportData {
  const limitsOverride = (overrides.limits as Record<string, any>)?.["deliverable.task.complete"];
  const deliverableBlock =
    limitsOverride !== undefined
      ? deliverableLimits(limitsOverride)
      : deliverableLimits();
  return {
    agent_id: "ap_test123",
    owner_id: "ap_org_test",
    status: "active",
    assurance_level: "L1",
    capabilities: [{ id: "deliverable.task.complete", description: "Task completion gate" }],
    limits: {
      "deliverable.task.complete": deliverableBlock,
      ...(overrides.limits as Record<string, any>),
    },
    ...overrides,
  } as PassportData;
}

function baseContext(overrides: Record<string, any> = {}) {
  return {
    task_id: "task-1",
    output_type: "code" as const,
    criteria_attestations: [] as Array<{ criterion_id: string; met: boolean; evidence: string }>,
    ...overrides,
  };
}

describe("deliverable.task.complete.v1", () => {
  // Test 1: Valid context, all criteria met with evidence, summary present → ALLOW
  it("1. ALLOW: valid context, all criteria met with evidence, summary present", async () => {
    const passport = basePassport({
      limits: {
        "deliverable.task.complete": deliverableLimits({
          require_summary: true,
          min_summary_words: 20,
          acceptance_criteria: [
            { id: "c1", description: "Criterion 1" },
            { id: "c2", description: "Criterion 2" },
          ],
        }),
      },
    });
    const context = baseContext({
      summary: "Implemented OAuth2 refresh token flow with rotation and expiry. Added 6 unit tests. All tests pass. Documentation updated with examples. Code reviewed and approved.",
      criteria_attestations: [
        { criterion_id: "c1", met: true, evidence: "PR #47" },
        { criterion_id: "c2", met: true, evidence: "grep -r TODO src/ returned 0" },
      ],
    });
    const decision = await evaluateGenericPolicy(
      mockEnv,
      PACK_ID,
      passport,
      context,
      undefined,
      { skipSigning: true }
    );
    if (!decision.allow) {
      throw new Error(
        `Test 1 expected ALLOW but got DENY: ${JSON.stringify(decision.reasons, null, 2)}`,
      );
    }
    expect(decision.allow).toBe(true);
  });

  // Test 2: met: false on one attestation → DENY oap.criteria_not_met
  it("2. DENY oap.criteria_not_met: met false on one attestation", async () => {
    const passport = basePassport({
      limits: {
        "deliverable.task.complete": deliverableLimits({
          acceptance_criteria: [{ id: "c1", description: "C1" }],
        }),
      },
    });
    const context = baseContext({
      criteria_attestations: [{ criterion_id: "c1", met: false, evidence: "Not done" }],
    });
    const decision = await evaluateGenericPolicy(
      mockEnv,
      PACK_ID,
      passport,
      context,
      undefined,
      { skipSigning: true }
    );
    expect(decision.allow).toBe(false);
    expect(decision.reasons[0]?.code).toBe("oap.criteria_not_met");
  });

  // Test 3: Empty evidence string on one attestation → DENY oap.evidence_missing
  it("3. DENY oap.evidence_missing: empty evidence on one attestation", async () => {
    const passport = basePassport({
      limits: {
        "deliverable.task.complete": deliverableLimits({
          acceptance_criteria: [{ id: "c1", description: "C1" }],
        }),
      },
    });
    const context = baseContext({
      criteria_attestations: [{ criterion_id: "c1", met: true, evidence: "" }],
    });
    const decision = await evaluateGenericPolicy(
      mockEnv,
      PACK_ID,
      passport,
      context,
      undefined,
      { skipSigning: true }
    );
    expect(decision.allow).toBe(false);
    expect(decision.reasons[0]?.code).toBe("oap.evidence_missing");
  });

  // Test 4: Passport has 2 criteria, context submits attestation for only 1 → DENY oap.criteria_incomplete
  it("4. DENY oap.criteria_incomplete: missing attestation for passport criterion", async () => {
    const passport = basePassport({
      limits: {
        "deliverable.task.complete": deliverableLimits({
          acceptance_criteria: [
            { id: "c1", description: "C1" },
            { id: "c2", description: "C2" },
          ],
        }),
      },
    });
    const context = baseContext({
      criteria_attestations: [{ criterion_id: "c1", met: true, evidence: "done" }],
    });
    const decision = await evaluateGenericPolicy(
      mockEnv,
      PACK_ID,
      passport,
      context,
      undefined,
      { skipSigning: true }
    );
    expect(decision.allow).toBe(false);
    expect(decision.reasons[0]?.code).toBe("oap.criteria_incomplete");
  });

  // Rule order: all_passport_criteria_attested runs before all_criteria_have_evidence.
  // When both fail (missing attestation + empty evidence), deny code must be oap.criteria_incomplete.
  it("denies criteria_incomplete before evidence_missing when both fail", async () => {
    const passport = basePassport({
      limits: {
        "deliverable.task.complete": deliverableLimits({
          acceptance_criteria: [
            { id: "c1", description: "C1" },
            { id: "c2", description: "C2" },
          ],
        }),
      },
    });
    const context = baseContext({
      criteria_attestations: [
        { criterion_id: "c1", met: true, evidence: "" },
      ],
    });
    const decision = await evaluateGenericPolicy(
      mockEnv,
      PACK_ID,
      passport,
      context,
      undefined,
      { skipSigning: true }
    );
    expect(decision.allow).toBe(false);
    expect(decision.reasons[0]?.code).toBe("oap.criteria_incomplete");
  });

  // Test 5: Passport has NO acceptance_criteria, context has empty criteria_attestations → ALLOW
  it("5. ALLOW: no acceptance_criteria, empty criteria_attestations (undefined handling)", async () => {
    const passport = basePassport({
      limits: {
        "deliverable.task.complete": deliverableLimits({
          acceptance_criteria: undefined, // tests !limits.acceptance_criteria path
        }),
      },
    });
    const context = baseContext({ criteria_attestations: [] });
    const decision = await evaluateGenericPolicy(
      mockEnv,
      PACK_ID,
      passport,
      context,
      undefined,
      { skipSigning: true }
    );
    expect(decision.allow).toBe(true);
  });

  // Test 6: require_summary: true, no summary in context → DENY oap.summary_insufficient
  it("6. DENY oap.summary_insufficient: require_summary true, no summary", async () => {
    const passport = basePassport({
      limits: {
        "deliverable.task.complete": deliverableLimits({
          require_summary: true,
          min_summary_words: 20,
        }),
      },
    });
    const context = baseContext({ summary: undefined });
    const decision = await evaluateGenericPolicy(
      mockEnv,
      PACK_ID,
      passport,
      context,
      undefined,
      { skipSigning: true }
    );
    expect(decision.allow).toBe(false);
    expect(decision.reasons[0]?.code).toBe("oap.summary_insufficient");
  });

  // Test 7: require_summary: true, summary is 3 words, min is 20 → DENY oap.summary_insufficient
  it("7. DENY oap.summary_insufficient: summary 3 words, min 20", async () => {
    const passport = basePassport({
      limits: {
        "deliverable.task.complete": deliverableLimits({
          require_summary: true,
          min_summary_words: 20,
        }),
      },
    });
    const context = baseContext({ summary: "Did the thing." });
    const decision = await evaluateGenericPolicy(
      mockEnv,
      PACK_ID,
      passport,
      context,
      undefined,
      { skipSigning: true }
    );
    expect(decision.allow).toBe(false);
    expect(decision.reasons[0]?.code).toBe("oap.summary_insufficient");
  });

  // Test 8: require_tests_passing: true, tests_passing: false → DENY oap.tests_not_passing
  it("8. DENY oap.tests_not_passing: tests_passing false", async () => {
    const passport = basePassport({
      limits: {
        "deliverable.task.complete": deliverableLimits({
          require_tests_passing: true,
        }),
      },
    });
    const context = baseContext({ tests_passing: false });
    const decision = await evaluateGenericPolicy(
      mockEnv,
      PACK_ID,
      passport,
      context,
      undefined,
      { skipSigning: true }
    );
    expect(decision.allow).toBe(false);
    expect(decision.reasons[0]?.code).toBe("oap.tests_not_passing");
  });

  // Test 9: require_tests_passing: true, tests_passing omitted → DENY oap.tests_not_passing
  it("9. DENY oap.tests_not_passing: tests_passing omitted", async () => {
    const passport = basePassport({
      limits: {
        "deliverable.task.complete": deliverableLimits({
          require_tests_passing: true,
        }),
      },
    });
    const context = baseContext();
    const decision = await evaluateGenericPolicy(
      mockEnv,
      PACK_ID,
      passport,
      context,
      undefined,
      { skipSigning: true }
    );
    expect(decision.allow).toBe(false);
    expect(decision.reasons[0]?.code).toBe("oap.tests_not_passing");
  });

  // Test 10: require_different_reviewer: true, same agent_id for both → DENY oap.self_review_not_allowed
  it("10. DENY oap.self_review_not_allowed: same agent for reviewer and author", async () => {
    const passport = basePassport({
      limits: {
        "deliverable.task.complete": deliverableLimits({
          require_different_reviewer: true,
        }),
      },
    });
    const context = baseContext({
      reviewer_agent_id: "ap_same",
      author_agent_id: "ap_same",
    });
    const decision = await evaluateGenericPolicy(
      mockEnv,
      PACK_ID,
      passport,
      context,
      undefined,
      { skipSigning: true }
    );
    expect(decision.allow).toBe(false);
    expect(decision.reasons[0]?.code).toBe("oap.self_review_not_allowed");
  });

  // Test 11: require_different_reviewer: true, author_agent_id omitted → DENY oap.self_review_not_allowed (anti-bypass)
  it("11. DENY oap.self_review_not_allowed: author_agent_id omitted", async () => {
    const passport = basePassport({
      limits: {
        "deliverable.task.complete": deliverableLimits({
          require_different_reviewer: true,
        }),
      },
    });
    const context = baseContext({
      reviewer_agent_id: "ap_reviewer",
      author_agent_id: undefined,
    });
    const decision = await evaluateGenericPolicy(
      mockEnv,
      PACK_ID,
      passport,
      context,
      undefined,
      { skipSigning: true }
    );
    expect(decision.allow).toBe(false);
    expect(decision.reasons[0]?.code).toBe("oap.self_review_not_allowed");
  });

  // Test 11b: require_different_reviewer: true, reviewer_agent_id omitted → DENY oap.self_review_not_allowed (symmetry)
  it("11b. DENY oap.self_review_not_allowed: reviewer_agent_id omitted", async () => {
    const passport = basePassport({
      limits: {
        "deliverable.task.complete": deliverableLimits({
          require_different_reviewer: true,
        }),
      },
    });
    const context = baseContext({
      reviewer_agent_id: undefined,
      author_agent_id: "ap_author",
    });
    const decision = await evaluateGenericPolicy(
      mockEnv,
      PACK_ID,
      passport,
      context,
      undefined,
      { skipSigning: true }
    );
    expect(decision.allow).toBe(false);
    expect(decision.reasons[0]?.code).toBe("oap.self_review_not_allowed");
  });

  // Test 9b: require_tests_passing: true, tests_passing as string "true" → DENY (strict !== true)
  it("9b. DENY oap.tests_not_passing: tests_passing string 'true' (strict check)", async () => {
    const passport = basePassport({
      limits: {
        "deliverable.task.complete": deliverableLimits({
          require_tests_passing: true,
        }),
      },
    });
    const context = baseContext({ tests_passing: "true" as any });
    const decision = await evaluateGenericPolicy(
      mockEnv,
      PACK_ID,
      passport,
      context,
      undefined,
      { skipSigning: true }
    );
    expect(decision.allow).toBe(false);
    expect(decision.reasons[0]?.code).toBe("oap.tests_not_passing");
  });

  // Test 12: require_different_reviewer: true, different agent_ids → ALLOW
  it("12. ALLOW: different reviewer and author", async () => {
    const passport = basePassport({
      limits: {
        "deliverable.task.complete": deliverableLimits({
          require_different_reviewer: true,
        }),
      },
    });
    const context = baseContext({
      reviewer_agent_id: "ap_reviewer",
      author_agent_id: "ap_author",
    });
    const decision = await evaluateGenericPolicy(
      mockEnv,
      PACK_ID,
      passport,
      context,
      undefined,
      { skipSigning: true }
    );
    expect(decision.allow).toBe(true);
  });

  // Test 13: scan_output: true, output contains "TODO" → DENY oap.blocked_pattern_detected
  it("13. DENY oap.blocked_pattern_detected: output contains TODO", async () => {
    const passport = basePassport({
      limits: {
        "deliverable.task.complete": deliverableLimits({
          scan_output: true,
          blocked_patterns: ["TODO"],
        }),
      },
    });
    const context = baseContext({
      output_content: "function foo() { // TODO: implement",
    });
    const decision = await evaluateGenericPolicy(
      mockEnv,
      PACK_ID,
      passport,
      context,
      undefined,
      { skipSigning: true }
    );
    expect(decision.allow).toBe(false);
    expect(decision.reasons[0]?.code).toBe("oap.blocked_pattern_detected");
  });

  // Test 13b: case-insensitive matching — pattern "todo" matches "TODO" in content
  it("13b. DENY oap.blocked_pattern_detected: case-insensitive pattern match", async () => {
    const passport = basePassport({
      limits: {
        "deliverable.task.complete": deliverableLimits({
          scan_output: true,
          blocked_patterns: ["todo"],
        }),
      },
    });
    const context = baseContext({
      output_content: "// TODO: fix this later",
    });
    const decision = await evaluateGenericPolicy(
      mockEnv,
      PACK_ID,
      passport,
      context,
      undefined,
      { skipSigning: true }
    );
    expect(decision.allow).toBe(false);
    expect(decision.reasons[0]?.code).toBe("oap.blocked_pattern_detected");
  });

  // Test 14: scan_output: true, output is clean → ALLOW
  it("14. ALLOW: scan_output true, output clean", async () => {
    const passport = basePassport({
      limits: {
        "deliverable.task.complete": deliverableLimits({
          scan_output: true,
          blocked_patterns: ["TODO", "FIXME"],
        }),
      },
    });
    const context = baseContext({
      output_content: "function foo() { return 42; }",
    });
    const decision = await evaluateGenericPolicy(
      mockEnv,
      PACK_ID,
      passport,
      context,
      undefined,
      { skipSigning: true }
    );
    expect(decision.allow).toBe(true);
  });

  // Test 15: scan_output: true, no output_content submitted → ALLOW (scan skipped)
  it("15. ALLOW: scan_output true, no output_content (scan skipped)", async () => {
    const passport = basePassport({
      limits: {
        "deliverable.task.complete": deliverableLimits({
          scan_output: true,
          blocked_patterns: ["TODO"],
        }),
      },
    });
    const context = baseContext();
    const decision = await evaluateGenericPolicy(
      mockEnv,
      PACK_ID,
      passport,
      context,
      undefined,
      { skipSigning: true }
    );
    expect(decision.allow).toBe(true);
  });

  // Test 16: scan_output: false, output contains "TODO" → ALLOW (scan disabled)
  it("16. ALLOW: scan_output false, output contains TODO", async () => {
    const passport = basePassport({
      limits: {
        "deliverable.task.complete": deliverableLimits({
          scan_output: false,
          blocked_patterns: ["TODO"],
        }),
      },
    });
    const context = baseContext({
      output_content: "// TODO: fix this",
    });
    const decision = await evaluateGenericPolicy(
      mockEnv,
      PACK_ID,
      passport,
      context,
      undefined,
      { skipSigning: true }
    );
    expect(decision.allow).toBe(true);
  });

  // Test 17: Passport status: suspended → DENY oap.passport_suspended
  it("17. DENY oap.passport_suspended: passport suspended", async () => {
    const passport = basePassport({ status: "suspended" });
    const context = baseContext();
    const decision = await evaluateGenericPolicy(
      mockEnv,
      PACK_ID,
      passport,
      context,
      undefined,
      { skipSigning: true }
    );
    expect(decision.allow).toBe(false);
    expect(decision.reasons[0]?.code).toBe("oap.passport_suspended");
  });

  // Test 18: Passport missing deliverable.task.complete capability → DENY oap.unknown_capability
  it("18. DENY oap.unknown_capability: missing capability", async () => {
    const passport = basePassport({
      capabilities: [{ id: "data.file.write", params: {} }],
      limits: {},
    });
    const context = baseContext();
    const decision = await evaluateGenericPolicy(
      mockEnv,
      PACK_ID,
      passport,
      context,
      undefined,
      { skipSigning: true }
    );
    expect(decision.allow).toBe(false);
    expect(decision.reasons[0]?.code).toBe("oap.unknown_capability");
  });
});
