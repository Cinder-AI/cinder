import asyncio
import os
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

INDEXER_URL = os.getenv("INDEXER_URL", "http://host.docker.internal:8080")
HEARTBEAT_INTERVAL_SECONDS = int(os.getenv("SSE_HEARTBEAT_SECONDS", "15"))

app = FastAPI(title="cinder-sse-service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
async def healthz() -> JSONResponse:
    return JSONResponse({"ok": True, "indexer_url": INDEXER_URL})


@app.get("/sse")
async def sse() -> StreamingResponse:
    async def event_stream():
        # Initial event confirms a successful stream setup.
        yield "event: ready\ndata: connected\n\n"
        while True:
            ts = datetime.now(timezone.utc).isoformat()
            yield f"event: heartbeat\ndata: {ts}\n\n"
            await asyncio.sleep(HEARTBEAT_INTERVAL_SECONDS)

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=headers)

@app.post('/campaign_updated')
async def campaign_updated(data: dict) -> JSONResponse:
    print(data)
    return JSONResponse({"ok": True})