import "server-only";

import sharp from "sharp";

// Uploads arrive as whatever came off the camera — a 15MB, 4032x3024 phone frame is
// typical — and are normalised here, once, so that reading one is a plain fetch of an
// already-small file.
export interface ImageConfig {
  /** Longest edge of the stored image, in px. Downscale only — never upscales. */
  maxEdge: number;
  /** WebP quality, 1-100. */
  quality: number;
  /** Largest upload accepted, in bytes. Applies to the original, pre-processing. */
  maxBytes: number;
}

export const IMAGE_CONFIG: ImageConfig = {
  maxEdge: 2000,
  quality: 80,
  maxBytes: 15 * 1024 * 1024,
};

export const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const HEIC_TYPES = new Set(["image/heic", "image/heif"]);

export interface ProcessedImage {
  data: Buffer;
  width: number;
  height: number;
  bytes: number;
}

/**
 * sharp's prebuilt libvips ships the AV1 codec but not libde265, so it can read AVIF and
 * not HEVC-encoded HEIC — which is exactly what an iPhone writes. (Verified against
 * 0.35.3: `format.heif.input.fileSuffix` is `[".avif"]` and `de265` is absent from the
 * bundled binary.) iOS Safari usually transcodes to JPEG when a photo is picked from the
 * Photo Library, but the Files picker hands over the raw .heic, so the server cannot rely
 * on that. heic-convert is pure JS with its own HEVC decoder and covers the gap.
 *
 * It is slow — seconds for a 12MP frame, against milliseconds for sharp — which is
 * acceptable only because this runs on an authenticated, low-frequency admin upload.
 */
async function toDecodable(input: Buffer, contentType: string): Promise<Buffer> {
  if (!HEIC_TYPES.has(contentType)) return input;

  // Imported lazily so the WASM decoder is only paid for on the HEIC path.
  const { default: heicConvert } = await import("heic-convert");
  const output = await heicConvert({
    buffer: input,
    format: "JPEG",
    quality: 1, // Max: the real quality decision is the WebP encode below.
  });
  return Buffer.from(output);
}

/**
 * Decode, orient, downscale and re-encode an upload to a bounded WebP.
 *
 * `.rotate()` with no argument applies the EXIF orientation and then drops the metadata,
 * which both fixes sideways phone photos and strips GPS coordinates from anything public.
 */
export async function processUpload(
  input: Buffer,
  contentType: string,
  config: ImageConfig = IMAGE_CONFIG
): Promise<ProcessedImage> {
  const decodable = await toDecodable(input, contentType);

  const { data, info } = await sharp(decodable)
    .rotate()
    .resize({
      width: config.maxEdge,
      height: config.maxEdge,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: config.quality })
    .toBuffer({ resolveWithObject: true });

  return {
    data,
    width: info.width,
    height: info.height,
    bytes: data.length,
  };
}
