import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ALLOWED_IMAGE = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED = new Set([...ALLOWED_IMAGE, "application/pdf"]);
const MAX_BYTES = 10 * 1024 * 1024;

export function validateDoc(mime: string, size: number): string | null {
  if (!ALLOWED.has(mime)) return "Only JPG, PNG, WebP photos or PDF documents are allowed.";
  if (size > MAX_BYTES) return "File is too large — please use a file under 10MB.";
  return null;
}

function extFor(mime: string, original: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/jpeg") return "jpg";
  const ext = original.split(".").pop()?.toLowerCase() ?? "";
  return ext.length <= 5 && ext.length > 0 ? ext : "jpg";
}

/**
 * Web-ready processing for images: honor EXIF orientation, cap at 1600px,
 * quality-80 compression, metadata (incl. GPS tags) stripped by default.
 * PDFs pass through untouched.
 */
export async function processDoc(
  buf: Buffer,
  mime: string,
): Promise<{ buffer: Buffer; mime: string }> {
  if (mime === "application/pdf") return { buffer: buf, mime };
  let pipeline = sharp(buf).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true });
  if (mime === "image/png") {
    pipeline = pipeline.png({ quality: 80, compressionLevel: 9 });
  } else if (mime === "image/webp") {
    pipeline = pipeline.webp({ quality: 80 });
  } else {
    pipeline = pipeline.jpeg({ quality: 80 });
    mime = "image/jpeg";
  }
  return { buffer: await pipeline.toBuffer(), mime };
}

/** Store a verification document (compressed first for images). Returns a repo-relative path. */
export async function storeVerificationDoc(
  buf: Buffer,
  mime: string,
  originalName: string,
  ownerId: string,
): Promise<string> {
  const err = validateDoc(mime, buf.length);
  if (err) throw new Error(err);
  const done = await processDoc(buf, mime);
  const dir = join(process.cwd(), "uploads", "verification", ownerId);
  mkdirSync(dir, { recursive: true });
  const file = `${randomUUID()}.${extFor(done.mime, originalName)}`;
  writeFileSync(join(dir, file), done.buffer);
  return join("uploads", "verification", ownerId, file);
}

export const uploadLimits = { maxBytes: MAX_BYTES, allowed: [...ALLOWED] };
