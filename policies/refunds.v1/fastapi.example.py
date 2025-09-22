from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from aport.middleware import require_policy
import asyncio
from typing import List

app = FastAPI(title="Refunds Service", version="1.0.0")

class RefundRequest(BaseModel):
    amount: float
    reason: str
    order_id: str

class BatchRefundRequest(BaseModel):
    refunds: List[RefundRequest]

@app.post("/refunds")
@require_policy("refunds.v1")
async def process_refund(request: Request, refund_data: RefundRequest):
    try:
        passport = request.state.policy_result.passport
        
        # Additional business logic validation
        if refund_data.amount <= 0:
            raise HTTPException(status_code=400, detail="Invalid refund amount")
        
        # Process refund using your payment processor
        refund_id = await process_refund_payment({
            "amount": refund_data.amount,
            "reason": refund_data.reason,
            "order_id": refund_data.order_id,
            "agent_id": passport.agent_id,
            "agent_name": passport.name
        })
        
        # Log the transaction
        print(f"Refund processed: {refund_id} for ${refund_data.amount} by agent {passport.agent_id}")
        
        return {
            "success": True,
            "refund_id": refund_id,
            "amount": refund_data.amount,
            "status": "processed"
        }
        
    except Exception as e:
        print(f"Refund processing error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/refunds/batch")
@require_policy("refunds.v1")
async def process_batch_refunds(request: Request, batch_data: BatchRefundRequest):
    try:
        passport = request.state.policy_result.passport
        
        # Check total batch amount against daily cap
        total_amount = sum(refund.amount for refund in batch_data.refunds)
        if total_amount > passport.limits.refund_usd_daily_cap:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Batch total exceeds daily cap",
                    "total": total_amount,
                    "limit": passport.limits.refund_usd_daily_cap
                }
            )
        
        # Process batch refunds
        results = await asyncio.gather(*[
            process_refund_payment({
                "amount": refund.amount,
                "reason": refund.reason,
                "order_id": refund.order_id,
                "agent_id": passport.agent_id
            })
            for refund in batch_data.refunds
        ])
        
        return {
            "success": True,
            "processed": len(results),
            "total_amount": total_amount
        }
        
    except Exception as e:
        print(f"Batch refund error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def process_refund_payment(refund_data: dict) -> str:
    """Mock refund processing function"""
    # Simulate payment processor call
    await asyncio.sleep(0.1)
    return f"ref_{asyncio.get_event_loop().time()}_{hash(str(refund_data)) % 1000000}"

if __name__ == "__main__":
    import uvicorn
    print("Refunds service starting...")
    print("Protected by APort refunds.v1 policy pack")
    uvicorn.run(app, host="0.0.0.0", port=8000)
