# BeatLedger

BeatLedger is a private catalogue for independent producers. It registers beats, compares uploaded audio against that catalogue, and records who licensed a beat and whether the payment was marked paid.

A missing payment is shown as **Unverified license**. It is not labeled as copyright infringement.

## Stack

- Next.js App Router, TypeScript, Tailwind, and shadcn-style UI primitives
- Prisma and PostgreSQL
- A Python FastAPI audio service with a replaceable recognition engine
- Local file storage, with an Azure Blob adapter reserved behind `STORAGE_DRIVER=azure`

## Recognition

The audio service uses `landmark-v1`, an experimental private-catalogue fingerprint. See [audio-service/ENGINE.md](audio-service/ENGINE.md) for why Chromaprint and audfprint were not shipped, and for the limits of the matcher.

The engine only returns a match when landmark votes clear a fixed threshold. It never invents a result. Uploaded files only: it does not read YouTube, TikTok, or the public web.

To use a commercial provider later, set these on the **audio service** (not in browser code):

```
RECOGNITION_ENGINE=commercial
RECOGNITION_API_KEY=
RECOGNITION_API_URL=
```

Until a provider client is added in `audio-service/app/engines/commercial.py`, that mode fails closed and returns no match.

## Setup

Requirements: Node.js 22, Python 3.9+, and PostgreSQL 16. Docker is optional. This repo can also start a local Postgres with `npm run db:start` (downloads Postgres the first time).

```bash
cp .env.example .env
python3 -m venv audio-service/.venv
audio-service/.venv/bin/pip install -r audio-service/requirements.txt
npm install
npm run db:start
npx prisma migrate dev --name init
npm run db:seed
```

If you already run Postgres yourself, point `DATABASE_URL` at it and skip `npm run db:start`. With Docker:

```bash
docker compose up -d
```

The compose file publishes Postgres on port **54329**, matching `.env.example`.

Demo account after seeding:

- Email: `demo@beatledger.app`
- Password: `DemoBeatledger!2026`

## Run

Use two terminals.

```bash
npm run audio:dev
npm run dev
```

The site is at [http://localhost:3000](http://localhost:3000). The audio service listens on `127.0.0.1:8000`.

## Tests

```bash
npm test
npm run test:audio
npm run build
```

## Security notes

- Passwords are hashed with bcrypt. The session cookie is HTTP-only.
- Audio is stored outside `public/` and streamed only after an ownership check.
- Catalogue queries always include `ownerId`.
- Recognition requests are rate limited per account.
- `AUDIO_SERVICE_URL`, `AUTH_SECRET`, and any recognition API key stay on the server.
