
## Required Context

This policy requires the following context (JSON Schema):

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": [
    "repository",
    "version",
    "files"
  ],
  "properties": {
    "repository": {
      "type": "string",
      "minLength": 1,
      "description": "Repository identifier"
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9.-]+)?(\\+[a-zA-Z0-9.-]+)?$",
      "description": "Semantic version number"
    },
    "files": {
      "type": "array",
      "minItems": 1,
      "description": "List of files to be released",
      "items": {
        "type": "string"
      }
    },
    "description": {
      "type": "string",
      "description": "Release description"
    },
    "changelog": {
      "type": "string",
      "description": "Release changelog"
    }
  }
}
```

You can also fetch this live via the discovery endpoint:

```bash
curl -s "https://aport.io/api/policies/code.release.publish.v1?format=schema"
```

