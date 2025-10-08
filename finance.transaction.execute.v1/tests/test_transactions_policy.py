"""
Test Suite: finance.transaction.execute.v1 Policy

Tests the financial transaction execution policy with various scenarios
including valid transactions, limit violations, and security controls.
"""

import json
import os
from typing import Dict, Any, List

def evaluate_finance_transaction_execute_v1(passport: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """Mock implementation of the finance.transaction.execute.v1 policy evaluation"""
    reasons = []
    allow = True

    # Check agent status
    if passport.get("status") in ["suspended", "revoked"]:
        return {
            "allow": False,
            "reasons": [{
                "code": "oap.passport_suspended",
                "message": f"Agent is {passport.get('status')} and cannot perform operations",
                "severity": "error"
            }]
        }

    # Check capabilities
    capabilities = passport.get("capabilities", [])
    has_transaction_capability = any(
        cap.get("id") == "finance.transaction" for cap in capabilities
    )
    if not has_transaction_capability:
        return {
            "allow": False,
            "reasons": [{
                "code": "oap.unknown_capability",
                "message": "Agent does not have finance.transaction capability",
                "severity": "error"
            }]
        }

    # Check assurance level
    required_assurance = passport.get("limits", {}).get("finance", {}).get("transaction", {}).get("require_assurance_at_least", "L3")
    assurance_level = passport.get("assurance_level")
    if assurance_level not in [required_assurance, "L4KYC", "L4FIN"]:
        return {
            "allow": False,
            "reasons": [{
                "code": "oap.assurance_insufficient",
                "message": f"Assurance level {assurance_level} is insufficient, requires {required_assurance}",
                "severity": "error"
            }]
        }

    # Check required fields
    required_fields = ["transaction_type", "amount", "currency", "asset_class", "source_account_id", "destination_account_id"]
    missing_fields = [field for field in required_fields if not context.get(field)]
    if missing_fields:
        return {
            "allow": False,
            "reasons": [{
                "code": "oap.invalid_context",
                "message": f"Missing required fields: {', '.join(missing_fields)}",
                "severity": "error"
            }]
        }

    # Check transaction type is allowed
    allowed_transaction_types = passport.get("limits", {}).get("finance", {}).get("transaction", {}).get("allowed_transaction_types", [])
    if allowed_transaction_types and context.get("transaction_type") not in allowed_transaction_types:
        return {
            "allow": False,
            "reasons": [{
                "code": "oap.action_forbidden",
                "message": f"Transaction type {context.get('transaction_type')} is not allowed",
                "severity": "error"
            }]
        }

    # Check asset class is allowed
    allowed_asset_classes = passport.get("limits", {}).get("finance", {}).get("transaction", {}).get("allowed_asset_classes", [])
    if allowed_asset_classes and context.get("asset_class") not in allowed_asset_classes:
        return {
            "allow": False,
            "reasons": [{
                "code": "oap.asset_class_forbidden",
                "message": f"Asset class {context.get('asset_class')} is not allowed",
                "severity": "error"
            }]
        }

    # Check exposure limit
    max_exposure = passport.get("limits", {}).get("finance", {}).get("transaction", {}).get("max_exposure_per_tx_usd")
    if max_exposure and context.get("amount", 0) > max_exposure:
        return {
            "allow": False,
            "reasons": [{
                "code": "oap.limit_exceeded",
                "message": f"Amount {context.get('amount')} exceeds maximum exposure limit {max_exposure}",
                "severity": "error"
            }]
        }

    # Check source account type restrictions
    restricted_account_types = passport.get("limits", {}).get("finance", {}).get("transaction", {}).get("restricted_source_account_types", [])
    if context.get("source_account_type") in restricted_account_types:
        return {
            "allow": False,
            "reasons": [{
                "code": "oap.account_type_restricted",
                "message": f"Source account type {context.get('source_account_type')} is restricted",
                "severity": "error"
            }]
        }

    # Check allowed source account types
    allowed_source_account_types = passport.get("limits", {}).get("finance", {}).get("transaction", {}).get("allowed_source_account_types", [])
    if allowed_source_account_types and context.get("source_account_type") and context.get("source_account_type") not in allowed_source_account_types:
        return {
            "allow": False,
            "reasons": [{
                "code": "oap.account_type_restricted",
                "message": f"Source account type {context.get('source_account_type')} is not allowed",
                "severity": "error"
            }]
        }

    # Check segregation of funds (prevent commingling)
    if context.get("source_account_type") == "client_funds" and context.get("destination_account_type") == "proprietary":
        return {
            "allow": False,
            "reasons": [{
                "code": "oap.commingling_of_funds_forbidden",
                "message": "Cannot transfer from client funds to proprietary accounts",
                "severity": "error"
            }]
        }

    # Check counterparty exposure limit
    max_counterparty_exposure = passport.get("limits", {}).get("finance", {}).get("transaction", {}).get("max_exposure_per_counterparty_usd")
    if max_counterparty_exposure and context.get("counterparty_id") and context.get("amount", 0) > max_counterparty_exposure:
        return {
            "allow": False,
            "reasons": [{
                "code": "oap.counterparty_limit_exceeded",
                "message": f"Amount {context.get('amount')} exceeds counterparty exposure limit {max_counterparty_exposure}",
                "severity": "error"
            }]
        }

    # If all checks pass, allow the transaction
    return {
        "allow": True,
        "reasons": [{
            "code": "oap.allowed",
            "message": "Transaction within limits and policy requirements",
            "severity": "info"
        }]
    }

def run_tests():
    """Run the test suite"""
    print("🧪 Running finance.transaction.execute.v1 Policy Tests\n")

    # Load test data
    test_dir = os.path.dirname(os.path.abspath(__file__))
    
    with open(os.path.join(test_dir, "passport.instance.json"), "r") as f:
        passport = json.load(f)
    
    with open(os.path.join(test_dir, "contexts.jsonl"), "r") as f:
        contexts = [json.loads(line) for line in f.read().strip().split("\n")]
    
    with open(os.path.join(test_dir, "expected.jsonl"), "r") as f:
        expected = [json.loads(line) for line in f.read().strip().split("\n")]

    passed = 0
    failed = 0

    for i, test_case in enumerate(contexts):
        expected_result = expected[i]

        try:
            result = evaluate_finance_transaction_execute_v1(passport, test_case["context"])
            
            # Compare results
            allow_match = result["allow"] == expected_result["expected"]["allow"]
            reasons_match = json.dumps(result["reasons"]) == json.dumps(expected_result["expected"]["reasons"])

            if allow_match and reasons_match:
                print(f"✅ {test_case['name']}: PASS")
                passed += 1
            else:
                print(f"❌ {test_case['name']}: FAIL")
                print(f"   Expected: {json.dumps(expected_result['expected'])}")
                print(f"   Got: {json.dumps(result)}")
                failed += 1
        except Exception as error:
            print(f"❌ {test_case['name']}: ERROR - {str(error)}")
            failed += 1

    print(f"\n📊 Test Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All tests passed!")
        return True
    else:
        print("💥 Some tests failed!")
        return False

if __name__ == "__main__":
    success = run_tests()
    exit(0 if success else 1)
