from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from aport.middleware import require_policy
import asyncio
import re

app = FastAPI(title="Repository Service", version="1.0.0")

class FileChange(BaseModel):
    path: str
    lines_added: Optional[int] = 0
    lines_removed: Optional[int] = 0

class PRRequest(BaseModel):
    repo: str
    base_branch: str
    head_branch: str
    title: str
    body: Optional[str] = ""
    files_changed: Optional[List[FileChange]] = []

class MergeRequest(BaseModel):
    repo: str
    pr_id: str
    merge_method: Optional[str] = "merge"
    delete_branch: Optional[bool] = False

@app.post("/repo/pr")
@require_policy("code.repository.merge.v1")
async def create_pull_request(request: Request, pr_data: PRRequest):
    try:
        passport = request.state.policy_result.passport
        
        # Get PR creation capability
        pr_capability = next(
            (cap for cap in passport.capabilities if cap.id == "repo.pr.create"), 
            None
        )
        
        # Check repository allowlist
        allowed_repos = (
            pr_capability.params.get("allowed_repos", [])
            if pr_capability and pr_capability.params
            else []
        )
        
        if allowed_repos and pr_data.repo not in allowed_repos:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Repository not allowed",
                    "allowed_repos": allowed_repos,
                    "upgrade_instructions": "Add repository to your passport's allowed_repos"
                }
            )

        # Check base branch allowlist
        allowed_branches = (
            pr_capability.params.get("allowed_base_branches", [])
            if pr_capability and pr_capability.params
            else []
        )
        
        if allowed_branches and pr_data.base_branch not in allowed_branches:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Base branch not allowed",
                    "allowed_branches": allowed_branches
                }
            )

        # Check file limits
        max_files = (
            pr_capability.params.get("max_files_changed", float('inf'))
            if pr_capability and pr_capability.params
            else float('inf')
        )
        
        if pr_data.files_changed and len(pr_data.files_changed) > max_files:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Too many files changed",
                    "max_files": max_files,
                    "requested": len(pr_data.files_changed)
                }
            )

        # Check total lines added
        total_lines_added = sum(
            file.lines_added or 0 for file in (pr_data.files_changed or [])
        )
        max_lines = (
            pr_capability.params.get("max_total_added_lines", float('inf'))
            if pr_capability and pr_capability.params
            else float('inf')
        )
        
        if total_lines_added > max_lines:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Too many lines added",
                    "max_lines": max_lines,
                    "requested": total_lines_added
                }
            )

        # Check path allowlist
        path_allowlist = (
            pr_capability.params.get("path_allowlist", [])
            if pr_capability and pr_capability.params
            else []
        )
        
        if path_allowlist and pr_data.files_changed:
            disallowed_files = [
                file for file in pr_data.files_changed
                if not any(re.match(pattern, file.path) for pattern in path_allowlist)
            ]
            
            if disallowed_files:
                raise HTTPException(
                    status_code=403,
                    detail={
                        "error": "Files outside allowed paths",
                        "disallowed_files": [f.path for f in disallowed_files],
                        "path_allowlist": path_allowlist
                    }
                )

        # Check daily PR limit
        daily_usage = await get_daily_pr_usage(passport.agent_id)
        pr_limit = passport.limits.get("max_prs_per_day", float('inf'))
        
        if daily_usage >= pr_limit:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Daily PR limit exceeded",
                    "limit": pr_limit,
                    "current_usage": daily_usage
                }
            )

        # Create PR using your Git service
        pr_id = await create_pull_request_service({
            "repo": pr_data.repo,
            "base_branch": pr_data.base_branch,
            "head_branch": pr_data.head_branch,
            "title": pr_data.title,
            "body": pr_data.body,
            "files_changed": pr_data.files_changed,
            "agent_id": passport.agent_id,
            "agent_name": passport.name,
        })

        # Record usage
        await record_pr_usage(passport.agent_id)

        # Log the PR creation
        print(f"PR created: {pr_id} in {pr_data.repo} by agent {passport.agent_id}")

        return {
            "success": True,
            "pr_id": pr_id,
            "repo": pr_data.repo,
            "base_branch": pr_data.base_branch,
            "head_branch": pr_data.head_branch,
            "files_changed": len(pr_data.files_changed or []),
            "lines_added": total_lines_added,
            "status": "created",
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"PR creation error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/repo/merge")
@require_policy("code.repository.merge.v1")
async def merge_pull_request(request: Request, merge_data: MergeRequest):
    try:
        passport = request.state.policy_result.passport

        # Get PR details first
        pr_details = await get_pr_details(merge_data.repo, merge_data.pr_id)
        
        # Get merge capability
        merge_capability = next(
            (cap for cap in passport.capabilities if cap.id == "repo.merge"), 
            None
        )
        
        # Check repository allowlist
        allowed_repos = (
            merge_capability.params.get("allowed_repos", [])
            if merge_capability and merge_capability.params
            else []
        )
        
        if allowed_repos and merge_data.repo not in allowed_repos:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Repository not allowed for merging",
                    "allowed_repos": allowed_repos
                }
            )

        # Check base branch allowlist
        allowed_branches = (
            merge_capability.params.get("allowed_base_branches", [])
            if merge_capability and merge_capability.params
            else []
        )
        
        if allowed_branches and pr_details["base_branch"] not in allowed_branches:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Base branch not allowed for merging",
                    "allowed_branches": allowed_branches
                }
            )

        # Check required labels
        required_labels = (
            merge_capability.params.get("required_labels", [])
            if merge_capability and merge_capability.params
            else []
        )
        
        if required_labels:
            missing_labels = [
                label for label in required_labels 
                if label not in pr_details["labels"]
            ]
            if missing_labels:
                raise HTTPException(
                    status_code=403,
                    detail={
                        "error": "Required labels missing",
                        "missing_labels": missing_labels,
                        "current_labels": pr_details["labels"]
                    }
                )

        # Check required reviews
        required_reviews = (
            merge_capability.params.get("required_reviews", 0)
            if merge_capability and merge_capability.params
            else 0
        )
        
        if pr_details["approvals"] < required_reviews:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Insufficient reviews",
                    "required": required_reviews,
                    "current": pr_details["approvals"]
                }
            )

        # Check PR size limit
        pr_size_kb = pr_details["size_kb"]
        size_limit = passport.limits.get("max_pr_size_kb", float('inf'))
        
        if pr_size_kb > size_limit:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "PR size exceeds limit",
                    "size_kb": pr_size_kb,
                    "limit_kb": size_limit
                }
            )

        # Check daily merge limit
        daily_usage = await get_daily_merge_usage(passport.agent_id)
        merge_limit = passport.limits.get("max_merges_per_day", float('inf'))
        
        if daily_usage >= merge_limit:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Daily merge limit exceeded",
                    "limit": merge_limit,
                    "current_usage": daily_usage
                }
            )

        # Merge PR using your Git service
        merge_result = await merge_pull_request_service({
            "repo": merge_data.repo,
            "pr_id": merge_data.pr_id,
            "merge_method": merge_data.merge_method,
            "delete_branch": merge_data.delete_branch,
            "agent_id": passport.agent_id,
            "agent_name": passport.name,
        })

        # Record usage
        await record_merge_usage(passport.agent_id)

        # Log the merge
        print(f"PR merged: {merge_data.pr_id} in {merge_data.repo} by agent {passport.agent_id}")

        return {
            "success": True,
            "pr_id": merge_data.pr_id,
            "repo": merge_data.repo,
            "merge_sha": merge_result["sha"],
            "merge_method": merge_data.merge_method,
            "status": "merged",
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"PR merge error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Mock functions (implement with your actual Git service)
async def create_pull_request_service(pr_data: dict) -> str:
    """Mock PR creation function"""
    await asyncio.sleep(0.2)  # Simulate API call
    return f"pr_{asyncio.get_event_loop().time()}_{hash(str(pr_data)) % 1000000}"

async def get_pr_details(repo: str, pr_id: str) -> Dict[str, Any]:
    """Mock PR details retrieval"""
    return {
        "base_branch": "main",
        "labels": ["enhancement", "agent-created"],
        "approvals": 2,
        "size_kb": 45
    }

async def merge_pull_request_service(merge_data: dict) -> Dict[str, str]:
    """Mock PR merge function"""
    await asyncio.sleep(0.3)  # Simulate API call
    return {
        "sha": f"sha_{asyncio.get_event_loop().time()}_{hash(str(merge_data)) % 1000000}"
    }

async def get_daily_pr_usage(agent_id: str) -> int:
    """Get current daily PR usage"""
    return 0  # Mock value

async def get_daily_merge_usage(agent_id: str) -> int:
    """Get current daily merge usage"""
    return 0  # Mock value

async def record_pr_usage(agent_id: str) -> None:
    """Record PR creation usage"""
    print(f"Recorded PR creation for agent {agent_id}")

async def record_merge_usage(agent_id: str) -> None:
    """Record PR merge usage"""
    print(f"Recorded PR merge for agent {agent_id}")

if __name__ == "__main__":
    import uvicorn
    print("Repository service starting...")
    print("Protected by APort code.repository.merge.v1 policy pack")
    uvicorn.run(app, host="0.0.0.0", port=8000)
