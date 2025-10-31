
## Required Context

This policy requires the following context (JSON Schema):

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": [
    "amount",
    "currency",
    "destination_type",
    "destination_id",
    "payout_method",
    "idempotency_key"
  ],
  "properties": {
    "amount": {
      "type": "integer",
      "minimum": 1,
      "description": "Payout amount in minor units (e.g., cents)"
    },
    "currency": {
      "type": "string",
      "pattern": "^[A-Z]{3}$",
      "description": "ISO 4217 currency code"
    },
    "destination_type": {
      "type": "string",
      "enum": [
        "bank_account",
        "digital_wallet",
        "crypto_address"
      ],
      "description": "Type of destination account"
    },
    "destination_id": {
      "type": "string",
      "description": "Destination account identifier"
    },
    "payout_method": {
      "type": "string",
      "enum": [
        "wire_transfer",
        "ach",
        "crypto_transfer",
        "digital_wallet"
      ],
      "description": "Method of payout"
    },
    "idempotency_key": {
      "type": "string",
      "minLength": 8,
      "description": "Idempotency key for duplicate prevention"
    },
    "description": {
      "type": "string",
      "description": "Optional payout description"
    },
    "compliance_notes": {
      "type": "string",
      "description": "Compliance verification notes"
    },
    "approval_required": {
      "type": "boolean",
      "description": "Whether payout requires manual approval"
    }
  }
}
```

You can also fetch this live via the discovery endpoint:

```bash
curl -s "https://aport.io/api/policies/finance.payment.payout.v1?format=schema"
```

