# APort Policy Packs

This repository contains the official APort policy packs for agent verification.

## 📦 Available Policy Packs

| Policy Pack | Description | Use Case | Compliance |
|-------------|-------------|----------|------------|
| **refunds.v1** | Payment refund policies | E-commerce, financial services | PCI DSS, SOX |
| **data_export.v1** | Data export restrictions | GDPR compliance, data privacy | GDPR, CCPA |
| **messaging.v1** | Communication policies | Chat bots, notifications | CAN-SPAM, TCPA |
| **repo.v1** | Repository access policies | CI/CD, code management | SOC 2, ISO 27001 |

### Policy Pack Details

Each policy pack includes:
- **Policy Rules**: JSON-based policy definitions
- **Integration Examples**: Express.js and FastAPI middleware
- **Test Suites**: Automated compliance testing
- **Documentation**: Complete usage guides

## 🚀 Usage

```bash
# Install via pnpm
pnpm install @aport/policies

# Or use directly
curl https://raw.githubusercontent.com/aporthq/aport-policies/main/policies/repo.v1/policy.json
```

## 📚 Documentation

- [Policy Pack Guide](https://aport.io/docs/policies)
- [API Reference](https://aport.io/docs/api)
- [Examples](https://github.com/aporthq/aport-policies/tree/main/examples)

## 🤝 Contributing

Policy packs are maintained in the main APort repository. Changes are automatically published here.

## 📄 License

MIT License - see LICENSE file for details.
