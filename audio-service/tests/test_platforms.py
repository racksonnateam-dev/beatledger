import json

import pytest

from app.engines.platforms import identify_file, parse_audd_payload


SPOTIFY = "https://open.spotify.com/track/abc"
APPLE = "https://music.apple.com/us/album/song/123?i=456"


def test_missing_token_returns_no_song(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("RECOGNITION_API_KEY", raising=False)
    report = identify_file("unused.wav")
    assert report["configured"] is False
    assert report["status"] == "not_configured"
    assert report["matches"] == []


def test_audd_success_keeps_spotify_and_apple_links():
    report = parse_audd_payload(
        {
            "status": "success",
            "result": {
                "artist": "Sample Artist",
                "title": "Sample Song",
                "album": "Sample Album",
                "timecode": "00:12",
                "song_link": "https://song.link/i/123",
                "spotify": {"external_urls": {"spotify": SPOTIFY}},
                "apple_music": {"url": APPLE},
            },
        }
    )
    assert report["status"] == "matched"
    links = {item["platform"]: item["url"] for item in report["matches"][0]["links"]}
    assert links["Spotify"] == SPOTIFY
    assert links["Apple Music"] == APPLE
    assert links["Songlink"] == "https://song.link/i/123"


def test_enterprise_chunks_keep_unique_songs_and_songlink():
    report = parse_audd_payload(
        {
            "status": "success",
            "result": [
                {
                    "offset": "00:00",
                    "songs": [
                        {"title": "Цветы", "artist": "luvdakash", "album": "Цветы", "song_link": "https://lis.tn/dXlcAR"},
                        {"title": "if can say", "artist": "Artixx", "song_link": "https://evil.example/nope"},
                    ],
                },
                {"offset": "00:12", "songs": [{"title": "Цветы", "artist": "luvdakash", "song_link": "https://lis.tn/dXlcAR"}]},
            ],
        }
    )
    assert report["status"] == "matched"
    assert [(item["title"], item["timecode"]) for item in report["matches"]] == [("Цветы", "00:00"), ("if can say", "00:00")]
    assert report["matches"][0]["links"] == [{"platform": "Songlink", "url": "https://lis.tn/dXlcAR"}]
    assert report["matches"][1]["links"] == []


def test_audd_does_not_keep_a_song_from_an_error_or_a_foreign_url():
    failed = parse_audd_payload({"status": "error", "error": {"error_message": "token is invalid"}})
    assert failed["status"] == "failed"
    assert failed["matches"] == []
    empty = parse_audd_payload({"status": "success", "result": None})
    assert empty["status"] == "no_match"
    assert empty["matches"] == []
    dirty = parse_audd_payload(
        {
            "status": "success",
            "result": {
                "title": "Sample Song",
                "artist": "Sample Artist",
                "spotify": {"external_urls": {"spotify": "javascript:alert(1)"}},
                "apple_music": {"url": "https://evil.example/track"},
            },
        }
    )
    assert dirty["matches"][0]["links"] == []


def test_identify_route_without_token(monkeypatch: pytest.MonkeyPatch):
    from fastapi.testclient import TestClient
    from app.main import app

    monkeypatch.delenv("RECOGNITION_API_KEY", raising=False)

    client = TestClient(app)
    response = client.post("/identify", files={"file": ("clip.wav", b"RIFFxxxxWAVE", "audio/wav")})
    assert response.status_code == 200
    body = response.json()
    assert body["matches"] == []
    assert body["status"] == "not_configured"
    assert "audd" in json.dumps(body).lower() or body["provider"] == "audd"
