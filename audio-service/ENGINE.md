# Recognition engine

BeatLedger keeps recognition behind `RecognitionEngine` in `app/engines/base.py`. The Next.js app talks only to this service. It does not embed an API key and it does not invent matches.

## What was considered

**Chromaprint (fpcalc) plus AcoustID.** Chromaprint summarizes a whole recording so AcoustID can identify it in a public database. That requires an AcoustID application key, does not host a producer's private catalogue, and does not return the time offset of a partial clip. It is the wrong tool for "where inside my beat did this upload line up?"

**audfprint.** Dan Ellis's audfprint builds a private landmark database and can report a time offset, including for a short excerpt. It is a research project with an older Python codebase, so it is a poor dependency to ship inside this MVP.

## What this build uses

`landmark-v1` is a small private-catalogue implementation of the same landmark idea: spectral peaks, hashed in pairs with the time between them, then aligned by offset vote. A result is returned only when the vote count, confidence, and separation from the next-best offset all clear fixed thresholds. Otherwise the service returns an empty match list.

The engine is marked **experimental** on the health endpoint and in every fingerprint payload.

## Limitations

- Uploaded files only. Nothing is pulled from YouTube, TikTok, or the web.
- Pitch shift, time stretch, heavy mixing, and short or noisy clips can miss.
- A miss is "no match", not a claim that the audio is original.
- A catalogue hit with no paid license is **not** an infringement finding. The web app shows "Unverified license".

## Commercial provider later

Catalogue matching stays on `landmark-v1`. `POST /identify` is the Shazam-style path: with `RECOGNITION_API_KEY` set to an AudD token, that route sends the uploaded file to AudD's long-file endpoint and returns a song only when AudD recognizes it. AudD's short endpoint only hears the first 12 seconds, which missed songs in a full beat. The scan checks 12-second pieces, up to the first 4 minutes.

`RECOGNITION_ENGINE=commercial` still has no catalogue client. Those catalogue requests fail with HTTP 503 and an empty match list.
