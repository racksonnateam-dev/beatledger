import {
  parseFingerprint,
  sanitizePlatformReport,
  type FingerprintPayload,
  type PlatformReport,
  interpretMatchResponse,
  type MatchInterpretation,
} from "@/lib/recognition";

export class AudioServiceError extends Error {}

function serviceUrl(pathname: string) {
  const base = process.env.AUDIO_SERVICE_URL || "http://127.0.0.1:8000";
  return `${base.replace(/\/$/, "")}${pathname}`;
}

function fileForm(bytes: Buffer, filename: string) {
  const form = new FormData();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  form.append("file", new Blob([copy]), filename);
  return form;
}

async function readBody(response: Response) {
  return response.json().catch(() => ({}));
}

export async function fingerprintAudio(bytes: Buffer, filename: string): Promise<FingerprintPayload> {
  let response: Response;
  try {
    response = await fetch(serviceUrl("/fingerprint"), {
      method: "POST",
      body: fileForm(bytes, filename),
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    throw new AudioServiceError("Audio service is not reachable. Start the Python service and run fingerprint again.");
  }
  const body = await readBody(response);
  if (!response.ok) {
    const record = body as { error?: string; detail?: string };
    throw new AudioServiceError(record.error || record.detail || "Fingerprinting failed.");
  }
  try {
    return parseFingerprint(body);
  } catch (error) {
    throw new AudioServiceError(error instanceof Error ? error.message : "Fingerprinting failed.");
  }
}

export async function matchAudio(
  bytes: Buffer,
  filename: string,
  catalogue: { beatId: string; hashes: number[][] }[],
): Promise<MatchInterpretation> {
  const form = fileForm(bytes, filename);
  form.append("catalogue", JSON.stringify(catalogue.slice(0, 200)));
  let response: Response;
  try {
    response = await fetch(serviceUrl("/match"), {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    return { kind: "failed", message: "Audio service is not reachable. No comparison was made." };
  }
  const body = await readBody(response);
  return interpretMatchResponse(response.ok, body, "Recognition failed before a comparison could finish.");
}

export async function identifyPlatforms(bytes: Buffer, filename: string): Promise<PlatformReport> {
  try {
    const response = await fetch(serviceUrl("/identify"), {
      method: "POST",
      body: fileForm(bytes, filename),
      signal: AbortSignal.timeout(60_000),
    });
    const body = await readBody(response);
    if (!response.ok) {
      const record = body as { error?: string; detail?: string };
      return {
        status: "failed",
        message: record.error || record.detail || "Song identification failed before a recording could be named.",
        matches: [],
      };
    }
    return sanitizePlatformReport(body);
  } catch {
    return {
      status: "failed",
      message: "Audio service is not reachable. No song was identified.",
      matches: [],
    };
  }
}

export async function engineHealth() {
  try {
    const response = await fetch(serviceUrl("/health"), { cache: "no-store", signal: AbortSignal.timeout(4000) });
    const body = (await readBody(response)) as {
      ok?: boolean;
      engine?: string;
      experimental?: boolean;
      limitations?: string[];
      error?: string;
      platformIdentification?: { configured?: boolean; detail?: string };
    };
    const platformDetail =
      body.platformIdentification?.detail ||
      "Song identification is off until an AudD API token is set on the audio service.";
    if (!response.ok || body.ok === false) {
      return {
        online: false,
        detail: body.error || "Audio service is unavailable.",
        limitations: body.limitations ?? [],
        platformConfigured: false,
        platformDetail,
      };
    }
    return {
      online: true,
      engine: body.engine ?? "unknown",
      experimental: body.experimental !== false,
      limitations: Array.isArray(body.limitations) ? body.limitations : [],
      detail: body.experimental === false ? "Engine is online." : "Experimental engine is online.",
      platformConfigured: body.platformIdentification?.configured === true,
      platformDetail,
    };
  } catch {
    return {
      online: false,
      detail: "Audio service is not reachable on AUDIO_SERVICE_URL.",
      limitations: [],
      platformConfigured: false,
      platformDetail: "Audio service is not reachable, so a recording cannot be identified.",
    };
  }
}
