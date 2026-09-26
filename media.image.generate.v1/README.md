# Image Generation Policy Pack

`media.image.generate.v1` authorizes image generation and image editing requests before a model provider is called.

The pack is designed for guardrail hooks that should make an allow/deny decision without sending raw prompts, image bytes, or local file paths into policy evaluation. It evaluates metadata only: provider, optional model/size/aspect ratio, prompt length, referenced image count, requested output count, and output format.

## Policy Summary

| Field | Value |
|---|---|
| Policy ID | `media.image.generate.v1` |
| Required capability | `media.image.generate` |
| Minimum assurance | `L0` |
| Status | `active` |
| Primary limits object | `passport.limits["media.image.generate"]` |

## What It Enforces

- Provider allowlist through `allowed_providers`.
- Maximum prompt length through `max_prompt_length`.
- Maximum referenced image count through `max_referenced_images`.
- Maximum generated output count through `max_output_images`.
- Output format allowlist through `allowed_output_formats`.

## Required Context

```json
{
  "provider": "openai",
  "prompt_length": 320,
  "referenced_image_count": 0,
  "output_count": 1,
  "output_format": "png"
}
```

Optional metadata fields are `model`, `size`, and `aspect_ratio`.

Do not send raw prompt text, image contents, signed URLs, or local image paths as policy context. If a harness supports image edits from local files, authorize those file reads separately with `data.file.read.v1` before evaluating this image-generation policy.

## Required Limits

```json
{
  "media.image.generate": {
    "allowed_providers": ["openai"],
    "max_prompt_length": 8000,
    "max_referenced_images": 0,
    "max_output_images": 4,
    "allowed_output_formats": ["png", "jpg", "jpeg", "webp"]
  }
}
```

Use `allowed_providers: ["*"]` or `allowed_output_formats: ["*"]` only for permissive development passports. Production passports should name the approved providers and formats explicitly.

## Deny Codes

| Deny code | Meaning |
|---|---|
| `oap.invalid_context` | Context is missing required metadata, malformed, or contains raw/non-metadata fields. |
| `oap.provider_not_allowed` | The requested image provider is not allowed. |
| `oap.prompt_too_large` | `prompt_length` exceeds `max_prompt_length`. |
| `oap.referenced_image_limit_exceeded` | `referenced_image_count` exceeds `max_referenced_images`. |
| `oap.output_image_limit_exceeded` | `output_count` exceeds `max_output_images`. |
| `oap.output_format_not_allowed` | `output_format` is not allowed. |
