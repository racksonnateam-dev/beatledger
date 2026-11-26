from __future__ import annotations

import json
import os
from urllib.parse import urlparse

import httpx

PROVIDER = "audd"
STANDARD_URL = "https://api.audd.io/"
ENTERPRISE_URL = "https://enterprise.audd.io/"
# AudD bills the long-file lookup as one request per 12 seconds. 20 chunks is the first 4 minutes.
MAX_CHUNKS = 20
ALLOWED_HOSTS = {
    "open.spotify.com": "Spotify",
    "music.apple.com": "Apple Music",
    "song.link": "Songlink",
    "www.song.link": "Songlink",
    "lis.tn": "Songlink",
}

NOT_CONFIGURED_MESSAGE = (
    "Song identification is off. Add an AudD API token as RECOGNITION_API_KEY on the audio service. "
    "AudD names a known recording from the audio, the way Shazam does, and can include Spotify and Apple Music links. "
    "BeatLedger does not search those catalogs itself, and it will not invent a song."
)


def is_configured() -> bool:
    return bool(os.getenv("RECOGNITION_API_KEY", "").strip())


def configuration_message() -> str:
    if is_configured():
        return "AudD is configured. A scan checks the uploaded file in 12-second pieces, up to the first 4 minutes, and shows a song only when AudD names it."
    return NOT_CONFIGURED_MESSAGE


def _report(status: str, message: str, matches: list[dict] | None = None, configured: bool | None = None) -> dict:
    return {
        "configured": is_configured() if configured is None else configured,
        "provider": PROVIDER,
        "status": status,
        "message": message,
        "matches": matches or [],
    }


def _allowed_link(url: object) -> dict | None:
    if not isinstance(url, str) or not url.startswith("https://"):
        return None
    host = (urlparse(url).hostname or "").lower()
    platform = ALLOWED_HOSTS.get(host)
    if platform is None:
        return None
    return {"platform": platform, "url": url}


def _text(value: object, limit: int = 200) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = " ".join(value.split())
    if not cleaned:
        return None
    return cleaned[:limit]


def _links_from_result(result: dict) -> list[dict]:
    found: list[dict] = []
    seen: set[str] = set()
    candidates = [
        ((result.get("spotify") or {}) if isinstance(result.get("spotify"), dict) else {}).get("external_urls", {}),
        result.get("apple_music"),
        result.get("song_link"),
    ]
    urls: list[object] = []
    spotify_urls = candidates[0]
    if isinstance(spotify_urls, dict):
        urls.append(spotify_urls.get("spotify"))
    apple = candidates[1]
    if isinstance(apple, dict):
        urls.append(apple.get("url"))
    urls.append(candidates[2])
    for url in urls:
        link = _allowed_link(url)
        if link is None or link["url"] in seen:
            continue
        seen.add(link["url"])
        found.append(link)
    return found


def _match_from_song(song: dict, heard_at: str | None) -> dict | None:
    title = _text(song.get("title"))
    artist = _text(song.get("artist"))
    links = _links_from_result(song)
    if not title and not artist and not links:
        return None
    return {
        "title": title,
        "artist": artist,
        "album": _text(song.get("album")),
        "timecode": heard_at,
        "links": links,
    }


def _collect_matches(result: object) -> list[dict]:
    songs: list[tuple[dict, str | None]] = []
    if isinstance(result, dict):
        songs.append((result, _text(result.get("timecode"), 16)))
    elif isinstance(result, list):
        for chunk in result:
            if not isinstance(chunk, dict):
                continue
            heard_at = _text(chunk.get("offset"), 16)
            chunk_songs = chunk.get("songs")
            if not isinstance(chunk_songs, list):
                continue
            for song in chunk_songs:
                if isinstance(song, dict):
                    songs.append((song, heard_at))
    matches: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for song, heard_at in songs:
        match = _match_from_song(song, heard_at)
        if match is None:
            continue
        key = ((match["title"] or "").casefold(), (match["artist"] or "").casefold())
        if key in seen:
            continue
        seen.add(key)
        matches.append(match)
    return matches


def parse_audd_payload(payload: object) -> dict:
    if not isinstance(payload, dict):
        return _report("failed", "The identification service returned an unreadable response. No song was returned.", configured=True)
    if payload.get("status") == "error":
        error = payload.get("error")
        detail = error.get("error_message") if isinstance(error, dict) else None
        message = _text(detail) or "The identification service rejected the request. No song was returned."
        return _report("failed", message, configured=True)
    result = payload.get("result")
    if result is None or result == []:
        return _report("no_match", "No released recording was recognized in this audio.", configured=True)
    if not isinstance(result, (dict, list)):
        return _report("failed", "The identification service returned an unreadable song. No song was returned.", configured=True)
    matches = _collect_matches(result)
    if not matches:
        return _report("no_match", "No released recording was recognized in this audio.", configured=True)
    return _report("matched", "Identified a released recording.", matches, configured=True)


def _identify_url() -> str:
    configured = os.getenv("RECOGNITION_API_URL", "").strip()
    if not configured or configured.rstrip("/") == STANDARD_URL.rstrip("/"):
        return ENTERPRISE_URL
    return configured


def _chunk_limit(path: str) -> tuple[int, bool]:
    try:
        import miniaudio

        seconds = float(miniaudio.decode_file(path).duration)
    except Exception:
        return MAX_CHUNKS, False
    needed = max(1, int((seconds + 11.999) // 12))
    return min(needed, MAX_CHUNKS), needed > MAX_CHUNKS


def identify_file(path: str) -> dict:
    if not is_configured():
        return _report("not_configured", NOT_CONFIGURED_MESSAGE, configured=False)
    api_url = _identify_url()
    api_key = os.environ["RECOGNITION_API_KEY"].strip()
    form = {"api_token": api_key, "return": "apple_music,spotify"}
    capped = False
    if api_url.rstrip("/") == ENTERPRISE_URL.rstrip("/"):
        limit, capped = _chunk_limit(path)
        form["limit"] = str(limit)
    try:
        with open(path, "rb") as handle:
            response = httpx.post(
                api_url,
                data=form,
                files={"file": (os.path.basename(path), handle, "application/octet-stream")},
                timeout=90.0,
            )
    except httpx.HTTPError:
        return _report("failed", "The identification service could not be reached. No song was returned.", configured=True)
    try:
        payload = response.json()
    except json.JSONDecodeError:
        return _report("failed", "The identification service returned an unreadable response. No song was returned.", configured=True)
    if response.status_code >= 400 and (not isinstance(payload, dict) or payload.get("status") != "error"):
        return _report("failed", "The identification service rejected the request. No song was returned.", configured=True)
    report = parse_audd_payload(payload)
    if capped and report["status"] == "matched":
        report["message"] = "Identified a released recording in the first 4 minutes of this file."
    elif capped and report["status"] == "no_match":
        report["message"] = "No released recording was recognized in the first 4 minutes of this file."
    return report
