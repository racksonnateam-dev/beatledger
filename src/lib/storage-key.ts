import path from "node:path";

export function storageRoot() {
  return path.resolve(process.env.STORAGE_LOCAL_ROOT || path.join(process.cwd(), "storage"));
}

export function assertSafeStorageKey(key: string) {
  if (!key || key.includes("\0") || path.isAbsolute(key)) {
    throw new Error("Invalid storage key.");
  }
  const normalized = path.posix.normalize(key.replaceAll("\\", "/"));
  if (normalized.startsWith("../") || normalized === ".." || normalized.includes("/../") || normalized.startsWith("/")) {
    throw new Error("Invalid storage key.");
  }
  const root = storageRoot();
  const full = path.resolve(root, normalized);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (full !== root && !full.startsWith(prefix)) {
    throw new Error("Invalid storage key.");
  }
  return { key: normalized, fullPath: full };
}

export function ownedStorageKey(ownerId: string, key: string) {
  const safe = assertSafeStorageKey(key);
  const prefix = `users/${ownerId}/`;
  if (!safe.key.startsWith(prefix)) {
    throw new Error("Storage key is outside this account.");
  }
  return safe;
}
