import json
import wave
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.engines.base import AudioDecodeError, EngineNotConfigured
from app.engines.commercial import CommercialEngine
from app.engines.landmark import (
    best_alignment,
    fingerprint_file,
    fingerprint_samples,
    match_fingerprints,
)
from app.main import app


def synth_track(seed: int, seconds: float = 8.0, sample_rate: int = 11025) -> np.ndarray:
    rng = np.random.default_rng(seed)
    count = int(seconds * sample_rate)
    audio = np.zeros(count, dtype=np.float64)
    frequencies = rng.uniform(140, 980, size=16)
    event_times = np.sort(rng.uniform(0.05, seconds - 0.2, size=52))
    for index, event_time in enumerate(event_times):
        frequency = float(frequencies[index % len(frequencies)])
        start = int(event_time * sample_rate)
        length = int(0.16 * sample_rate)
        timeline = np.arange(length) / sample_rate
        envelope = np.exp(-7.0 * timeline)
        tone = np.sin(2 * np.pi * frequency * timeline) * envelope
        overtone = np.sin(2 * np.pi * frequency * 2.02 * timeline) * envelope * 0.35
        end = min(count, start + length)
        audio[start:end] += (tone + overtone)[: end - start]
    peak = float(np.max(np.abs(audio))) or 1.0
    return (audio / peak * 0.85).astype(np.float32)


def write_wav(path: Path, samples: np.ndarray, sample_rate: int) -> None:
    pcm = np.clip(samples, -1, 1)
    integers = (pcm * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(sample_rate)
        handle.writeframes(integers.tobytes())


def test_identical_audio_aligns_at_zero(tmp_path: Path):
    path = tmp_path / "same.wav"
    write_wav(path, synth_track(7), 11025)
    fingerprint = fingerprint_file(str(path))
    alignment = best_alignment(fingerprint["hashes"], fingerprint["hashes"])
    assert alignment is not None
    assert alignment.offset_frames == 0
    assert alignment.votes >= 12
    assert fingerprint["experimental"] is True
    assert fingerprint["algorithm"] == "landmark-v1"


def test_partial_clip_reports_timestamp(tmp_path: Path):
    sample_rate = 11025
    full = synth_track(11, seconds=8)
    clip = full[int(3 * sample_rate) : int(5.6 * sample_rate)]
    full_path = tmp_path / "full.wav"
    clip_path = tmp_path / "clip.wav"
    write_wav(full_path, full, sample_rate)
    write_wav(clip_path, clip, sample_rate)
    reference = fingerprint_file(str(full_path))
    query = fingerprint_file(str(clip_path))
    result = match_fingerprints(query, [{"beatId": "beat_1", "hashes": reference["hashes"]}])
    assert result["matches"], best_alignment(query["hashes"], reference["hashes"])
    match = result["matches"][0]
    assert match["beatId"] == "beat_1"
    assert match["matchTimestamp"] == pytest.approx(3.0, abs=0.55)
    assert 0 < match["confidence"] <= 1


def test_different_audio_does_not_match(tmp_path: Path):
    first = tmp_path / "a.wav"
    second = tmp_path / "b.wav"
    write_wav(first, synth_track(3), 11025)
    write_wav(second, synth_track(9), 11025)
    reference = fingerprint_file(str(first))
    query = fingerprint_file(str(second))
    result = match_fingerprints(query, [{"beatId": "beat_a", "hashes": reference["hashes"]}])
    assert result["matches"] == []


def test_silence_and_short_audio_do_not_fabricate_matches():
    silence = np.zeros(11025 * 2, dtype=np.float32)
    fingerprint = fingerprint_samples(silence, 11025)
    assert fingerprint["hashes"] == []
    assert match_fingerprints(fingerprint, [{"beatId": "x", "hashes": [[1, 2, 3, 4]]}])["matches"] == []
    with pytest.raises(AudioDecodeError):
        fingerprint_samples(np.ones(1000, dtype=np.float32), 11025)


def test_commercial_engine_fails_closed(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("RECOGNITION_API_KEY", raising=False)
    monkeypatch.delenv("RECOGNITION_API_URL", raising=False)
    engine = CommercialEngine()
    with pytest.raises(EngineNotConfigured):
        engine.fingerprint_file("ignored.wav")
    monkeypatch.setenv("RECOGNITION_API_KEY", "test-key")
    monkeypatch.setenv("RECOGNITION_API_URL", "https://example.invalid")
    with pytest.raises(EngineNotConfigured, match="no provider client"):
        engine.match_file("ignored.wav", [])


def test_http_contract_returns_real_match_only(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("RECOGNITION_ENGINE", "landmark")
    sample_rate = 11025
    track = synth_track(5, seconds=6)
    reference_path = tmp_path / "ref.wav"
    clip_path = tmp_path / "clip.wav"
    other_path = tmp_path / "other.wav"
    write_wav(reference_path, track, sample_rate)
    write_wav(clip_path, track[int(1.5 * sample_rate) : int(4.2 * sample_rate)], sample_rate)
    write_wav(other_path, synth_track(8, seconds=4), sample_rate)
    client = TestClient(app)

    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["experimental"] is True
    assert health.json()["engine"] == "landmark-v1"

    fingerprinted = client.post("/fingerprint", files={"file": ("ref.wav", reference_path.read_bytes(), "audio/wav")})
    assert fingerprinted.status_code == 200
    body = fingerprinted.json()
    assert body["hashCount"] > 0
    catalogue = json.dumps([{"beatId": "beat_http", "hashes": body["hashes"]}])

    matched = client.post(
        "/match",
        files={"file": ("clip.wav", clip_path.read_bytes(), "audio/wav")},
        data={"catalogue": catalogue},
    )
    assert matched.status_code == 200
    assert matched.json()["matches"][0]["beatId"] == "beat_http"

    missed = client.post(
        "/match",
        files={"file": ("other.wav", other_path.read_bytes(), "audio/wav")},
        data={"catalogue": catalogue},
    )
    assert missed.status_code == 200
    assert missed.json()["matches"] == []

    failed = client.post("/fingerprint", files={"file": ("notes.txt", b"not audio", "text/plain")})
    assert failed.status_code == 400
