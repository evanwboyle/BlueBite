import { google, drive_v3 } from "googleapis";
import { serviceAccount } from "./client";

export interface DriveImage {
  data: Buffer;
  contentType: string;
}
export type ImageFetcher = (fileId: string) => Promise<DriveImage>;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
// SVG is excluded on purpose: served from our origin it could carry script.
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

let drive: drive_v3.Drive | null = null;

function getDrive(): drive_v3.Drive {
  if (!drive) {
    const sa = serviceAccount();
    if (!sa) throw new Error("Google credentials are not configured");
    const auth = new google.auth.JWT({
      email: sa.email,
      key: sa.key,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
    drive = google.drive({ version: "v3", auth });
  }
  return drive;
}

/**
 * Reads an image with the service account, so the file only needs to be shared with that account
 * (e.g. share the images folder with it as Viewer). No public link required.
 */
export const fetchFromDrive: ImageFetcher = async (fileId) => {
  const d = getDrive();
  const meta = await d.files.get({ fileId, fields: "mimeType,size", supportsAllDrives: true });
  const contentType = meta.data.mimeType ?? "";
  if (!ALLOWED_TYPES.has(contentType)) throw new Error(`Unsupported image type: ${contentType || "unknown"}`);
  if (Number(meta.data.size ?? 0) > MAX_IMAGE_BYTES) throw new Error("Image is larger than 5 MB");

  const res = await d.files.get({ fileId, alt: "media", supportsAllDrives: true }, { responseType: "arraybuffer" });
  return { data: Buffer.from(res.data as ArrayBuffer), contentType };
};

/**
 * In-memory cache in front of Drive, so a menu grid of images costs one Drive read per image per TTL
 * rather than one per page view. Concurrent requests for the same file share one fetch, and a stale
 * copy is served if Drive fails.
 */
export class DriveImageCache {
  private entries = new Map<string, DriveImage & { fetchedAt: number }>();
  private inFlight = new Map<string, Promise<DriveImage>>();

  constructor(
    private fetcher: ImageFetcher = fetchFromDrive,
    private ttlMs = 60 * 60 * 1000,
    private maxEntries = 200
  ) {}

  async get(fileId: string): Promise<DriveImage> {
    const cached = this.entries.get(fileId);
    if (cached && Date.now() - cached.fetchedAt < this.ttlMs) return cached;

    let pending = this.inFlight.get(fileId);
    if (!pending) {
      pending = this.fetcher(fileId)
        .then((image) => {
          this.entries.delete(fileId);
          this.entries.set(fileId, { ...image, fetchedAt: Date.now() });
          if (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
          return image;
        })
        .finally(() => this.inFlight.delete(fileId));
      this.inFlight.set(fileId, pending);
    }

    try {
      return await pending;
    } catch (error) {
      if (cached) return cached; // stale beats broken
      throw error;
    }
  }
}
