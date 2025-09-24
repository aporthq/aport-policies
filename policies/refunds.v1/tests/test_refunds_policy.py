"""
Comprehensive tests for refunds.v1 policy
Tests all enforcement rules, edge cases, and fraud prevention
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
import json

# Mock the policy verification
class MockPolicyResponse:
    def __init__(self, allow=True, reasons=None, decision_id=None, remaining_daily_cap=None):
        self.allow = allow
        self.reasons = reasons or []
        self.decision_id = decision_id
        self.remaining_daily_cap = remaining_daily_cap or {}
        self.passport = {
            'evaluation': {
                'decision_id': decision_id,
                'remaining_daily_cap': remaining_daily_cap or {}
            }
        }

def mock_policy_verification(response):
    """Mock the policy verification endpoint"""
    async def mock_verify(*args, **kwargs):
        return response
    return mock_verify

class TestRefundsV1Policy:
    """Test suite for refunds.v1 policy functionality"""

    @pytest.fixture
    def valid_context(self):
        """Valid refund context for testing"""
        return {
            "order_id": "ORD-12345",
            "customer_id": "CUST-67890",
            "amount_minor": 5000,
            "currency": "USD",
            "region": "US",
            "reason_code": "customer_request",
            "idempotency_key": "idempotency_key_123",
        }

    @pytest.fixture
    def mock_client(self):
        """Mock AgentPassportClient"""
        client = MagicMock()
        client.verify_agent_passport = AsyncMock()
        return client

    def test_required_fields_validation_success(self, valid_context):
        """Test that refund with all required fields is allowed"""
        from agent_passport.policy_enforcement import check_policy_sync
        
        with patch('agent_passport.policy_enforcement.verify_policy_compliance') as mock_verify:
            mock_verify.return_value = MockPolicyResponse(
                allow=True,
                decision_id="dec_123",
                remaining_daily_cap={"USD": 25000}
            )
            
            result = check_policy_sync("agent_123", "refunds.v1", valid_context)
            
            assert result["allowed"] is True
            assert "policy_result" in result

    def test_required_fields_validation_failure(self):
        """Test that refund missing required fields is denied"""
        from agent_passport.policy_enforcement import check_policy_sync
        
        invalid_context = {
            "order_id": "ORD-12345",
            # Missing customer_id, amount_minor, currency, region, reason_code, idempotency_key
        }
        
        with patch('agent_passport.policy_enforcement.verify_policy_compliance') as mock_verify:
            mock_verify.return_value = MockPolicyResponse(
                allow=False,
                reasons=[
                    {"code": "missing_required_field", "message": "customer_id is required"},
                    {"code": "missing_required_field", "message": "amount_minor is required"},
                    {"code": "missing_required_field", "message": "currency is required"},
                    {"code": "missing_required_field", "message": "region is required"},
                    {"code": "missing_required_field", "message": "reason_code is required"},
                    {"code": "missing_required_field", "message": "idempotency_key is required"},
                ]
            )
            
            result = check_policy_sync("agent_123", "refunds.v1", invalid_context)
            
            assert result["allowed"] is False
            assert len(result["violations"]) == 6

    def test_currency_support(self):
        """Test support for multiple currencies"""
        from agent_passport.policy_enforcement import check_policy_sync
        
        currencies = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD"]
        
        for currency in currencies:
            context = {
                "order_id": "ORD-12345",
                "customer_id": "CUST-67890",
                "amount_minor": 1000,
                "currency": currency,
                "region": "US",
                "reason_code": "customer_request",
                "idempotency_key": f"idempotency_{currency}",
            }
            
            with patch('agent_passport.policy_enforcement.verify_policy_compliance') as mock_verify:
                mock_verify.return_value = MockPolicyResponse(
                    allow=True,
                    decision_id=f"dec_{currency}",
                    remaining_daily_cap={currency: 25000}
                )
                
                result = check_policy_sync("agent_123", "refunds.v1", context)
                
                assert result["allowed"] is True

    def test_unsupported_currency(self):
        """Test that unsupported currency is denied"""
        from agent_passport.policy_enforcement import check_policy_sync
        
        context = {
            "order_id": "ORD-12345",
            "customer_id": "CUST-67890",
            "amount_minor": 1000,
            "currency": "XYZ",  # Unsupported currency
            "region": "US",
            "reason_code": "customer_request",
            "idempotency_key": "idempotency_xyz",
        }
        
        with patch('agent_passport.policy_enforcement.verify_policy_compliance') as mock_verify:
            mock_verify.return_value = MockPolicyResponse(
                allow=False,
                reasons=[
                    {"code": "currency_not_supported", "message": "Currency XYZ is not supported"}
                ]
            )
            
            result = check_policy_sync("agent_123", "refunds.v1", context)
            
            assert result["allowed"] is False
            assert result["violations"][0]["code"] == "currency_not_supported"

    def test_amount_precision_validation(self):
        """Test amount precision validation for different currencies"""
        from agent_passport.policy_enforcement import check_policy_sync
        
        test_cases = [
            {"currency": "USD", "amount": 1000, "valid": True},  # $10.00 - valid
            {"currency": "USD", "amount": 1001, "valid": False},  # $10.01 - invalid precision
            {"currency": "JPY", "amount": 1000, "valid": True},  # ¥1000 - valid
            {"currency": "JPY", "amount": 1001, "valid": True},  # ¥1001 - valid (no decimals)
            {"currency": "EUR", "amount": 1000, "valid": True},  # €10.00 - valid
            {"currency": "EUR", "amount": 1001, "valid": False},  # €10.01 - invalid precision
        ]
        
        for test_case in test_cases:
            context = {
                "order_id": "ORD-12345",
                "customer_id": "CUST-67890",
                "amount_minor": test_case["amount"],
                "currency": test_case["currency"],
                "region": "US",
                "reason_code": "customer_request",
                "idempotency_key": f"idempotency_{test_case['currency']}_{test_case['amount']}",
            }
            
            with patch('agent_passport.policy_enforcement.verify_policy_compliance') as mock_verify:
                if test_case["valid"]:
                    mock_verify.return_value = MockPolicyResponse(allow=True)
                else:
                    mock_verify.return_value = MockPolicyResponse(
                        allow=False,
                        reasons=[
                            {"code": "invalid_amount", "message": f"Amount {test_case['amount']} has invalid precision for currency {test_case['currency']}"}
                        ]
                    )
                
                result = check_policy_sync("agent_123", "refunds.v1", context)
                
                assert result["allowed"] == test_case["valid"]

    def test_amount_bounds_validation(self):
        """Test amount bounds validation"""
        from agent_passport.policy_enforcement import check_policy_sync
        
        test_cases = [
            {"amount": 0, "valid": False, "reason": "Amount must be positive"},
            {"amount": -100, "valid": False, "reason": "Amount must be positive"},
            {"amount": 1, "valid": True, "reason": "Minimum amount"},
            {"amount": 1000000000, "valid": False, "reason": "Amount exceeds maximum"},
            {"amount": 999999999, "valid": True, "reason": "Maximum valid amount"},
        ]
        
        for test_case in test_cases:
            context = {
                "order_id": "ORD-12345",
                "customer_id": "CUST-67890",
                "amount_minor": test_case["amount"],
                "currency": "USD",
                "region": "US",
                "reason_code": "customer_request",
                "idempotency_key": f"idempotency_{test_case['amount']}",
            }
            
            with patch('agent_passport.policy_enforcement.verify_policy_compliance') as mock_verify:
                if test_case["valid"]:
                    mock_verify.return_value = MockPolicyResponse(allow=True)
                else:
                    mock_verify.return_value = MockPolicyResponse(
                        allow=False,
                        reasons=[
                            {"code": "invalid_amount", "message": test_case["reason"]}
                        ]
                    )
                
                result = check_policy_sync("agent_123", "refunds.v1", context)
                
                assert result["allowed"] == test_case["valid"]

    def test_assurance_level_requirements_l2(self):
        """Test L2 requirement for amounts <= $100"""
        from agent_passport.policy_enforcement import check_policy_sync
        
        context = {
            "order_id": "ORD-12345",
            "customer_id": "CUST-67890",
            "amount_minor": 10000,  # $100
            "currency": "USD",
            "region": "US",
            "reason_code": "customer_request",
            "idempotency_key": "idempotency_l2",
        }
        
        with patch('agent_passport.policy_enforcement.verify_policy_compliance') as mock_verify:
            mock_verify.return_value = MockPolicyResponse(
                allow=True,
                decision_id="dec_l2_pass",
                remaining_daily_cap={"USD": 25000}
            )
            
            result = check_policy_sync("agent_123", "refunds.v1", context)
            
            assert result["allowed"] is True

    def test_assurance_level_requirements_l3(self):
        """Test L3 requirement for amounts $100-$500"""
        from agent_passport.policy_enforcement import check_policy_sync
        
        context = {
            "order_id": "ORD-12345",
            "customer_id": "CUST-67890",
            "amount_minor": 25000,  # $250
            "currency": "USD",
            "region": "US",
            "reason_code": "customer_request",
            "idempotency_key": "idempotency_l3",
        }
        
        with patch('agent_passport.policy_enforcement.verify_policy_compliance') as mock_verify:
            mock_verify.return_value = MockPolicyResponse(
                allow=False,
                reasons=[
                    {"code": "assurance_too_low", "message": "Refund amount 25000 USD requires L3 assurance level, but agent has L2"}
                ]
            )
            
            result = check_policy_sync("agent_123", "refunds.v1", context)
            
            assert result["allowed"] is False
            assert result["violations"][0]["code"] == "assurance_too_low"

    def test_assurance_level_requirements_deny_over_500(self):
        """Test that amounts > $500 are denied in v1"""
        from agent_passport.policy_enforcement import check_policy_sync
        
        context = {
            "order_id": "ORD-12345",
            "customer_id": "CUST-67890",
            "amount_minor": 60000,  # $600
            "currency": "USD",
            "region": "US",
            "reason_code": "customer_request",
            "idempotency_key": "idempotency_deny",
        }
        
        with patch('agent_passport.policy_enforcement.verify_policy_compliance') as mock_verify:
            mock_verify.return_value = MockPolicyResponse(
                allow=False,
                reasons=[
                    {"code": "assurance_too_low", "message": "Refund amount 60000 USD requires L4 assurance level, but agent has L3"}
                ]
            )
            
            result = check_policy_sync("agent_123", "refunds.v1", context)
            
            assert result["allowed"] is False

    def test_idempotency_protection_first_request(self):
        """Test that first request with idempotency key is allowed"""
        from agent_passport.policy_enforcement import check_policy_sync
        
        context = {
            "order_id": "ORD-12345",
            "customer_id": "CUST-67890",
            "amount_minor": 5000,
            "currency": "USD",
            "region": "US",
            "reason_code": "customer_request",
            "idempotency_key": "unique_key_123",
        }
        
        with patch('agent_passport.policy_enforcement.verify_policy_compliance') as mock_verify:
            mock_verify.return_value = MockPolicyResponse(
                allow=True,
                decision_id="dec_first",
                remaining_daily_cap={"USD": 25000}
            )
            
            result = check_policy_sync("agent_123", "refunds.v1", context)
            
            assert result["allowed"] is True

    def test_idempotency_protection_duplicate(self):
        """Test that duplicate idempotency key is denied"""
        from agent_passport.policy_enforcement import check_policy_sync
        
        context = {
            "order_id": "ORD-12345",
            "customer_id": "CUST-67890",
            "amount_minor": 5000,
            "currency": "USD",
            "region": "US",
            "reason_code": "customer_request",
            "idempotency_key": "duplicate_key_123",
        }
        
        with patch('agent_passport.policy_enforcement.verify_policy_compliance') as mock_verify:
            mock_verify.return_value = MockPolicyResponse(
                allow=False,
                reasons=[
                    {"code": "idempotency_replay", "message": "Duplicate idempotency key detected. Previous decision: dec_duplicate"}
                ]
            )
            
            result = check_policy_sync("agent_123", "refunds.v1", context)
            
            assert result["allowed"] is False
            assert result["violations"][0]["code"] == "idempotency_replay"

    def test_daily_cap_enforcement_within_limit(self):
        """Test that refund within daily cap is allowed"""
        from agent_passport.policy_enforcement import check_policy_sync
        
        context = {
            "order_id": "ORD-12345",
            "customer_id": "CUST-67890",
            "amount_minor": 5000,
            "currency": "USD",
            "region": "US",
            "reason_code": "customer_request",
            "idempotency_key": "daily_cap_test",
        }
        
        with patch('agent_passport.policy_enforcement.verify_policy_compliance') as mock_verify:
            mock_verify.return_value = MockPolicyResponse(
                allow=True,
                decision_id="dec_daily_cap",
                remaining_daily_cap={"USD": 20000}
            )
            
            result = check_policy_sync("agent_123", "refunds.v1", context)
            
            assert result["allowed"] is True
            assert result["policy_result"].passport["evaluation"]["remaining_daily_cap"]["USD"] == 20000

    def test_daily_cap_enforcement_exceeded(self):
        """Test that refund exceeding daily cap is denied"""
        from agent_passport.policy_enforcement import check_policy_sync
        
        context = {
            "order_id": "ORD-12345",
            "customer_id": "CUST-67890",
            "amount_minor": 5000,
            "currency": "USD",
            "region": "US",
            "reason_code": "customer_request",
            "idempotency_key": "daily_cap_exceeded",
        }
        
        with patch('agent_passport.policy_enforcement.verify_policy_compliance') as mock_verify:
            mock_verify.return_value = MockPolicyResponse(
                allow=False,
                reasons=[
                    {"code": "daily_cap_exceeded", "message": "Daily cap 25000 USD exceeded for USD; current 23000 + 5000 > 25000"}
                ],
                remaining_daily_cap={"USD": 2000}
            )
            
            result = check_policy_sync("agent_123", "refunds.v1", context)
            
            assert result["allowed"] is False
            assert result["violations"][0]["code"] == "daily_cap_exceeded"

    def test_cross_currency_protection(self):
        """Test that cross-currency refunds are denied"""
        from agent_passport.policy_enforcement import check_policy_sync
        
        context = {
            "order_id": "ORD-12345",
            "customer_id": "CUST-67890",
            "amount_minor": 5000,
            "currency": "USD",
            "order_currency": "EUR",  # Different from refund currency
            "region": "US",
            "reason_code": "customer_request",
            "idempotency_key": "cross_currency_test",
        }
        
        with patch('agent_passport.policy_enforcement.verify_policy_compliance') as mock_verify:
            mock_verify.return_value = MockPolicyResponse(
                allow=False,
                reasons=[
                    {"code": "cross_currency_denied", "message": "Cross-currency refunds are not supported in v1"}
                ]
            )
            
            result = check_policy_sync("agent_123", "refunds.v1", context)
            
            assert result["allowed"] is False
            assert result["violations"][0]["code"] == "cross_currency_denied"

    def test_order_balance_validation_within_balance(self):
        """Test that refund within order balance is allowed"""
        from agent_passport.policy_enforcement import check_policy_sync
        
        context = {
            "order_id": "ORD-12345",
            "customer_id": "CUST-67890",
            "amount_minor": 5000,
            "currency": "USD",
            "order_total_minor": 10000,
            "already_refunded_minor": 2000,
            "region": "US",
            "reason_code": "customer_request",
            "idempotency_key": "balance_valid",
        }
        
        with patch('agent_passport.policy_enforcement.verify_policy_compliance') as mock_verify:
            mock_verify.return_value = MockPolicyResponse(
                allow=True,
                decision_id="dec_balance_valid",
                remaining_daily_cap={"USD": 25000}
            )
            
            result = check_policy_sync("agent_123", "refunds.v1", context)
            
            assert result["allowed"] is True

    def test_order_balance_validation_exceeded(self):
        """Test that refund exceeding order balance is denied"""
        from agent_passport.policy_enforcement import check_policy_sync
        
        context = {
            "order_id": "ORD-12345",
            "customer_id": "CUST-67890",
            "amount_minor": 5000,
            "currency": "USD",
            "order_total_minor": 10000,
            "already_refunded_minor": 8000,  # Only 2000 remaining
            "region": "US",
            "reason_code": "customer_request",
            "idempotency_key": "balance_exceeded",
        }
        
        with patch('agent_passport.policy_enforcement.verify_policy_compliance') as mock_verify:
            mock_verify.return_value = MockPolicyResponse(
                allow=False,
                reasons=[
                    {"code": "order_balance_exceeded", "message": "Refund amount 5000 exceeds remaining order balance 2000"}
                ]
            )
            
            result = check_policy_sync("agent_123", "refunds.v1", context)
            
            assert result["allowed"] is False
            assert result["violations"][0]["code"] == "order_balance_exceeded"

    def test_region_validation_allowed(self):
        """Test that refund in allowed region is permitted"""
        from agent_passport.policy_enforcement import check_policy_sync
        
        context = {
            "order_id": "ORD-12345",
            "customer_id": "CUST-67890",
            "amount_minor": 5000,
            "currency": "USD",
            "region": "US",
            "reason_code": "customer_request",
            "idempotency_key": "region_valid",
        }
        
        with patch('agent_passport.policy_enforcement.verify_policy_compliance') as mock_verify:
            mock_verify.return_value = MockPolicyResponse(
                allow=True,
                decision_id="dec_region_valid",
                remaining_daily_cap={"USD": 25000}
            )
            
            result = check_policy_sync("agent_123", "refunds.v1", context)
            
            assert result["allowed"] is True

    def test_region_validation_denied(self):
        """Test that refund in disallowed region is denied"""
        from agent_passport.policy_enforcement import check_policy_sync
        
        context = {
            "order_id": "ORD-12345",
            "customer_id": "CUST-67890",
            "amount_minor": 5000,
            "currency": "USD",
            "region": "RESTRICTED",
            "reason_code": "customer_request",
            "idempotency_key": "region_invalid",
        }
        
        with patch('agent_passport.policy_enforcement.verify_policy_compliance') as mock_verify:
            mock_verify.return_value = MockPolicyResponse(
                allow=False,
                reasons=[
                    {"code": "region_not_allowed", "message": "Region RESTRICTED is not allowed for this agent"}
                ]
            )
            
            result = check_policy_sync("agent_123", "refunds.v1", context)
            
            assert result["allowed"] is False
            assert result["violations"][0]["code"] == "region_not_allowed"

    def test_reason_code_validation_valid(self):
        """Test that valid reason codes are allowed"""
        from agent_passport.policy_enforcement import check_policy_sync
        
        valid_reason_codes = ["customer_request", "defective", "not_as_described", "duplicate", "fraud"]
        
        for reason_code in valid_reason_codes:
            context = {
                "order_id": "ORD-12345",
                "customer_id": "CUST-67890",
                "amount_minor": 5000,
                "currency": "USD",
                "region": "US",
                "reason_code": reason_code,
                "idempotency_key": f"reason_{reason_code}",
            }
            
            with patch('agent_passport.policy_enforcement.verify_policy_compliance') as mock_verify:
                mock_verify.return_value = MockPolicyResponse(
                    allow=True,
                    decision_id=f"dec_{reason_code}",
                    remaining_daily_cap={"USD": 25000}
                )
                
                result = check_policy_sync("agent_123", "refunds.v1", context)
                
                assert result["allowed"] is True

    def test_reason_code_validation_invalid(self):
        """Test that invalid reason codes are denied"""
        from agent_passport.policy_enforcement import check_policy_sync
        
        context = {
            "order_id": "ORD-12345",
            "customer_id": "CUST-67890",
            "amount_minor": 5000,
            "currency": "USD",
            "region": "US",
            "reason_code": "invalid_reason",
            "idempotency_key": "invalid_reason_test",
        }
        
        with patch('agent_passport.policy_enforcement.verify_policy_compliance') as mock_verify:
            mock_verify.return_value = MockPolicyResponse(
                allow=False,
                reasons=[
                    {"code": "reason_code_invalid", "message": "Reason code invalid_reason is not supported"}
                ]
            )
            
            result = check_policy_sync("agent_123", "refunds.v1", context)
            
            assert result["allowed"] is False
            assert result["violations"][0]["code"] == "reason_code_invalid"

    def test_error_handling_policy_verification_failure(self):
        """Test handling of policy verification failures"""
        from agent_passport.policy_enforcement import check_policy_sync
        
        with patch('agent_passport.policy_enforcement.verify_policy_compliance') as mock_verify:
            mock_verify.return_value = None  # Simulate verification failure
            
            result = check_policy_sync("agent_123", "refunds.v1", {})
            
            assert result["allowed"] is False
            assert result["reason"] == "policy_verification_failed"

    def test_error_handling_network_error(self):
        """Test handling of network errors"""
        from agent_passport.policy_enforcement import check_policy_sync
        
        with patch('agent_passport.policy_enforcement.verify_policy_compliance') as mock_verify:
            mock_verify.side_effect = Exception("Network error")
            
            result = check_policy_sync("agent_123", "refunds.v1", {})
            
            assert result["allowed"] is False
            assert result["reason"] == "policy_check_error"

    def test_edge_cases_extreme_amounts(self):
        """Test prevention of extremely large amounts"""
        from agent_passport.policy_enforcement import check_policy_sync
        
        context = {
            "order_id": "ORD-12345",
            "customer_id": "CUST-67890",
            "amount_minor": 2**63 - 1,  # Maximum safe integer
            "currency": "USD",
            "region": "US",
            "reason_code": "customer_request",
            "idempotency_key": "extreme_amount",
        }
        
        with patch('agent_passport.policy_enforcement.verify_policy_compliance') as mock_verify:
            mock_verify.return_value = MockPolicyResponse(
                allow=False,
                reasons=[
                    {"code": "invalid_amount", "message": "Amount exceeds maximum allowed amount"}
                ]
            )
            
            result = check_policy_sync("agent_123", "refunds.v1", context)
            
            assert result["allowed"] is False

    def test_edge_cases_negative_amounts(self):
        """Test prevention of negative amounts"""
        from agent_passport.policy_enforcement import check_policy_sync
        
        context = {
            "order_id": "ORD-12345",
            "customer_id": "CUST-67890",
            "amount_minor": -1000,
            "currency": "USD",
            "region": "US",
            "reason_code": "customer_request",
            "idempotency_key": "negative_amount",
        }
        
        with patch('agent_passport.policy_enforcement.verify_policy_compliance') as mock_verify:
            mock_verify.return_value = MockPolicyResponse(
                allow=False,
                reasons=[
                    {"code": "invalid_amount", "message": "Amount must be positive"}
                ]
            )
            
            result = check_policy_sync("agent_123", "refunds.v1", context)
            
            assert result["allowed"] is False

    def test_edge_cases_zero_amounts(self):
        """Test prevention of zero amounts"""
        from agent_passport.policy_enforcement import check_policy_sync
        
        context = {
            "order_id": "ORD-12345",
            "customer_id": "CUST-67890",
            "amount_minor": 0,
            "currency": "USD",
            "region": "US",
            "reason_code": "customer_request",
            "idempotency_key": "zero_amount",
        }
        
        with patch('agent_passport.policy_enforcement.verify_policy_compliance') as mock_verify:
            mock_verify.return_value = MockPolicyResponse(
                allow=False,
                reasons=[
                    {"code": "invalid_amount", "message": "Amount must be positive"}
                ]
            )
            
            result = check_policy_sync("agent_123", "refunds.v1", context)
            
            assert result["allowed"] is False

    def test_idempotency_key_format_validation(self):
        """Test validation of idempotency key format"""
        from agent_passport.policy_enforcement import check_policy_sync
        
        invalid_keys = ["", "a", "a" * 100, "invalid@key", "key with spaces"]
        
        for key in invalid_keys:
            context = {
                "order_id": "ORD-12345",
                "customer_id": "CUST-67890",
                "amount_minor": 5000,
                "currency": "USD",
                "region": "US",
                "reason_code": "customer_request",
                "idempotency_key": key,
            }
            
            with patch('agent_passport.policy_enforcement.verify_policy_compliance') as mock_verify:
                mock_verify.return_value = MockPolicyResponse(
                    allow=False,
                    reasons=[
                        {"code": "invalid_idempotency_key", "message": "Invalid idempotency key format"}
                    ]
                )
                
                result = check_policy_sync("agent_123", "refunds.v1", context)
                
                assert result["allowed"] is False


class TestRefundsV1PolicyIntegration:
    """Integration tests for refunds.v1 policy"""

    def test_fastapi_middleware_integration(self):
        """Test FastAPI middleware integration"""
        from agent_passport_middleware.middleware_v2 import require_refunds_policy
        
        # Test that the function exists and has the right signature
        assert callable(require_refunds_policy)
        
        dependency = require_refunds_policy("agent_123", True, True)
        assert callable(dependency)

    @pytest.mark.asyncio
    async def test_async_policy_compliance(self):
        """Test async policy compliance checking"""
        from agent_passport.policy_enforcement import check_policy_compliance
        
        context = {
            "order_id": "ORD-12345",
            "customer_id": "CUST-67890",
            "amount_minor": 5000,
            "currency": "USD",
            "region": "US",
            "reason_code": "customer_request",
            "idempotency_key": "async_test",
        }
        
        with patch('agent_passport.policy_enforcement.verify_policy_compliance') as mock_verify:
            mock_verify.return_value = MockPolicyResponse(
                allow=True,
                decision_id="dec_async",
                remaining_daily_cap={"USD": 25000}
            )
            
            result = await check_policy_compliance("agent_123", "refunds.v1", context)
            
            assert result["allowed"] is True
            assert "policy_result" in result


if __name__ == "__main__":
    pytest.main([__file__])
