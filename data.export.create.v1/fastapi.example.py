from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from aport.middleware import require_policy
import asyncio
from typing import List, Optional
import io

app = FastAPI(title="Data Export Service", version="1.0.0")

class ExportRequest(BaseModel):
    format: str
    include_pii: bool = False
    filters: dict

class ExportStatus(BaseModel):
    export_id: str
    status: str
    created_at: str
    estimated_rows: int
    actual_rows: Optional[int] = None
    format: str
    include_pii: bool

@app.post("/exports")
@require_policy("data.export.create.v1")
async def create_export(request: Request, export_data: ExportRequest):
    try:
        passport = request.state.policy_result.passport
        
        # Check PII permission
        if export_data.include_pii and not passport.limits.allow_pii:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "PII export not allowed",
                    "agent_id": passport.agent_id,
                    "upgrade_instructions": "Request PII export capability from your administrator"
                }
            )
        
        # Estimate row count (in real app, query your database)
        estimated_rows = await estimate_export_rows(export_data.filters)
        
        # Check row limit
        if estimated_rows > passport.limits.max_export_rows:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Export exceeds row limit",
                    "requested": estimated_rows,
                    "limit": passport.limits.max_export_rows,
                    "upgrade_instructions": "Request smaller export or upgrade limits"
                }
            )
        
        # Process export
        export_id = await create_export_job({
            "format": export_data.format,
            "include_pii": export_data.include_pii,
            "filters": export_data.filters,
            "agent_id": passport.agent_id,
            "agent_name": passport.name,
            "estimated_rows": estimated_rows
        })
        
        # Log the export request
        print(f"Export created: {export_id} ({estimated_rows} rows) by agent {passport.agent_id}")
        
        return {
            "success": True,
            "export_id": export_id,
            "format": export_data.format,
            "estimated_rows": estimated_rows,
            "status": "processing"
        }
        
    except Exception as e:
        print(f"Export creation error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/exports/{export_id}")
@require_policy("data.export.create.v1")
async def get_export_status(request: Request, export_id: str):
    try:
        passport = request.state.policy_result.passport
        
        export_info = await get_export_status(export_id, passport.agent_id)
        
        if not export_info:
            raise HTTPException(status_code=404, detail="Export not found")
        
        return export_info
        
    except Exception as e:
        print(f"Export status error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/exports/{export_id}/download")
@require_policy("data.export.create.v1")
async def download_export(request: Request, export_id: str):
    try:
        passport = request.state.policy_result.passport
        
        export_file = await get_export_file(export_id, passport.agent_id)
        
        if not export_file:
            raise HTTPException(status_code=404, detail="Export file not found")
        
        if export_file["status"] != "completed":
            raise HTTPException(status_code=400, detail="Export not ready for download")
        
        # Create streaming response
        def generate_file():
            yield export_file["data"]
        
        return StreamingResponse(
            generate_file(),
            media_type=export_file["content_type"],
            headers={"Content-Disposition": f"attachment; filename={export_file['filename']}"}
        )
        
    except Exception as e:
        print(f"Export download error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Mock functions
async def estimate_export_rows(filters: dict) -> int:
    """Simulate database query to estimate rows"""
    await asyncio.sleep(0.05)
    return (hash(str(filters)) % 10000) + 1000

async def create_export_job(export_data: dict) -> str:
    """Simulate export creation"""
    await asyncio.sleep(0.1)
    return f"exp_{asyncio.get_event_loop().time()}_{hash(str(export_data)) % 1000000}"

async def get_export_status(export_id: str, agent_id: str) -> Optional[ExportStatus]:
    """Simulate export status lookup"""
    await asyncio.sleep(0.05)
    return ExportStatus(
        export_id=export_id,
        status="completed",
        created_at="2024-01-16T00:00:00Z",
        estimated_rows=5000,
        actual_rows=4876,
        format="csv",
        include_pii=False
    )

async def get_export_file(export_id: str, agent_id: str) -> Optional[dict]:
    """Simulate file retrieval"""
    await asyncio.sleep(0.05)
    return {
        "data": "name,email,created_at\nJohn Doe,john@example.com,2024-01-01",
        "content_type": "text/csv",
        "filename": f"export_{export_id}.csv",
        "status": "completed"
    }

if __name__ == "__main__":
    import uvicorn
    print("Data export service starting...")
    print("Protected by APort data.export.create.v1 policy pack")
    uvicorn.run(app, host="0.0.0.0", port=8000)
