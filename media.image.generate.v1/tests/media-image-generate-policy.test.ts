import { describe, expect, it } from "vitest";

import type { PassportData } from "../../../types/passport";
import { evaluateGenericPolicy } from "../../../functions/utils/policy/generic-evaluator";

const PACK_ID = "media.image.generate.v1";

function passport(overrides: Partial<PassportData> = {}): PassportData {
  return {
    agent_id: "ap_media_agent",
    owner_id: "ap_org_media",
    status: "active",
    assurance_level: "L1",
    capabilities: [{ id: "media.image.generate" }],
    limits: {
      "media.image.generate": {
        allowed_providers: ["openai"],
        max_prompt_length: 100,
        max_referenced_images: 0,
        max_output_images: 2,
        allowed_output_formats: ["png", "webp"],
      },
    },
    ...overrides,
  } as PassportData;
}

function context(overrides: Record<string, unknown> = {}) {
  return {
    provider: "openai",
    prompt_length: 32,
    referenced_image_count: 0,
    output_count: 1,
    output_format: "png",
    ...overrides,
  };
}

describe("media.image.generate.v1", () => {
  it("allows sanitized image generation metadata inside configured limits", async () => {
    const decision = await evaluateGenericPolicy(
      {} as any,
      PACK_ID,
      passport(),
      context(),
      undefined,
      { skipSigning: true },
    );

    expect(decision.allow).toBe(true);
  });

  it("rejects reserved hosted verifier routing fields in direct policy context", async () => {
    const decision = await evaluateGenericPolicy(
      {} as any,
      PACK_ID,
      passport(),
      context({
        agent_id: "ap_media_agent",
        idempotency_key: "img_20260926_001",
      }),
      undefined,
      { skipSigning: true },
    );

    expect(decision.allow).toBe(false);
    expect(decision.reasons[0]?.code).toBe("oap.invalid_context");
  });

  it("denies provider, prompt, reference, output count, and format violations", async () => {
    const cases = [
      [{ provider: "blocked" }, "oap.provider_not_allowed"],
      [{ prompt_length: 101 }, "oap.prompt_too_large"],
      [{ referenced_image_count: 1 }, "oap.referenced_image_limit_exceeded"],
      [{ output_count: 3 }, "oap.output_image_limit_exceeded"],
      [{ output_format: "gif" }, "oap.output_format_not_allowed"],
    ] as const;

    for (const [overrides, code] of cases) {
      const decision = await evaluateGenericPolicy(
        {} as any,
        PACK_ID,
        passport(),
        context(overrides),
        undefined,
        { skipSigning: true },
      );

      expect(decision.allow).toBe(false);
      expect(decision.reasons[0]?.code).toBe(code);
    }
  });

  it("denies malformed nested limits before allowlist rules", async () => {
    const cases = [
      { allowed_providers: "openai" },
      { allowed_output_formats: "png" },
      { allowed_output_formats: ["bmp"] },
      { max_prompt_length: "100" },
      { max_referenced_images: -1 },
      { max_output_images: 0 },
    ];

    for (const malformedLimit of cases) {
      const decision = await evaluateGenericPolicy(
        {} as any,
        PACK_ID,
        passport({
          limits: {
            "media.image.generate": {
              allowed_providers: ["openai"],
              max_prompt_length: 100,
              max_referenced_images: 0,
              max_output_images: 2,
              allowed_output_formats: ["png", "webp"],
              ...malformedLimit,
            },
          },
        }),
        context({ provider: "open" }),
        undefined,
        { skipSigning: true },
      );

      expect(decision.allow).toBe(false);
      expect(decision.reasons[0]?.code).toBe("oap.invalid_context");
    }
  });

  it("denies non-metadata and malformed fields before allowlist rules", async () => {
    const loosePassport = passport({
      limits: {
        "media.image.generate": {
          allowed_providers: ["*"],
          max_prompt_length: 100,
          max_referenced_images: 10,
          max_output_images: 10,
          allowed_output_formats: ["*"],
        },
      },
    });
    const cases = [
      { prompt_length: -1 },
      { referenced_image_count: 1.5 },
      { output_count: -1 },
      { output_format: "bmp" },
      { prompt: "raw prompts must not be forwarded" },
      { image_url: "https://example.com/source.png" },
      { file_path: "/tmp/source.png" },
    ];

    for (const overrides of cases) {
      const decision = await evaluateGenericPolicy(
        {} as any,
        PACK_ID,
        loosePassport,
        context(overrides),
        undefined,
        { skipSigning: true },
      );

      expect(decision.allow).toBe(false);
      expect(decision.reasons[0]?.code).toBe("oap.invalid_context");
    }
  });
});
