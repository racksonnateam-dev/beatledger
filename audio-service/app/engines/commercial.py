from __future__ import annotations

import os

from app.engines.base import EngineNotConfigured


class CommercialEngine:
    """Placeholder for a future commercial recognition provider.

    This class never fabricates matches. Configure RECOGNITION_API_KEY and
    RECOGNITION_API_URL, then implement the provider HTTP client here.
    """

    name = "commercial"
    experimental = False
    limitations = [
        "No commercial provider client is bundled with this build.",
        "Requests fail closed until a real provider is implemented.",
    ]

    def _require_configuration(self) -> None:
        api_key = os.getenv("RECOGNITION_API_KEY", "").strip()
        api_url = os.getenv("RECOGNITION_API_URL", "").strip()
        if not api_key or not api_url:
            raise EngineNotConfigured(
                "Commercial recognition requires RECOGNITION_API_KEY and "
                "RECOGNITION_API_URL on the audio service. No match was performed."
            )
        raise EngineNotConfigured(
            "Commercial recognition credentials are present, but this build has no "
            "provider client. No match was performed. Implement the client in "
            "audio-service/app/engines/commercial.py or set RECOGNITION_ENGINE=landmark."
        )

    def fingerprint_file(self, path: str) -> dict:
        del path
        self._require_configuration()
        raise AssertionError("unreachable")

    def match_file(self, path: str, catalogue: list[dict]) -> dict:
        del path, catalogue
        self._require_configuration()
        raise AssertionError("unreachable")
