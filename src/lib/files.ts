import path from "node:path";

const ALLOWED_EXTENSIONS = new Set(["wav", "mp3", "flac", "ogg", "aiff", "aif", "m4a", "aac"]);

export type AudioKind = "wav" | "mp3" | "flac" | "ogg" | "aiff" | "m4a" | "aac";

export function maxUploadBytes() {
  const configured = Number(process.env.MAX_UPLOAD_BYTES ?? 40 * 1024 * 1024);
  if (!Number.isFinite(configured) || configured < 1024) return 40 * 1024 * 1024;
  return configured;
}

export function extensionOf(filename: string) {
  const base = path.basename(filename).toLowerCase();
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1) : "";
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

export function sniffAudio(bytes: Uint8Array): AudioKind | null {
  if (bytes.length < 12) return null;
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE") return "wav";
  if (ascii(bytes, 0, 4) === "FORM" && (ascii(bytes, 8, 4) === "AIFF" || ascii(bytes, 8, 4) === "AIFC")) return "aiff";
  if (ascii(bytes, 0, 4) === "fLaC") return "flac";
  if (ascii(bytes, 0, 4) === "OggS") return "ogg";
  if (ascii(bytes, 0, 3) === "ID3") return "mp3";
  if (ascii(bytes, 4, 4) === "ftyp") return "m4a";
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    const mpegLayer = (bytes[1] >> 1) & 0x03;
    return mpegLayer === 0 ? "aac" : "mp3";
  }
  return null;
}

const EXTENSION_KIND: Record<string, AudioKind> = {
  wav: "wav",
  mp3: "mp3",
  flac: "flac",
  ogg: "ogg",
  aiff: "aiff",
  aif: "aiff",
  m4a: "m4a",
  aac: "aac",
};

export function mimeTypeFor(kind: AudioKind) {
  switch (kind) {
    case "wav":
      return "audio/wav";
    case "mp3":
      return "audio/mpeg";
    case "flac":
      return "audio/flac";
    case "ogg":
      return "audio/ogg";
    case "aiff":
      return "audio/aiff";
    case "m4a":
      return "audio/mp4";
    case "aac":
      return "audio/aac";
  }
}

export function validateAudioUpload(filename: string, bytes: Uint8Array) {
  if (!filename.trim()) return { ok: false as const, error: "Choose an audio file." };
  const extension = extensionOf(filename);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return { ok: false as const, error: "Use WAV, MP3, FLAC, OGG, AIFF, M4A, or AAC." };
  }
  if (bytes.byteLength === 0) return { ok: false as const, error: "The uploaded file is empty." };
  if (bytes.byteLength > maxUploadBytes()) {
    return { ok: false as const, error: "The file exceeds the 40 MB upload limit." };
  }
  const kind = sniffAudio(bytes);
  if (!kind || kind !== EXTENSION_KIND[extension]) {
    return { ok: false as const, error: "The file contents do not match its extension." };
  }
  return { ok: true as const, kind, mimeType: mimeTypeFor(kind), extension };
}
