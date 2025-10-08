from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field
from typing import List, Optional
from aport.middleware import require_policy
import asyncio

app = FastAPI(title="Messaging Service", version="1.0.0")

class MessageRequest(BaseModel):
    channel: str
    recipients: List[str]
    content: str
    mentions: Optional[List[str]] = []

class BroadcastRequest(BaseModel):
    channels: List[str]
    content: str
    mentions: Optional[List[str]] = []

@app.post("/messages")
@require_policy("messaging.message.send.v1")
async def send_message(request: Request, message_data: MessageRequest):
    try:
        passport = request.state.policy_result.passport
        
        # Check channel allowlist
        messaging_capability = next(
            (cap for cap in passport.capabilities if cap.id == "messaging.send"), 
            None
        )
        allowed_channels = (
            messaging_capability.params.get("channels_allowlist", []) 
            if messaging_capability and messaging_capability.params 
            else []
        )
        
        if allowed_channels and message_data.channel not in allowed_channels:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Channel not allowed",
                    "allowed_channels": allowed_channels,
                    "upgrade_instructions": "Add channel to your passport's channels_allowlist"
                }
            )

        # Check mention policy
        mention_policy = (
            messaging_capability.params.get("mention_policy", "limited")
            if messaging_capability and messaging_capability.params
            else "limited"
        )
        
        if message_data.mentions:
            if mention_policy == "none":
                raise HTTPException(
                    status_code=403,
                    detail={
                        "error": "Mentions not allowed",
                        "mention_policy": mention_policy
                    }
                )
            if mention_policy == "limited" and "@everyone" in message_data.mentions:
                raise HTTPException(
                    status_code=403,
                    detail={
                        "error": "@everyone mentions not allowed with limited mention policy"
                    }
                )

        # Rate limiting check (would integrate with actual rate limiter)
        rate_limit_check = await check_message_rate_limit(passport.agent_id)
        if not rate_limit_check["allowed"]:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Rate limit exceeded",
                    "retry_after": rate_limit_check.get("retry_after"),
                    "limits": {
                        "per_minute": passport.limits.get("msgs_per_min"),
                        "per_day": passport.limits.get("msgs_per_day")
                    }
                }
            )

        # Send message using your messaging service
        message_id = await send_message_service({
            "channel": message_data.channel,
            "recipients": message_data.recipients,
            "content": message_data.content,
            "mentions": message_data.mentions,
            "agent_id": passport.agent_id,
            "agent_name": passport.name,
        })

        # Record usage for rate limiting
        await record_message_usage(passport.agent_id)

        # Log the message
        print(f"Message sent: {message_id} to {message_data.channel} by agent {passport.agent_id}")

        return {
            "success": True,
            "message_id": message_id,
            "channel": message_data.channel,
            "recipients": len(message_data.recipients),
            "status": "sent",
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Message sending error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/messages/broadcast")
@require_policy("messaging.message.send.v1")
async def broadcast_message(request: Request, broadcast_data: BroadcastRequest):
    try:
        passport = request.state.policy_result.passport

        # Check if broadcast is within daily limits
        estimated_messages = len(broadcast_data.channels)
        daily_usage = await get_daily_message_usage(passport.agent_id)
        
        daily_limit = passport.limits.get("msgs_per_day", float('inf'))
        if daily_usage + estimated_messages > daily_limit:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Broadcast would exceed daily message limit",
                    "current_usage": daily_usage,
                    "limit": daily_limit,
                    "requested": estimated_messages
                }
            )

        # Process broadcast
        results = []
        for channel in broadcast_data.channels:
            try:
                message_id = await send_message_service({
                    "channel": channel,
                    "content": broadcast_data.content,
                    "mentions": broadcast_data.mentions,
                    "agent_id": passport.agent_id,
                    "agent_name": passport.name,
                })
                results.append({"channel": channel, "message_id": message_id, "status": "sent"})
            except Exception as error:
                results.append({"channel": channel, "error": str(error), "status": "failed"})

        # Record usage
        await record_message_usage(passport.agent_id, len(broadcast_data.channels))

        return {
            "success": True,
            "results": results,
            "total_sent": len([r for r in results if r["status"] == "sent"]),
            "total_failed": len([r for r in results if r["status"] == "failed"]),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Broadcast error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Mock functions (implement with your actual messaging service)
async def send_message_service(message_data: dict) -> str:
    """Mock message sending function"""
    await asyncio.sleep(0.1)  # Simulate API call
    return f"msg_{asyncio.get_event_loop().time()}_{hash(str(message_data)) % 1000000}"

async def check_message_rate_limit(agent_id: str) -> dict:
    """Mock rate limit checker"""
    # Implement with Redis or in-memory rate limiter
    # For demo, always allow
    return {"allowed": True}

async def record_message_usage(agent_id: str, count: int = 1) -> None:
    """Record message usage in your tracking system"""
    print(f"Recorded {count} message(s) for agent {agent_id}")

async def get_daily_message_usage(agent_id: str) -> int:
    """Get current daily usage from your tracking system"""
    return 0  # Mock value

if __name__ == "__main__":
    import uvicorn
    print("Messaging service starting...")
    print("Protected by APort messaging.message.send.v1 policy pack")
    uvicorn.run(app, host="0.0.0.0", port=8000)
