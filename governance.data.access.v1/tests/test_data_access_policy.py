"""
Test Suite: governance.data.access.v1 Policy

Tests the data access governance policy with various scenarios
including valid access, classification violations, and security controls.
"""

import json
import os
from typing import Dict, Any, List

def evaluate_governance_data_access_v1(passport: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """Mock implementation of the governance.data.access.v1 policy evaluation"""
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
    has_data_access_capability = any(
        cap.get("id") == "data.access" for cap in capabilities
    )
    if not has_data_access_capability:
        return {
            "allow": False,
            "reasons": [{
                "code": "oap.unknown_capability",
                "message": "Agent does not have data.access capability",
                "severity": "error"
            }]
        }

    # Check assurance level
    required_assurance = passport.get("limits", {}).get("data", {}).get("access", {}).get("require_assurance_at_least", "L3")
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
    required_fields = ["data_classification", "accessing_entity_id", "accessing_entity_type", "resource_id"]
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

    # Check data classification is allowed
    allowed_classifications = passport.get("limits", {}).get("data", {}).get("access", {}).get("allowed_classifications", [])
    if allowed_classifications and context.get("data_classification") not in allowed_classifications:
        return {
            "allow": False,
            "reasons": [{
                "code": "oap.classification_forbidden",
                "message": f"Data classification {context.get('data_classification')} is not allowed",
                "severity": "error"
            }]
        }

    # Check entity type is allowed for the data classification
    permissions = passport.get("limits", {}).get("data", {}).get("access", {}).get("permissions", {}).get(context.get("data_classification"), {})
    if permissions.get("allowed_entity_types") and context.get("accessing_entity_type") not in permissions["allowed_entity_types"]:
        return {
            "allow": False,
            "reasons": [{
                "code": "oap.entity_type_forbidden",
                "message": f"Entity type {context.get('accessing_entity_type')} is not allowed for {context.get('data_classification')} data",
                "severity": "error"
            }]
        }

    # Check jurisdiction is allowed
    allowed_jurisdictions = passport.get("limits", {}).get("data", {}).get("access", {}).get("allowed_jurisdictions", [])
    if context.get("jurisdiction") and allowed_jurisdictions and context.get("jurisdiction") not in allowed_jurisdictions:
        return {
            "allow": False,
            "reasons": [{
                "code": "oap.jurisdiction_blocked",
                "message": f"Jurisdiction {context.get('jurisdiction')} is not allowed",
                "severity": "error"
            }]
        }

    # Check row limit for exports
    max_rows_per_export = passport.get("limits", {}).get("data", {}).get("access", {}).get("max_rows_per_export")
    if context.get("row_count") and max_rows_per_export and context.get("row_count") > max_rows_per_export:
        return {
            "allow": False,
            "reasons": [{
                "code": "oap.row_limit_exceeded",
                "message": f"Row count {context.get('row_count')} exceeds maximum allowed {max_rows_per_export}",
                "severity": "error"
            }]
        }

    # Check data locality (destination jurisdiction)
    allowed_destination_jurisdictions = passport.get("limits", {}).get("data", {}).get("access", {}).get("allowed_destination_jurisdictions", [])
    if context.get("destination_jurisdiction") and allowed_destination_jurisdictions and context.get("destination_jurisdiction") not in allowed_destination_jurisdictions:
        return {
            "allow": False,
            "reasons": [{
                "code": "oap.jurisdiction_blocked",
                "message": f"Destination jurisdiction {context.get('destination_jurisdiction')} is not allowed",
                "severity": "error"
            }]
        }

    # Check balance inquiry limit
    balance_inquiry_cap = passport.get("limits", {}).get("data", {}).get("access", {}).get("balance_inquiry_cap_usd")
    if context.get("resource_attributes", {}).get("account_balance_usd") and balance_inquiry_cap and context.get("resource_attributes", {}).get("account_balance_usd") >= balance_inquiry_cap:
        return {
            "allow": False,
            "reasons": [{
                "code": "oap.balance_inquiry_forbidden",
                "message": f"Account balance {context.get('resource_attributes', {}).get('account_balance_usd')} exceeds inquiry cap {balance_inquiry_cap}",
                "severity": "error"
            }]
        }

    # Check action type is allowed
    if context.get("action_type") and permissions.get("allowed_actions") and context.get("action_type") not in permissions["allowed_actions"]:
        return {
            "allow": False,
            "reasons": [{
                "code": "oap.action_forbidden",
                "message": f"Action type {context.get('action_type')} is not allowed for {context.get('data_classification')} data",
                "severity": "error"
            }]
        }

    # If all checks pass, allow the data access
    return {
        "allow": True,
        "reasons": [{
            "code": "oap.allowed",
            "message": "Data access within limits and policy requirements",
            "severity": "info"
        }]
    }

def run_tests():
    """Run the test suite"""
    print("🧪 Running governance.data.access.v1 Policy Tests\n")

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
            result = evaluate_governance_data_access_v1(passport, test_case["context"])
            
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
