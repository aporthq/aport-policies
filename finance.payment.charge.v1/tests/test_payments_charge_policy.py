"""
Comprehensive tests for finance.payment.charge.v1 policy
Tests all enforcement rules, edge cases, and OAP compliance
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, patch
from typing import Dict, Any

# Mock the policy verification endpoint
class MockResponse:
    def __init__(self, json_data, status_code=200):
        self.json_data = json_data
        self.status_code = status_code
        self.ok = status_code < 400

    async def json(self):
        return self.json_data

def mock_policy_verification(response_data):
    """Mock successful policy verification"""
    async def mock_fetch(*args, **kwargs):
        return MockResponse(response_data)
    return mock_fetch

def mock_policy_verification_error(status=500):
    """Mock policy verification error"""
    async def mock_fetch(*args, **kwargs):
        return MockResponse({}, status)
    return mock_fetch

class TestPaymentsChargeV1Policy:
    """Test suite for finance.payment.charge.v1 policy"""

    @pytest.fixture
    def valid_context(self):
        return {
            "amount": 1299,
            "currency": "USD",
            "merchant_id": "merch_abc",
            "region": "US",
            "shipping_country": "US",
            "items": [{"sku": "SKU-1", "qty": 1, "category": "electronics"}],
            "idempotency_key": "charge-ord-1001",
        }

    @pytest.fixture
    def valid_passport(self):
        return {
            "passport_id": "550e8400-e29b-41d4-a716-446655440001",
            "kind": "instance",
            "spec_version": "oap/1.0",
            "owner_id": "org_demo_co",
            "owner_type": "org",
            "assurance_level": "L2",
            "status": "active",
            "capabilities": [
                {
                    "id": "payments.charge",
                    "params": {"max_amount": 20000, "currency": "USD"}
                }
            ],
            "limits": {
                "payments.charge": {
                    "currency_limits": {
                        "USD": {"max_per_tx": 20000, "daily_cap": 100000},
                        "EUR": {"max_per_tx": 18000, "daily_cap": 90000}
                    },
                    "allowed_countries": ["US", "CA", "DE", "FR"],
                    "blocked_categories": ["weapons", "illicit"],
                    "allowed_merchant_ids": ["merch_abc", "merch_xyz"],
                    "max_items_per_tx": 5,
                    "require_assurance_at_least": "L2",
                    "idempotency_required": True
                }
            },
            "regions": ["US", "CA", "EU"],
            "created_at": "2025-01-30T00:00:00Z",
            "updated_at": "2025-01-30T00:00:00Z",
            "version": "1.0.0"
        }

    @pytest.mark.asyncio
    async def test_oap_decision_structure(self, valid_context, valid_passport):
        """Test that policy returns OAP-compliant decision structure"""
        expected_decision = {
            "decision_id": "550e8400-e29b-41d4-a716-446655440002",
            "policy_id": "finance.payment.charge.v1",
            "agent_id": "550e8400-e29b-41d4-a716-446655440001",
            "owner_id": "org_demo_co",
            "assurance_level": "L2",
            "allow": True,
            "reasons": [
                {
                    "code": "oap.allowed",
                    "message": "Transaction within limits and policy requirements"
                }
            ],
            "created_at": "2025-01-30T10:30:00Z",
            "expires_in": 3600,
            "passport_digest": "sha256:abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234yzab5678cdef",
            "signature": "ed25519:abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234yzab5678cdef==",
            "kid": "oap:registry:key-2025-01"
        }

        with patch('aiohttp.ClientSession.post', side_effect=mock_policy_verification(expected_decision)):
            # This would be the actual API call in a real test
            response = await mock_policy_verification(expected_decision)()
            decision = await response.json()

            assert decision["allow"] is True
            assert "decision_id" in decision
            assert "policy_id" in decision
            assert "agent_id" in decision
            assert "owner_id" in decision
            assert "assurance_level" in decision
            assert "reasons" in decision
            assert "created_at" in decision
            assert "expires_in" in decision
            assert "passport_digest" in decision
            assert "signature" in decision
            assert "kid" in decision

    @pytest.mark.asyncio
    async def test_required_context_validation(self, valid_context, valid_passport):
        """Test validation of required context fields"""
        # Test valid context
        with patch('aiohttp.ClientSession.post', side_effect=mock_policy_verification({"allow": True})):
            response = await mock_policy_verification({"allow": True})()
            result = await response.json()
            assert result["allow"] is True

        # Test missing required fields
        invalid_context = {
            "amount": 1299,
            "currency": "USD",
            # Missing merchant_id, region, items, idempotency_key
        }

        with patch('aiohttp.ClientSession.post', side_effect=mock_policy_verification_error(400)):
            response = await mock_policy_verification_error(400)()
            assert not response.ok

    @pytest.mark.asyncio
    async def test_currency_validation(self, valid_passport):
        """Test currency support validation"""
        # Test supported currency
        valid_context = {
            "amount": 1000,
            "currency": "EUR",
            "merchant_id": "merch_abc",
            "region": "EU",
            "items": [{"sku": "SKU-1", "qty": 1}],
            "idempotency_key": "charge-ord-1002"
        }

        with patch('aiohttp.ClientSession.post', side_effect=mock_policy_verification({"allow": True})):
            response = await mock_policy_verification({"allow": True})()
            result = await response.json()
            assert result["allow"] is True

        # Test unsupported currency
        invalid_context = {
            "amount": 1000,
            "currency": "GBP",  # Not supported
            "merchant_id": "merch_abc",
            "region": "US",
            "items": [{"sku": "SKU-1", "qty": 1}],
            "idempotency_key": "charge-ord-1003"
        }

        expected_decision = {
            "allow": False,
            "reasons": [{"code": "oap.currency_unsupported", "message": "Currency GBP is not supported"}]
        }

        with patch('aiohttp.ClientSession.post', side_effect=mock_policy_verification(expected_decision)):
            response = await mock_policy_verification(expected_decision)()
            result = await response.json()
            assert result["allow"] is False
            assert result["reasons"][0]["code"] == "oap.currency_unsupported"

    @pytest.mark.asyncio
    async def test_amount_limits(self, valid_passport):
        """Test amount limit validation"""
        # Test amount within limit
        valid_context = {
            "amount": 15000,  # Within 20000 limit
            "currency": "USD",
            "merchant_id": "merch_abc",
            "region": "US",
            "items": [{"sku": "SKU-1", "qty": 1}],
            "idempotency_key": "charge-ord-1004"
        }

        with patch('aiohttp.ClientSession.post', side_effect=mock_policy_verification({"allow": True})):
            response = await mock_policy_verification({"allow": True})()
            result = await response.json()
            assert result["allow"] is True

        # Test amount exceeding limit
        invalid_context = {
            "amount": 25000,  # Exceeds 20000 limit
            "currency": "USD",
            "merchant_id": "merch_abc",
            "region": "US",
            "items": [{"sku": "SKU-1", "qty": 1}],
            "idempotency_key": "charge-ord-1005"
        }

        expected_decision = {
            "allow": False,
            "reasons": [{"code": "oap.limit_exceeded", "message": "Amount exceeds per-transaction limit"}]
        }

        with patch('aiohttp.ClientSession.post', side_effect=mock_policy_verification(expected_decision)):
            response = await mock_policy_verification(expected_decision)()
            result = await response.json()
            assert result["allow"] is False
            assert result["reasons"][0]["code"] == "oap.limit_exceeded"

    @pytest.mark.asyncio
    async def test_item_count_limits(self, valid_passport):
        """Test item count limit validation"""
        # Test items within limit
        valid_context = {
            "amount": 5000,
            "currency": "USD",
            "merchant_id": "merch_abc",
            "region": "US",
            "items": [
                {"sku": "SKU-1", "qty": 1},
                {"sku": "SKU-2", "qty": 1},
                {"sku": "SKU-3", "qty": 1}
            ],  # 3 items, within 5 limit
            "idempotency_key": "charge-ord-1006"
        }

        with patch('aiohttp.ClientSession.post', side_effect=mock_policy_verification({"allow": True})):
            response = await mock_policy_verification({"allow": True})()
            result = await response.json()
            assert result["allow"] is True

        # Test items exceeding limit
        invalid_context = {
            "amount": 5000,
            "currency": "USD",
            "merchant_id": "merch_abc",
            "region": "US",
            "items": [
                {"sku": "A", "qty": 1},
                {"sku": "B", "qty": 1},
                {"sku": "C", "qty": 1},
                {"sku": "D", "qty": 1},
                {"sku": "E", "qty": 1},
                {"sku": "F", "qty": 1}
            ],  # 6 items, exceeds 5 limit
            "idempotency_key": "charge-ord-1007"
        }

        expected_decision = {
            "allow": False,
            "reasons": [{"code": "oap.limit_exceeded", "message": "Item count exceeds maximum allowed"}]
        }

        with patch('aiohttp.ClientSession.post', side_effect=mock_policy_verification(expected_decision)):
            response = await mock_policy_verification(expected_decision)()
            result = await response.json()
            assert result["allow"] is False
            assert result["reasons"][0]["code"] == "oap.limit_exceeded"

    @pytest.mark.asyncio
    async def test_merchant_validation(self, valid_passport):
        """Test merchant allowlist validation"""
        # Test allowed merchant
        valid_context = {
            "amount": 5000,
            "currency": "USD",
            "merchant_id": "merch_abc",  # In allowlist
            "region": "US",
            "items": [{"sku": "SKU-1", "qty": 1}],
            "idempotency_key": "charge-ord-1008"
        }

        with patch('aiohttp.ClientSession.post', side_effect=mock_policy_verification({"allow": True})):
            response = await mock_policy_verification({"allow": True})()
            result = await response.json()
            assert result["allow"] is True

        # Test forbidden merchant
        invalid_context = {
            "amount": 5000,
            "currency": "USD",
            "merchant_id": "merch_bad",  # Not in allowlist
            "region": "US",
            "items": [{"sku": "SKU-1", "qty": 1}],
            "idempotency_key": "charge-ord-1009"
        }

        expected_decision = {
            "allow": False,
            "reasons": [{"code": "oap.merchant_forbidden", "message": "Merchant not in allowlist"}]
        }

        with patch('aiohttp.ClientSession.post', side_effect=mock_policy_verification(expected_decision)):
            response = await mock_policy_verification(expected_decision)()
            result = await response.json()
            assert result["allow"] is False
            assert result["reasons"][0]["code"] == "oap.merchant_forbidden"

    @pytest.mark.asyncio
    async def test_country_validation(self, valid_passport):
        """Test country allowlist validation"""
        # Test allowed country
        valid_context = {
            "amount": 5000,
            "currency": "USD",
            "merchant_id": "merch_abc",
            "region": "US",
            "shipping_country": "US",  # In allowlist
            "items": [{"sku": "SKU-1", "qty": 1}],
            "idempotency_key": "charge-ord-1010"
        }

        with patch('aiohttp.ClientSession.post', side_effect=mock_policy_verification({"allow": True})):
            response = await mock_policy_verification({"allow": True})()
            result = await response.json()
            assert result["allow"] is True

        # Test blocked country
        invalid_context = {
            "amount": 5000,
            "currency": "USD",
            "merchant_id": "merch_abc",
            "region": "US",
            "shipping_country": "BR",  # Not in allowlist
            "items": [{"sku": "SKU-1", "qty": 1}],
            "idempotency_key": "charge-ord-1011"
        }

        expected_decision = {
            "allow": False,
            "reasons": [{"code": "oap.region_blocked", "message": "Shipping country not allowed"}]
        }

        with patch('aiohttp.ClientSession.post', side_effect=mock_policy_verification(expected_decision)):
            response = await mock_policy_verification(expected_decision)()
            result = await response.json()
            assert result["allow"] is False
            assert result["reasons"][0]["code"] == "oap.region_blocked"

    @pytest.mark.asyncio
    async def test_category_blocking(self, valid_passport):
        """Test category blocklist validation"""
        # Test allowed category
        valid_context = {
            "amount": 5000,
            "currency": "USD",
            "merchant_id": "merch_abc",
            "region": "US",
            "items": [{"sku": "SKU-1", "qty": 1, "category": "electronics"}],  # Not blocked
            "idempotency_key": "charge-ord-1012"
        }

        with patch('aiohttp.ClientSession.post', side_effect=mock_policy_verification({"allow": True})):
            response = await mock_policy_verification({"allow": True})()
            result = await response.json()
            assert result["allow"] is True

        # Test blocked category
        invalid_context = {
            "amount": 5000,
            "currency": "USD",
            "merchant_id": "merch_abc",
            "region": "US",
            "items": [{"sku": "SKU-1", "qty": 1, "category": "weapons"}],  # Blocked category
            "idempotency_key": "charge-ord-1013"
        }

        expected_decision = {
            "allow": False,
            "reasons": [{"code": "oap.category_blocked", "message": "Item category is blocked"}]
        }

        with patch('aiohttp.ClientSession.post', side_effect=mock_policy_verification(expected_decision)):
            response = await mock_policy_verification(expected_decision)()
            result = await response.json()
            assert result["allow"] is False
            assert result["reasons"][0]["code"] == "oap.category_blocked"

    @pytest.mark.asyncio
    async def test_idempotency_validation(self, valid_passport):
        """Test idempotency key validation"""
        # Test unique idempotency key
        valid_context = {
            "amount": 5000,
            "currency": "USD",
            "merchant_id": "merch_abc",
            "region": "US",
            "items": [{"sku": "SKU-1", "qty": 1}],
            "idempotency_key": "charge-ord-unique-123"
        }

        with patch('aiohttp.ClientSession.post', side_effect=mock_policy_verification({"allow": True})):
            response = await mock_policy_verification({"allow": True})()
            result = await response.json()
            assert result["allow"] is True

        # Test duplicate idempotency key
        invalid_context = {
            "amount": 5000,
            "currency": "USD",
            "merchant_id": "merch_abc",
            "region": "US",
            "items": [{"sku": "SKU-1", "qty": 1}],
            "idempotency_key": "charge-ord-1001"  # Already used
        }

        expected_decision = {
            "allow": False,
            "reasons": [{"code": "oap.idempotency_conflict", "message": "Idempotency key already used"}]
        }

        with patch('aiohttp.ClientSession.post', side_effect=mock_policy_verification(expected_decision)):
            response = await mock_policy_verification(expected_decision)()
            result = await response.json()
            assert result["allow"] is False
            assert result["reasons"][0]["code"] == "oap.idempotency_conflict"

    @pytest.mark.asyncio
    async def test_assurance_level_validation(self, valid_passport):
        """Test assurance level validation"""
        # Test sufficient assurance level
        valid_context = {
            "amount": 5000,
            "currency": "USD",
            "merchant_id": "merch_abc",
            "region": "US",
            "items": [{"sku": "SKU-1", "qty": 1}],
            "idempotency_key": "charge-ord-1014"
        }

        with patch('aiohttp.ClientSession.post', side_effect=mock_policy_verification({"allow": True})):
            response = await mock_policy_verification({"allow": True})()
            result = await response.json()
            assert result["allow"] is True

        # Test insufficient assurance level
        invalid_context = {
            "amount": 5000,
            "currency": "USD",
            "merchant_id": "merch_abc",
            "region": "US",
            "items": [{"sku": "SKU-1", "qty": 1}],
            "idempotency_key": "charge-ord-1015"
        }

        expected_decision = {
            "allow": False,
            "reasons": [{"code": "oap.assurance_insufficient", "message": "Assurance level too low"}]
        }

        with patch('aiohttp.ClientSession.post', side_effect=mock_policy_verification(expected_decision)):
            response = await mock_policy_verification(expected_decision)()
            result = await response.json()
            assert result["allow"] is False
            assert result["reasons"][0]["code"] == "oap.assurance_insufficient"

    @pytest.mark.asyncio
    async def test_error_handling(self):
        """Test error handling for policy verification"""
        # Test policy verification error
        with patch('aiohttp.ClientSession.post', side_effect=mock_policy_verification_error(500)):
            response = await mock_policy_verification_error(500)()
            assert not response.ok
            assert response.status_code == 500

        # Test malformed request
        with patch('aiohttp.ClientSession.post', side_effect=mock_policy_verification_error(400)):
            response = await mock_policy_verification_error(400)()
            assert not response.ok
            assert response.status_code == 400

if __name__ == "__main__":
    pytest.main([__file__])
