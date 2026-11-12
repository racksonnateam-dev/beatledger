from __future__ import annotations

from typing import Protocol


class EngineNotConfigured(Exception):
    """Raised when a recognition engine cannot run. Callers must not invent a match."""


class AudioDecodeError(Exception):
    """Raised when an upload cannot be decoded as audio."""


class RecognitionEngine(Protocol):
    name: str
    experimental: bool
    limitations: list[str]

    def fingerprint_file(self, path: str) -> dict:
        """Return fingerprint metadata for one audio file."""

    def match_file(self, path: str, catalogue: list[dict]) -> dict:
        """Compare one file with a private catalogue. Return only real matches."""
