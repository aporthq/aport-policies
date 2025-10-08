from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from aport.middleware import require_policy
import asyncio
from typing import List, Optional

app = FastAPI(title="Refunds Service", version="1.0.0")

class RefundRequest(BaseModel):
    amount_minor: int
    currency: str
    order_id: str
    customer_id: str
    reason_code: str
    region: str
    idempotency_key: str
    order_currency: Optional[str] = None
    order_total_minor: Optional[int] = None
    already_refunded_minor: Optional[int] = None
    note: Optional[str] = None
    merchant_case_id: Optional[str] = None

class BatchRefundRequest(BaseModel):
    refunds: List[RefundRequest]

@app.post("/refunds")
@require_policy("finance.payment.refund.v1")
async def process_refund(request: Request, refund_data: RefundRequest):
    try:
        passport = request.state.policy_result.passport
        
        # Additional business logic validation
        if refund_data.amount_minor <= 0:
            raise HTTPException(status_code=400, detail="Invalid refund amount")
        
        # Process refund using your payment processor
        refund_id = await process_refund_payment({
            "amount_minor": refund_data.amount_minor,
            "currency": refund_data.currency,
            "order_id": refund_data.order_id,
            "customer_id": refund_data.customer_id,
            "reason_code": refund_data.reason_code,
            "region": refund_data.region,
            "idempotency_key": refund_data.idempotency_key,
            "order_currency": refund_data.order_currency,
            "order_total_minor": refund_data.order_total_minor,
            "already_refunded_minor": refund_data.already_refunded_minor,
            "note": refund_data.note,
            "merchant_case_id": refund_data.merchant_case_id,
            "agent_id": passport.agent_id,
            "agent_name": passport.name
        })
        
        # Log the transaction
        print(f"Refund processed: {refund_id} for {refund_data.amount_minor} {refund_data.currency} by agent {passport.agent_id}")
        
        return {
            "success": True,
            "refund_id": refund_id,
            "amount_minor": refund_data.amount_minor,
            "currency": refund_data.currency,
            "status": "processed",
            "decision_id": request.state.policy_result.decision_id
        }
        
    except Exception as e:
        print(f"Refund processing error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/refunds/batch")
@require_policy("finance.payment.refund.v1")
async def process_batch_refunds(request: Request, batch_data: BatchRefundRequest):
    try:
        passport = request.state.policy_result.passport
        
        # Group refunds by currency for daily cap checking
        currency_totals = {}
        for refund in batch_data.refunds:
            currency = refund.currency
            currency_totals[currency] = currency_totals.get(currency, 0) + refund.amount_minor
        
        # Check daily caps per currency
        for currency, total_amount in currency_totals.items():
            currency_limits = passport.limits.get("currency_limits", {}).get(currency)
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
        
        # Process batch refunds
        results = await asyncio.gather(*[
            process_refund_payment({
                "amount_minor": refund.amount_minor,
                "currency": refund.currency,
                "order_id": refund.order_id,
                "customer_id": refund.customer_id,
                "reason_code": refund.reason_code,
                "region": refund.region,
                "idempotency_key": refund.idempotency_key,
                "agent_id": passport.agent_id
            })
            for refund in batch_data.refunds
        ])
        
        return {
            "success": True,
            "processed": len(results),
            "currency_totals": currency_totals,
            "decision_id": request.state.policy_result.decision_id
        }
        
    except Exception as e:
        print(f"Batch refund error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def process_refund_payment(refund_data: dict) -> str:
    """Mock refund processing function"""
    # Simulate payment processor call
    await asyncio.sleep(0.1)
    
    # Log refund details for audit
    print(f"Processing refund: {refund_data}")
    
    return f"ref_{asyncio.get_event_loop().time()}_{hash(str(refund_data)) % 1000000}"

if __name__ == "__main__":
    import uvicorn
    print("Refunds service starting...")
    print("Protected by APort finance.payment.refund.v1 policy pack")
    uvicorn.run(app, host="0.0.0.0", port=8000)
