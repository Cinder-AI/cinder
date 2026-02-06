from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

UPLOAD_DIR = Path("/data/uploads")
MAX_BYTES = 10 * 1024 * 1024
ALLOWED_PREFIX = "image/"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.post("/upload")
async def upload_image(file: UploadFile = File(...)) -> JSONResponse:
    if not file.content_type or not file.content_type.startswith(ALLOWED_PREFIX):
        raise HTTPException(status_code=400, detail="Only image uploads are allowed")

    suffix = Path(file.filename or "").suffix.lower()
    if not suffix:
        suffix = ".img"

    filename = f"{uuid4().hex}{suffix}"
    destination = UPLOAD_DIR / filename

    size = 0
    try:
        with destination.open("wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_BYTES:
                    destination.unlink(missing_ok=True)
                    raise HTTPException(status_code=413, detail="File too large")
                out.write(chunk)
    finally:
        await file.close()

    return JSONResponse(
        {
            "url": f"/uploads/{filename}",
            "filename": filename,
        }
    )
