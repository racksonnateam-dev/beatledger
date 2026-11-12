from __future__ import annotations

import json
import sys

from app.engines.base import AudioDecodeError, EngineNotConfigured
from app.engines.landmark import fingerprint_file, match_fingerprints


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    try:
        if len(args) == 2 and args[0] == "fingerprint":
            print(json.dumps(fingerprint_file(args[1])))
            return 0
        if len(args) == 3 and args[0] == "match":
            query = fingerprint_file(args[1])
            with open(args[2], "r", encoding="utf-8") as handle:
                catalogue = json.load(handle)
            print(json.dumps(match_fingerprints(query, catalogue)))
            return 0
    except (AudioDecodeError, EngineNotConfigured, OSError, json.JSONDecodeError) as exc:
        print(str(exc), file=sys.stderr)
        return 1
    print("Usage: python -m app.cli fingerprint FILE | python -m app.cli match FILE CATALOGUE.json", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
