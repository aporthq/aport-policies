from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from aport.middleware import require_policy
import asyncio
from typing import List, Optional
from datetime import datetime

app = FastAPI(title="Financial Transaction Service", version="1.0.0")

class TransactionRequest(BaseModel):
    transaction_type: str
    amount: int
    currency: str
    asset_class: str
    source_account_id: str
    destination_account_id: str
    source_account_type: Optional[str] = None
    destination_account_type: Optional[str] = None
    counterparty_id: Optional[str] = None
    idempotency_key: str

class BatchTransactionRequest(BaseModel):
    transactions: List[TransactionRequest]

class CancelRequest(BaseModel):
    reason: str

class TransactionResponse(BaseModel):
    success: bool
    transaction_id: str
    transaction_type: str
    amount: int
    currency: str
    asset_class: str
    status: str
    decision_id: str

class TransactionStatus(BaseModel):
    transaction_id: str
    status: str
    created_at: str
    transaction_type: str
    amount: int
    currency: str
    asset_class: str
    source_account_id: str
    destination_account_id: str

@app.post("/finance/transaction")
@require_policy("finance.transaction.execute.v1")
async def execute_transaction(request: Request, transaction_data: TransactionRequest):
    try:
        passport = request.state.policy_result.passport
        
        # Additional business logic validation
        if transaction_data.amount <= 0:
            raise HTTPException(status_code=400, detail="Invalid transaction amount")
        
        # Check if required fields are provided
        if not transaction_data.source_account_id or not transaction_data.destination_account_id:
            raise HTTPException(status_code=400, detail="Source and destination accounts are required")
        
        # Process transaction using your financial system
        transaction_id = await process_transaction({
            "transaction_type": transaction_data.transaction_type,
            "amount": transaction_data.amount,
            "currency": transaction_data.currency,
            "asset_class": transaction_data.asset_class,
            "source_account_id": transaction_data.source_account_id,
            "destination_account_id": transaction_data.destination_account_id,
            "source_account_type": transaction_data.source_account_type,
            "destination_account_type": transaction_data.destination_account_type,
            "counterparty_id": transaction_data.counterparty_id,
            "idempotency_key": transaction_data.idempotency_key,
            "agent_id": passport.passport_id,
            "agent_name": passport.metadata.get("template_name", "Unknown Agent") if passport.metadata else "Unknown Agent"
        })
        
        # Log the transaction
        print(f"Transaction processed: {transaction_id} for {transaction_data.amount} {transaction_data.currency} by agent {passport.passport_id}")
        
        return TransactionResponse(
            success=True,
            transaction_id=transaction_id,
            transaction_type=transaction_data.transaction_type,
            amount=transaction_data.amount,
            currency=transaction_data.currency,
            asset_class=transaction_data.asset_class,
            status="processed",
            decision_id=request.state.policy_result.decision_id
        )
        
    except Exception as e:
        print(f"Transaction processing error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/finance/transaction/batch")
@require_policy("finance.transaction.execute.v1")
async def execute_batch_transactions(request: Request, batch_data: BatchTransactionRequest):
    try:
        passport = request.state.policy_result.passport
        
        # Group transactions by counterparty for exposure checking
        counterparty_totals = {}
        for transaction in batch_data.transactions:
            counterparty = transaction.counterparty_id or "default"
            counterparty_totals[counterparty] = counterparty_totals.get(counterparty, 0) + transaction.amount
        
        # Check counterparty exposure limits
        for counterparty, total_amount in counterparty_totals.items():
            max_exposure = passport.limits.get("finance", {}).get("transaction", {}).get("max_exposure_per_counterparty_usd")
            if max_exposure and total_amount > max_exposure:
                raise HTTPException(
                    status_code=403,
                    detail={
                        "error": "Batch total exceeds counterparty exposure limit",
                        "counterparty": counterparty,
                        "total": total_amount,
                        "limit": max_exposure
                    }
                )
        
        # Process batch transactions
        results = await asyncio.gather(*[
            process_transaction({
                "transaction_type": transaction.transaction_type,
                "amount": transaction.amount,
                "currency": transaction.currency,
                "asset_class": transaction.asset_class,
                "source_account_id": transaction.source_account_id,
                "destination_account_id": transaction.destination_account_id,
                "source_account_type": transaction.source_account_type,
                "destination_account_type": transaction.destination_account_type,
                "counterparty_id": transaction.counterparty_id,
                "idempotency_key": transaction.idempotency_key,
                "agent_id": passport.passport_id
            })
            for transaction in batch_data.transactions
        ])
        
        return {
            "success": True,
            "processed": len(results),
            "counterparty_totals": counterparty_totals,
            "decision_id": request.state.policy_result.decision_id
        }
        
    except Exception as e:
        print(f"Batch transaction error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/finance/transaction/{transaction_id}")
@require_policy("finance.transaction.execute.v1")
async def get_transaction_status(request: Request, transaction_id: str):
    try:
        passport = request.state.policy_result.passport
        
        transaction_info = await get_transaction_status(transaction_id, passport.passport_id)
        
        if not transaction_info:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        return transaction_info
        
    except Exception as e:
        print(f"Transaction status error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/finance/transaction/{transaction_id}/cancel")
@require_policy("finance.transaction.execute.v1")
async def cancel_transaction(request: Request, transaction_id: str, cancel_data: CancelRequest):
    try:
        passport = request.state.policy_result.passport
        
        cancel_id = await cancel_transaction_payment({
            "transaction_id": transaction_id,
            "reason": cancel_data.reason,
            "agent_id": passport.passport_id
        })
        
        return {
            "success": True,
            "cancel_id": cancel_id,
            "transaction_id": transaction_id,
            "status": "cancelled",
            "decision_id": request.state.policy_result.decision_id
        }
        
    except Exception as e:
        print(f"Transaction cancellation error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def process_transaction(transaction_data: dict) -> str:
    """Mock transaction processing function"""
    # Simulate financial system call
    await asyncio.sleep(0.15)
    
    # Log transaction details for audit
    print(f"Processing transaction: {transaction_data}")
    
    return f"txn_{asyncio.get_event_loop().time()}_{hash(str(transaction_data)) % 1000000}"

async def get_transaction_status(transaction_id: str, agent_id: str) -> Optional[TransactionStatus]:
    """Mock transaction status lookup"""
    await asyncio.sleep(0.05)
    return TransactionStatus(
        transaction_id=transaction_id,
        status="completed",
        created_at=datetime.now().isoformat(),
        transaction_type="buy",
        amount=10000,
        currency="USD",
        asset_class="equity",
        source_account_id="acc_client_123",
        destination_account_id="acc_trading_456"
    )

async def cancel_transaction_payment(cancel_data: dict) -> str:
    """Mock transaction cancellation function"""
    # Simulate transaction cancellation
    await asyncio.sleep(0.1)
    
    print(f"Cancelling transaction: {cancel_data}")
    
    return f"cancel_{asyncio.get_event_loop().time()}_{hash(str(cancel_data)) % 1000000}"

if __name__ == "__main__":
    import uvicorn
    print("Financial transaction service starting...")
    print("Protected by APort finance.transaction.execute.v1 policy pack")
    uvicorn.run(app, host="0.0.0.0", port=8000)
