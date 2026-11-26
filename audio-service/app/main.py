from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from app.engines.base import AudioDecodeError, EngineNotConfigured
from app.engines.factory import get_engine
from app.engines.platforms import configuration_message, identify_file, is_configured

def _load_project_env() -> None:
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        trimmed = line.strip()
        if not trimmed or trimmed.startswith("#") or "=" not in trimmed:
            continue
        key, value = trimmed.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key in {"RECOGNITION_API_KEY", "RECOGNITION_API_URL", "RECOGNITION_ENGINE", "MAX_UPLOAD_BYTES"} and value and not os.getenv(key):
            os.environ[key] = value


_load_project_env()

MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(40 * 1024 * 1024)))
MAX_CATALOGUE = 200
ALLOWED_SUFFIXES = {".wav", ".mp3", ".flac", ".ogg", ".aiff", ".aif", ".m4a", ".aac"}

app = FastAPI(title="BeatLedger Audio Service", version="0.1.0")


@app.exception_handler(EngineNotConfigured)
async def handle_not_configured(_request, exc: EngineNotConfigured):
    return JSONResponse(
        status_code=503,
        content={"error": str(exc), "experimental": True, "matches": []},
    )


@app.exception_handler(AudioDecodeError)
async def handle_decode_error(_request, exc: AudioDecodeError):
    return JSONResponse(status_code=422, content={"error": str(exc), "matches": []})


@app.get("/health")
def health():
    try:
        engine = get_engine()
    except EngineNotConfigured as exc:
        return JSONResponse(status_code=503, content={"ok": False, "error": str(exc)})
    return {
        "ok": True,
        "engine": engine.name,
        "experimental": engine.experimental,
        "limitations": engine.limitations,
        "platformIdentification": {
            "configured": is_configured(),
            "provider": "audd",
            "detail": configuration_message(),
        },
    }


def _suffix(filename: str | None) -> str:
    suffix = Path(filename or "").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(status_code=400, detail="Use WAV, MP3, FLAC, OGG, AIFF, or M4A.")
    return suffix


async def _write_upload(upload: UploadFile) -> str:
    suffix = _suffix(upload.filename)
    data = await upload.read()
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="The file exceeds the 40 MB upload limit.")
    handle = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        handle.write(data)
        handle.close()
    except Exception:
        handle.close()
        os.unlink(handle.name)
        raise
    return handle.name


def _parse_catalogue(raw: str) -> list[dict]:
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Catalogue JSON is invalid.") from exc
    if not isinstance(payload, list):
        raise HTTPException(status_code=400, detail="Catalogue must be a list.")
    if len(payload) > MAX_CATALOGUE:
        raise HTTPException(status_code=400, detail="Catalogue limit is 200 fingerprinted beats.")
    catalogue = []
    for item in payload:
        if not isinstance(item, dict) or "beatId" not in item or not isinstance(item.get("hashes"), list):
            raise HTTPException(status_code=400, detail="Each catalogue item needs beatId and hashes.")
        catalogue.append({"beatId": str(item["beatId"]), "hashes": item["hashes"][:MAX_HASHES]})
    return catalogue


# Imported lazily so the constant lives next to the hasher.
from app.engines.landmark import MAX_HASHES  # noqa: E402


@app.post("/fingerprint")
async def fingerprint(file: UploadFile = File(...)):
    path = await _write_upload(file)
    try:
        return get_engine().fingerprint_file(path)
    finally:
        if os.path.exists(path):
            os.unlink(path)


@app.post("/identify")
async def identify(file: UploadFile = File(...)):
    path = await _write_upload(file)
    try:
        return identify_file(path)
    finally:
        if os.path.exists(path):
            os.unlink(path)


@app.post("/match")
async def match(file: UploadFile = File(...), catalogue: str = Form(...)):
    references = _parse_catalogue(catalogue)
    path = await _write_upload(file)
    try:
        return get_engine().match_file(path, references)
    finally:
        if os.path.exists(path):
            os.unlink(path)
