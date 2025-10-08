from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from aport.middleware import require_policy
import asyncio
from typing import List, Optional
from datetime import datetime

app = FastAPI(title="Payment Charge Service", version="1.0.0")

class ChargeItem(BaseModel):
    sku: str
    qty: int
    category: Optional[str] = None

class ChargeRequest(BaseModel):
    amount: int
    currency: str
    merchant_id: str
    region: str
    shipping_country: Optional[str] = None
    items: List[ChargeItem]
    risk_score: Optional[float] = None
    idempotency_key: str

class BatchChargeRequest(BaseModel):
    charges: List[ChargeRequest]

class RefundRequest(BaseModel):
    amount: int
    reason: str

class ChargeResponse(BaseModel):
    success: bool
    charge_id: str
    amount: int
    currency: str
    status: str
    decision_id: str

class ChargeStatus(BaseModel):
    charge_id: str
    status: str
    created_at: str
    amount: int
    currency: str
    merchant_id: str
    items: List[ChargeItem]

@app.post("/payments/charge")
@require_policy("finance.payment.charge.v1")
async def process_charge(request: Request, charge_data: ChargeRequest):
    try:
        passport = request.state.policy_result.passport
        
        # Additional business logic validation
        if charge_data.amount <= 0:
            raise HTTPException(status_code=400, detail="Invalid charge amount")
        
        # Check if items are provided
        if not charge_data.items or len(charge_data.items) == 0:
            raise HTTPException(status_code=400, detail="Items are required")
        
        # Process charge using your payment processor
        charge_id = await process_charge_payment({
            "amount": charge_data.amount,
            "currency": charge_data.currency,
            "merchant_id": charge_data.merchant_id,
            "region": charge_data.region,
            "shipping_country": charge_data.shipping_country,
            "items": [item.dict() for item in charge_data.items],
            "risk_score": charge_data.risk_score,
            "idempotency_key": charge_data.idempotency_key,
            "agent_id": passport.passport_id,
            "agent_name": passport.metadata.get("template_name", "Unknown Agent") if passport.metadata else "Unknown Agent"
        })
        
        # Log the transaction
        print(f"Charge processed: {charge_id} for {charge_data.amount} {charge_data.currency} by agent {passport.passport_id}")
        
        return ChargeResponse(
            success=True,
            charge_id=charge_id,
            amount=charge_data.amount,
            currency=charge_data.currency,
            status="processed",
            decision_id=request.state.policy_result.decision_id
        )
        
    except Exception as e:
        print(f"Charge processing error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/payments/charge/batch")
@require_policy("finance.payment.charge.v1")
async def process_batch_charges(request: Request, batch_data: BatchChargeRequest):
    try:
        passport = request.state.policy_result.passport
        
        # Group charges by currency for daily cap checking
        currency_totals = {}
        for charge in batch_data.charges:
            currency = charge.currency
            currency_totals[currency] = currency_totals.get(currency, 0) + charge.amount
        
        # Check daily caps per currency
        for currency, total_amount in currency_totals.items():
            currency_limits = passport.limits.get("payments", {}).get("charge", {}).get("currency_limits", {}).get(currency)
            if currency_limits and currency_limits.get("daily_cap") and total_amount > currency_limits["daily_cap"]:
                raise HTTPException(
                    status_code=403,
                    detail={
                        "error": "Batch total exceeds daily cap",
                        "currency": currency,
                        "total": total_amount,
                        "limit": currency_limits["daily_cap"]
                    }
                )
        
        # Process batch charges
        results = await asyncio.gather(*[
            process_charge_payment({
                "amount": charge.amount,
                "currency": charge.currency,
                "merchant_id": charge.merchant_id,
                "region": charge.region,
                "shipping_country": charge.shipping_country,
                "items": [item.dict() for item in charge.items],
                "risk_score": charge.risk_score,
                "idempotency_key": charge.idempotency_key,
                "agent_id": passport.passport_id
            })
            for charge in batch_data.charges
        ])
        
        return {
            "success": True,
            "processed": len(results),
            "currency_totals": currency_totals,
            "decision_id": request.state.policy_result.decision_id
        }
        
    except Exception as e:
        print(f"Batch charge error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/payments/charge/{charge_id}")
@require_policy("finance.payment.charge.v1")
async def get_charge_status(request: Request, charge_id: str):
    try:
        passport = request.state.policy_result.passport
        
        charge_info = await get_charge_status(charge_id, passport.passport_id)
        
        if not charge_info:
            raise HTTPException(status_code=404, detail="Charge not found")
        
        return charge_info
        
    except Exception as e:
        print(f"Charge status error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/payments/charge/{charge_id}/refund")
@require_policy("finance.payment.charge.v1")
async def process_refund(request: Request, charge_id: str, refund_data: RefundRequest):
    try:
        passport = request.state.policy_result.passport
        
        refund_id = await process_refund_payment({
            "charge_id": charge_id,
            "amount": refund_data.amount,
            "reason": refund_data.reason,
            "agent_id": passport.passport_id
        })
        
        return {
            "success": True,
            "refund_id": refund_id,
            "charge_id": charge_id,
            "amount": refund_data.amount,
            "status": "refunded",
            "decision_id": request.state.policy_result.decision_id
        }
        
    except Exception as e:
        print(f"Refund processing error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def process_charge_payment(charge_data: dict) -> str:
    """Mock charge processing function"""
    # Simulate payment processor call
    await asyncio.sleep(0.1)
    
    # Log charge details for audit
    print(f"Processing charge: {charge_data}")
    
    return f"chg_{asyncio.get_event_loop().time()}_{hash(str(charge_data)) % 1000000}"

async def get_charge_status(charge_id: str, agent_id: str) -> Optional[ChargeStatus]:
    """Mock charge status lookup"""
    await asyncio.sleep(0.05)
    return ChargeStatus(
        charge_id=charge_id,
        status="completed",
        created_at=datetime.now().isoformat(),
        amount=1299,
        currency="USD",
        merchant_id="merch_abc",
        items=[
            ChargeItem(sku="SKU-1", qty=1, category="electronics")
        ]
    )

async def process_refund_payment(refund_data: dict) -> str:
    """Mock refund processing function"""
    # Simulate refund processing
    await asyncio.sleep(0.1)
    
    print(f"Processing refund: {refund_data}")
    
    return f"ref_{asyncio.get_event_loop().time()}_{hash(str(refund_data)) % 1000000}"

if __name__ == "__main__":
    import uvicorn
    print("Payment charge service starting...")
    print("Protected by APort finance.payment.charge.v1 policy pack")
    uvicorn.run(app, host="0.0.0.0", port=8000)
