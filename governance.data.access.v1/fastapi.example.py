from fastapi import FastAPI, HTTPException, Request, Query
from pydantic import BaseModel
from aport.middleware import require_policy
import asyncio
from typing import List, Optional, Dict, Any
from datetime import datetime

app = FastAPI(title="Data Access Governance Service", version="1.0.0")

class DataExportRequest(BaseModel):
    data_classification: str
    accessing_entity_id: str
    accessing_entity_type: str
    resource_id: str
    action_type: Optional[str] = "export"
    jurisdiction: Optional[str] = None
    row_count: int
    destination_jurisdiction: Optional[str] = None
    export_format: str = "json"
    filters: Optional[Dict[str, Any]] = None

class DataAccessResponse(BaseModel):
    success: bool
    access_id: str
    data_classification: str
    resource_id: str
    action_type: str
    status: str
    decision_id: str

class DataExportResponse(BaseModel):
    success: bool
    export_id: str
    data_classification: str
    row_count: int
    export_format: str
    status: str
    decision_id: str

class BalanceInfo(BaseModel):
    account_id: str
    balance_usd: int
    currency: str
    last_updated: str

class AuditLog(BaseModel):
    access_id: str
    data_classification: str
    resource_id: str
    action_type: str
    timestamp: str
    agent_id: str

@app.get("/data/access")
@require_policy("governance.data.access.v1")
async def access_data(
    request: Request,
    data_classification: str = Query(...),
    accessing_entity_id: str = Query(...),
    accessing_entity_type: str = Query(...),
    resource_id: str = Query(...),
    action_type: str = Query("read"),
    jurisdiction: Optional[str] = Query(None),
    row_count: Optional[int] = Query(None),
    destination_jurisdiction: Optional[str] = Query(None),
    resource_attributes: Optional[str] = Query(None)
):
    try:
        passport = request.state.policy_result.passport
        
        # Additional business logic validation
        if not data_classification or not accessing_entity_id or not resource_id:
            raise HTTPException(status_code=400, detail="Missing required parameters")
        
        # Process data access using your data system
        access_id = await process_data_access({
            "data_classification": data_classification,
            "accessing_entity_id": accessing_entity_id,
            "accessing_entity_type": accessing_entity_type,
            "resource_id": resource_id,
            "action_type": action_type,
            "jurisdiction": jurisdiction,
            "row_count": row_count,
            "destination_jurisdiction": destination_jurisdiction,
            "resource_attributes": json.loads(resource_attributes) if resource_attributes else None,
            "agent_id": passport.passport_id,
            "agent_name": passport.metadata.get("template_name", "Unknown Agent") if passport.metadata else "Unknown Agent"
        })
        
        # Log the data access
        print(f"Data access processed: {access_id} for {data_classification} data by agent {passport.passport_id}")
        
        return DataAccessResponse(
            success=True,
            access_id=access_id,
            data_classification=data_classification,
            resource_id=resource_id,
            action_type=action_type,
            status="processed",
            decision_id=request.state.policy_result.decision_id
        )
        
    except Exception as e:
        print(f"Data access processing error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/data/export")
@require_policy("governance.data.access.v1")
async def export_data(request: Request, export_data: DataExportRequest):
    try:
        passport = request.state.policy_result.passport
        
        # Check row count limits
        max_rows_per_export = passport.limits.get("data", {}).get("access", {}).get("max_rows_per_export")
        if max_rows_per_export and export_data.row_count > max_rows_per_export:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Export row count exceeds limit",
                    "row_count": export_data.row_count,
                    "limit": max_rows_per_export
                }
            )
        
        # Process data export
        export_id = await process_data_export({
            "data_classification": export_data.data_classification,
            "accessing_entity_id": export_data.accessing_entity_id,
            "accessing_entity_type": export_data.accessing_entity_type,
            "resource_id": export_data.resource_id,
            "action_type": export_data.action_type,
            "jurisdiction": export_data.jurisdiction,
            "row_count": export_data.row_count,
            "destination_jurisdiction": export_data.destination_jurisdiction,
            "export_format": export_data.export_format,
            "filters": export_data.filters,
            "agent_id": passport.passport_id
        })
        
        return DataExportResponse(
            success=True,
            export_id=export_id,
            data_classification=export_data.data_classification,
            row_count=export_data.row_count,
            export_format=export_data.export_format,
            status="exported",
            decision_id=request.state.policy_result.decision_id
        )
        
    except Exception as e:
        print(f"Data export error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/data/balance/{account_id}")
@require_policy("governance.data.access.v1")
async def get_balance(
    request: Request,
    account_id: str,
    accessing_entity_id: str = Query(...),
    accessing_entity_type: str = Query(...)
):
    try:
        passport = request.state.policy_result.passport
        
        # Get account balance
        balance_info = await get_account_balance(account_id, accessing_entity_id, passport.passport_id)
        
        if not balance_info:
            raise HTTPException(status_code=404, detail="Account not found")
        
        # Check balance inquiry limits
        balance_inquiry_cap = passport.limits.get("data", {}).get("access", {}).get("balance_inquiry_cap_usd")
        if balance_inquiry_cap and balance_info["balance_usd"] >= balance_inquiry_cap:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Account balance exceeds inquiry cap",
                    "balance": balance_info["balance_usd"],
                    "cap": balance_inquiry_cap
                }
            )
        
        return BalanceInfo(
            account_id=account_id,
            balance_usd=balance_info["balance_usd"],
            currency=balance_info["currency"],
            last_updated=balance_info["last_updated"]
        )
        
    except Exception as e:
        print(f"Balance inquiry error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/data/access/audit")
@require_policy("governance.data.access.v1")
async def get_audit_logs(
    request: Request,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    data_classification: Optional[str] = Query(None)
):
    try:
        passport = request.state.policy_result.passport
        
        audit_logs = await get_data_access_audit_logs({
            "start_date": start_date,
            "end_date": end_date,
            "data_classification": data_classification,
            "agent_id": passport.passport_id
        })
        
        return {
            "success": True,
            "audit_logs": audit_logs,
            "total_entries": len(audit_logs),
            "decision_id": request.state.policy_result.decision_id
        }
        
    except Exception as e:
        print(f"Audit log error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def process_data_access(data_access_data: dict) -> str:
    """Mock data access processing function"""
    # Simulate data system call
    await asyncio.sleep(0.1)
    
    # Log data access details for audit
    print(f"Processing data access: {data_access_data}")
    
    return f"access_{asyncio.get_event_loop().time()}_{hash(str(data_access_data)) % 1000000}"

async def process_data_export(export_data: dict) -> str:
    """Mock data export processing function"""
    # Simulate data export processing
    await asyncio.sleep(0.2)
    
    print(f"Processing data export: {export_data}")
    
    return f"export_{asyncio.get_event_loop().time()}_{hash(str(export_data)) % 1000000}"

async def get_account_balance(account_id: str, accessing_entity_id: str, agent_id: str) -> Optional[Dict[str, Any]]:
    """Mock account balance lookup"""
    await asyncio.sleep(0.05)
    return {
        "account_id": account_id,
        "balance_usd": 50000,  # $500.00 in cents
        "currency": "USD",
        "last_updated": datetime.now().isoformat()
    }

async def get_data_access_audit_logs(params: dict) -> List[Dict[str, Any]]:
    """Mock audit log lookup"""
    await asyncio.sleep(0.1)
    return [
        {
            "access_id": "access_123",
            "data_classification": "PII",
            "resource_id": "user_456",
            "action_type": "read",
            "timestamp": datetime.now().isoformat(),
            "agent_id": params["agent_id"]
        },
        {
            "access_id": "access_124",
            "data_classification": "Financial",
            "resource_id": "account_789",
            "action_type": "export",
            "timestamp": datetime.now().isoformat(),
            "agent_id": params["agent_id"]
        }
    ]

if __name__ == "__main__":
    import uvicorn
    import json
    print("Data access governance service starting...")
    print("Protected by APort governance.data.access.v1 policy pack")
    uvicorn.run(app, host="0.0.0.0", port=8000)
