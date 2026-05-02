import { buildAssetKey, currentStorage } from "@/storage";
import type { PutResult } from "@/storage";
import { encode as encodeBlurhash } from "blurhash";
import sharp from "sharp";

export type VariantSize = "thumb" | "small" | "medium" | "large";
export type VariantFormat = "avif" | "webp";

export type ImageVariant = {
  key: string;
  url: string;
  w: number;
  h: number;
  size: number;
  format: VariantFormat | "original";
};

export type ProcessedImage = {
  width: number;
  height: number;
  mime: string;
  size: number;
  blurhash: string;
  dominantColor: string;
  hasTransparency: boolean;
  variants: {
    original: ImageVariant;
    sizes: Partial<Record<VariantSize, Partial<Record<VariantFormat, ImageVariant>>>>;
  };
};

const SIZE_WIDTHS: Record<VariantSize, number> = {
  thumb: 160,
  small: 480,
  medium: 1024,
  large: 2048,
};

const SUPPORTED_INPUT_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/tiff",
]);

export function isProcessableImage(mime: string): boolean {
  return SUPPORTED_INPUT_MIMES.has(mime.toLowerCase());
}

function extFromMime(mime: string): string {
  switch (mime.toLowerCase()) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/avif":
      return "avif";
    case "image/gif":
      return "gif";
    case "image/heic":
    case "image/heif":
      return "heic";
    case "image/tiff":
      return "tif";
    default:
      return "bin";
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

async function computeBlurhash(buf: Buffer): Promise<string> {
  const w = 32;
  const h = 24;
  const { data, info } = await sharp(buf)
    .raw()
    .ensureAlpha()
    .resize(w, h, { fit: "inside" })
    .toBuffer({ resolveWithObject: true });
  const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  return encodeBlurhash(pixels, info.width, info.height, 4, 3);
}

async function computeDominantColor(buf: Buffer): Promise<string> {
  const { data } = await sharp(buf).resize(1, 1, { fit: "cover" }).raw().toBuffer({
    resolveWithObject: true,
  });
  const r = data[0] ?? 200;
  const g = data[1] ?? 200;
  const b = data[2] ?? 200;
  return rgbToHex(r, g, b);
}

export type ProcessImageOptions = {
  workspaceId: string;
  assetId: string;
  buffer: Buffer;
  mime: string;
  /** Callback invocado por cada key escrita en storage; permite rollback compensatorio si algo posterior falla. */
  onKeyWritten?: (key: string) => void;
};

/**
 * Procesa una imagen (strip EXIF + auto-orient), genera variantes responsive
 * (AVIF + WebP), blurhash, dominant color y guarda todo via el StorageAdapter.
 */
export async function processAndStoreImage(opts: ProcessImageOptions): Promise<ProcessedImage> {
  const { workspaceId, assetId, buffer, mime, onKeyWritten } = opts;
  const storage = currentStorage();
  const trackKey = (k: string) => onKeyWritten?.(k);

  const base = sharp(buffer, { failOn: "none" }).rotate();
  const meta = await base.metadata();
  const fullWidth = meta.width ?? 0;
  const fullHeight = meta.height ?? 0;
  const hasTransparency = meta.hasAlpha === true;

  // Original (re-encoded clean — strips EXIF, applies rotation).
  const originalExt = extFromMime(mime);
  const originalKey = buildAssetKey(workspaceId, originalExt, assetId);
  const originalBuffer = await sharp(buffer, { failOn: "none" }).rotate().toBuffer();
  const originalPut: PutResult = await storage.put(originalKey, originalBuffer, {
    contentType: mime,
    cacheControl: "public, max-age=31536000, immutable",
  });
  trackKey(originalPut.key);

  const original: ImageVariant = {
    key: originalPut.key,
    url: originalPut.url,
    w: fullWidth,
    h: fullHeight,
    size: originalPut.size,
    format: "original",
  };

  // Smaller pixel maps for blurhash + dominant color (avoid the cost on huge images).
  const previewBuf = await sharp(originalBuffer)
    .resize(256, 256, { fit: "inside", withoutEnlargement: true })
    .toBuffer();
  const [blurhash, dominantColor] = await Promise.all([
    computeBlurhash(previewBuf).catch(() => ""),
    computeDominantColor(previewBuf).catch(() => "#cccccc"),
  ]);

  const sizes: ProcessedImage["variants"]["sizes"] = {};

  for (const sizeName of Object.keys(SIZE_WIDTHS) as VariantSize[]) {
    const targetW = SIZE_WIDTHS[sizeName];
    if (fullWidth && targetW >= fullWidth) continue;

    const resized = sharp(originalBuffer).resize({
      width: targetW,
      withoutEnlargement: true,
    });

    for (const fmt of ["avif", "webp"] as VariantFormat[]) {
      const out =
        fmt === "avif"
          ? await resized.clone().avif({ quality: 60, effort: 4 }).toBuffer({
              resolveWithObject: true,
            })
          : await resized.clone().webp({ quality: 78 }).toBuffer({ resolveWithObject: true });
      const variantKey = buildAssetKey(workspaceId, fmt, `${assetId}_${sizeName}`);
      const put = await storage.put(variantKey, out.data, {
        contentType: `image/${fmt}`,
        cacheControl: "public, max-age=31536000, immutable",
      });
      trackKey(put.key);
      if (!sizes[sizeName]) sizes[sizeName] = {};
      const slot = sizes[sizeName];
      slot[fmt] = {
        key: put.key,
        url: put.url,
        w: out.info.width,
        h: out.info.height,
        size: put.size,
        format: fmt,
      };
    }
  }

  return {
    width: fullWidth,
    height: fullHeight,
    mime,
    size: originalPut.size,
    blurhash,
    dominantColor,
    hasTransparency,
    variants: { original, sizes },
  };
}

export type NonImageStored = {
  key: string;
  url: string;
  size: number;
  mime: string;
};

/** Almacena un archivo no-imagen (video/pdf/etc.) sin procesado. */
export async function storeRawFile(
  workspaceId: string,
  assetId: string,
  buffer: Buffer,
  mime: string,
  filename: string,
): Promise<NonImageStored> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "bin";
  const key = buildAssetKey(workspaceId, ext, assetId);
  const put = await currentStorage().put(key, buffer, {
    contentType: mime,
    cacheControl: "public, max-age=31536000, immutable",
  });
  return { key: put.key, url: put.url, size: put.size, mime };
}
