from __future__ import annotations

import os
import wave
from collections import defaultdict
from dataclasses import dataclass

import numpy as np

from app.engines.base import AudioDecodeError

ALGORITHM = "landmark-v1"
TARGET_SAMPLE_RATE = 11025
FFT_SIZE = 2048
HOP_SIZE = 512
BANDS = ((0, 40), (40, 80), (80, 120), (120, 180), (180, 280), (280, 513))
FANOUT = 5
MAX_DELTA_FRAMES = 18
MAX_HASHES = 8000
MIN_VOTES = 12
MIN_CONFIDENCE = 0.05
MIN_SECONDS = 0.75

LIMITATIONS = [
    "Experimental landmark fingerprint for a private catalogue. It is not a commercial broadcast monitor.",
    "Uploaded files only. This engine does not scan YouTube, TikTok, or any other platform.",
    "It can miss pitch-shifted, time-stretched, heavily mixed, or strongly processed audio.",
    "Scores below the acceptance threshold return no match. The engine never invents a match.",
    "Chromaprint was not selected. It is built to look up a whole recording in the public AcoustID database, needs an API key, and does not give a time offset inside a private catalogue.",
    "audfprint can search a private database and report an offset, but the project is an older research codebase and is awkward to ship. This engine uses the same landmark idea (spectral peaks paired across time) behind a replaceable interface.",
]


@dataclass(frozen=True)
class Alignment:
    votes: int
    confidence: float
    offset_frames: int
    second_votes: int

    @property
    def match_timestamp(self) -> float:
        if self.offset_frames <= 0:
            return 0.0
        return round(self.offset_frames * HOP_SIZE / TARGET_SAMPLE_RATE, 3)

    @property
    def query_offset(self) -> float:
        if self.offset_frames >= 0:
            return 0.0
        return round(abs(self.offset_frames) * HOP_SIZE / TARGET_SAMPLE_RATE, 3)


def _load_wav(path: str) -> tuple[np.ndarray, int]:
    try:
        handle = wave.open(path, "rb")
    except (wave.Error, EOFError, FileNotFoundError) as exc:
        raise AudioDecodeError("Could not read this WAV file.") from exc
    with handle:
        sample_rate = handle.getframerate()
        channels = handle.getnchannels()
        width = handle.getsampwidth()
        frames = handle.readframes(handle.getnframes())
    if sample_rate <= 0 or not frames:
        raise AudioDecodeError("The audio file is empty.")
    if width == 2:
        samples = np.frombuffer(frames, dtype="<i2").astype(np.float32) / 32768.0
    elif width == 1:
        samples = (np.frombuffer(frames, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
    elif width == 3:
        raw = np.frombuffer(frames, dtype=np.uint8)
        if raw.size % 3 != 0:
            raise AudioDecodeError("The WAV frame data is truncated.")
        triples = raw.reshape(-1, 3)
        integers = (
            triples[:, 0].astype(np.int32)
            | (triples[:, 1].astype(np.int32) << 8)
            | (triples[:, 2].astype(np.int32) << 16)
        )
        integers = np.where(integers >= 0x800000, integers - 0x1000000, integers)
        samples = integers.astype(np.float32) / 8388608.0
    elif width == 4:
        samples = np.frombuffer(frames, dtype="<i4").astype(np.float32) / 2147483648.0
    else:
        raise AudioDecodeError("This WAV sample width is not supported.")
    if channels > 1:
        usable = samples.size - (samples.size % channels)
        samples = samples[:usable].reshape(-1, channels).mean(axis=1)
    return np.ascontiguousarray(samples, dtype=np.float32), sample_rate


def _load_with_miniaudio(path: str) -> tuple[np.ndarray, int]:
    try:
        import miniaudio
    except ImportError as exc:
        raise AudioDecodeError(
            "Decoding this format needs the miniaudio package in the audio service."
        ) from exc
    try:
        decoded = miniaudio.decode_file(
            path,
            output_format=miniaudio.SampleFormat.FLOAT32,
            nchannels=1,
            sample_rate=TARGET_SAMPLE_RATE,
        )
    except Exception as exc:  # miniaudio raises its own decode errors
        raise AudioDecodeError("Could not decode this audio file.") from exc
    samples = np.asarray(decoded.samples, dtype=np.float32)
    if samples.size == 0:
        raise AudioDecodeError("The audio file is empty.")
    return samples, int(decoded.sample_rate or TARGET_SAMPLE_RATE)


def load_audio(path: str) -> tuple[np.ndarray, int]:
    extension = os.path.splitext(path)[1].lower()
    if extension == ".wav":
        return _load_wav(path)
    if extension in {".mp3", ".flac", ".ogg", ".aiff", ".aif", ".m4a", ".aac"}:
        return _load_with_miniaudio(path)
    raise AudioDecodeError("Use WAV, MP3, FLAC, OGG, AIFF, or M4A.")


def resample(samples: np.ndarray, sample_rate: int, target_rate: int = TARGET_SAMPLE_RATE) -> np.ndarray:
    if sample_rate == target_rate or samples.size == 0:
        return samples.astype(np.float32, copy=False)
    target_length = max(1, int(round(samples.size * target_rate / sample_rate)))
    source_x = np.linspace(0.0, 1.0, samples.size, endpoint=False)
    target_x = np.linspace(0.0, 1.0, target_length, endpoint=False)
    return np.interp(target_x, source_x, samples).astype(np.float32)


def _spectrogram(samples: np.ndarray) -> np.ndarray:
    if samples.size < FFT_SIZE:
        raise AudioDecodeError("Audio is too short to fingerprint.")
    window = np.hanning(FFT_SIZE).astype(np.float32)
    frames = []
    for start in range(0, samples.size - FFT_SIZE + 1, HOP_SIZE):
        frame = samples[start : start + FFT_SIZE] * window
        frames.append(np.abs(np.fft.rfft(frame)))
    if not frames:
        raise AudioDecodeError("Audio is too short to fingerprint.")
    return np.stack(frames, axis=1)


def _peaks(spec: np.ndarray) -> list[tuple[int, int]]:
    peaks: list[tuple[int, int]] = []
    times = spec.shape[1]
    for time_index in range(times):
        column = spec[:, time_index]
        column_max = float(np.max(column)) + 1e-12
        for start, end in BANDS:
            segment = column[start:end]
            if segment.size == 0:
                continue
            local = int(np.argmax(segment))
            bin_index = start + local
            magnitude = float(column[bin_index])
            if magnitude < column_max * 0.12:
                continue
            if time_index > 0 and magnitude < float(spec[bin_index, time_index - 1]):
                continue
            if time_index + 1 < times and magnitude < float(spec[bin_index, time_index + 1]):
                continue
            peaks.append((time_index, bin_index // 2))
    return peaks


def _hashes_from_peaks(peaks: list[tuple[int, int]]) -> list[list[int]]:
    hashes: list[list[int]] = []
    for index, (time_a, freq_a) in enumerate(peaks):
        emitted = 0
        for time_b, freq_b in peaks[index + 1 : index + 48]:
            delta = time_b - time_a
            if delta <= 0:
                continue
            if delta > MAX_DELTA_FRAMES:
                break
            if freq_a == freq_b and delta < 2:
                continue
            hashes.append([int(freq_a), int(freq_b), int(delta), int(time_a)])
            emitted += 1
            if emitted >= FANOUT:
                break
    if len(hashes) > MAX_HASHES:
        step = len(hashes) / MAX_HASHES
        hashes = [hashes[int(i * step)] for i in range(MAX_HASHES)]
    return hashes


def fingerprint_samples(samples: np.ndarray, sample_rate: int) -> dict:
    duration = float(samples.size) / float(sample_rate) if sample_rate else 0.0
    if duration < MIN_SECONDS:
        raise AudioDecodeError("Audio is too short to fingerprint. Use at least one second.")
    rendered = resample(np.asarray(samples, dtype=np.float32), sample_rate)
    if float(np.max(np.abs(rendered))) < 1e-4:
        return _payload(duration, [])
    spec = _spectrogram(rendered)
    return _payload(duration, _hashes_from_peaks(_peaks(spec)))


def _payload(duration: float, hashes: list[list[int]]) -> dict:
    return {
        "algorithm": ALGORITHM,
        "experimental": True,
        "durationSeconds": round(duration, 3),
        "sampleRate": TARGET_SAMPLE_RATE,
        "hopSize": HOP_SIZE,
        "hashCount": len(hashes),
        "hashes": hashes,
    }


def fingerprint_file(path: str) -> dict:
    samples, sample_rate = load_audio(path)
    return fingerprint_samples(samples, sample_rate)


def best_alignment(query_hashes: list, reference_hashes: list) -> Alignment | None:
    if not query_hashes or not reference_hashes:
        return None
    index: dict[tuple[int, int, int], list[int]] = defaultdict(list)
    for item in reference_hashes:
        if not isinstance(item, (list, tuple)) or len(item) < 4:
            continue
        freq_a, freq_b, delta, anchor = (int(item[0]), int(item[1]), int(item[2]), int(item[3]))
        index[(freq_a, freq_b, delta)].append(anchor)

    histogram: dict[int, int] = defaultdict(int)
    used = 0
    for item in query_hashes:
        if not isinstance(item, (list, tuple)) or len(item) < 4:
            continue
        freq_a, freq_b, delta, anchor = (int(item[0]), int(item[1]), int(item[2]), int(item[3]))
        used += 1
        seen: set[int] = set()
        for fuzz in (delta - 1, delta, delta + 1):
            if fuzz <= 0:
                continue
            for reference_time in index.get((freq_a, freq_b, fuzz), ()):
                offset = reference_time - anchor
                if offset in seen:
                    continue
                seen.add(offset)
                histogram[offset] += 1
    if used == 0 or not histogram:
        return None
    ranked = sorted(histogram.items(), key=lambda pair: (pair[1], -abs(pair[0])), reverse=True)
    best_votes = ranked[0][1]
    tied = [pair for pair in ranked if pair[1] == best_votes]
    offset, votes = min(tied, key=lambda pair: abs(pair[0]))
    second_votes = next((votes_ for _, votes_ in ranked if votes_ < best_votes), 0)
    return Alignment(
        votes=votes,
        confidence=votes / used,
        offset_frames=offset,
        second_votes=second_votes,
    )


def alignment_is_accepted(alignment: Alignment) -> bool:
    # A nearby offset can collect almost as many votes when the beat is periodic.
    # Absolute votes and confidence separate a real alignment from a chance collision.
    if alignment.votes < MIN_VOTES or alignment.confidence < MIN_CONFIDENCE:
        return False
    if alignment.second_votes and alignment.votes <= alignment.second_votes:
        return False
    return True


def match_fingerprints(query: dict, catalogue: list[dict]) -> dict:
    query_hashes = query.get("hashes") or []
    matches = []
    for entry in catalogue:
        alignment = best_alignment(query_hashes, entry.get("hashes") or [])
        if alignment is None or not alignment_is_accepted(alignment):
            continue
        matches.append(
            {
                "beatId": str(entry.get("beatId")),
                "confidence": round(alignment.confidence, 4),
                "votes": alignment.votes,
                "offsetFrames": alignment.offset_frames,
                "matchTimestamp": alignment.match_timestamp,
                "queryOffset": alignment.query_offset,
            }
        )
    matches.sort(key=lambda item: (item["votes"], item["confidence"]), reverse=True)
    return {
        "algorithm": ALGORITHM,
        "experimental": True,
        "queryHashCount": len(query_hashes),
        "matches": matches[:5],
    }


class LandmarkEngine:
    name = ALGORITHM
    experimental = True
    limitations = LIMITATIONS

    def fingerprint_file(self, path: str) -> dict:
        return fingerprint_file(path)

    def match_file(self, path: str, catalogue: list[dict]) -> dict:
        query = fingerprint_file(path)
        return match_fingerprints(query, catalogue)
