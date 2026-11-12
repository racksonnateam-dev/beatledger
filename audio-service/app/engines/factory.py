from __future__ import annotations

import os

from app.engines.base import EngineNotConfigured, RecognitionEngine
from app.engines.commercial import CommercialEngine
from app.engines.landmark import LandmarkEngine


def get_engine() -> RecognitionEngine:
    choice = os.getenv("RECOGNITION_ENGINE", "landmark").strip().lower()
    if choice in {"landmark", "landmark-v1"}:
        return LandmarkEngine()
    if choice == "commercial":
        return CommercialEngine()
    raise EngineNotConfigured(
        f"Unknown RECOGNITION_ENGINE '{choice}'. Use 'landmark' or 'commercial'."
    )
