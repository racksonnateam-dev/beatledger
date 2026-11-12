import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertSafeStorageKey } from "@/lib/storage-key";

export interface ObjectStorage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

class LocalStorage implements ObjectStorage {
  async put(key: string, data: Buffer) {
    const { fullPath } = assertSafeStorageKey(key);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, data);
  }

  async get(key: string) {
    const { fullPath } = assertSafeStorageKey(key);
    return readFile(fullPath);
  }

  async remove(key: string) {
    const { fullPath } = assertSafeStorageKey(key);
    await rm(fullPath, { force: true });
  }
}

class AzureBlobStorage implements ObjectStorage {
  constructor(
    private readonly connectionString: string,
    private readonly container: string,
  ) {}

  private unavailable(): never {
    if (!this.connectionString || !this.container) {
      throw new Error("Azure Blob storage requires AZURE_STORAGE_CONNECTION_STRING and AZURE_BLOB_CONTAINER.");
    }
    throw new Error(
      "The Azure Blob adapter is reserved for a later release. Install @azure/storage-blob and implement AzureBlobStorage, or set STORAGE_DRIVER=local.",
    );
  }

  async put(): Promise<void> {
    this.unavailable();
  }

  async get(): Promise<Buffer> {
    this.unavailable();
  }

  async remove(): Promise<void> {
    this.unavailable();
  }
}

export function getStorage(): ObjectStorage {
  const driver = (process.env.STORAGE_DRIVER || "local").toLowerCase();
  if (driver === "local") return new LocalStorage();
  if (driver === "azure") {
    return new AzureBlobStorage(
      process.env.AZURE_STORAGE_CONNECTION_STRING || "",
      process.env.AZURE_BLOB_CONTAINER || "",
    );
  }
  throw new Error(`Unknown STORAGE_DRIVER "${driver}". Use local or azure.`);
}
