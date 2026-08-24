import "server-only";

import { types } from "node:util";
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

const HEIC_TYPES = new Set(["image/heic", "image/heif"]);

/** ISO base-media brands that mean "HEVC still", as opposed to the AVIF that shares the container. */
const HEIF_BRANDS = new Set([
  "heic",
  "heix",
  "heim",
  "heis",
  "hevc",
  "hevx",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
]);

/**
 * The format according to the bytes, not according to the browser.
 *
 * `File.type` is whatever the client chose to report, and for `.heic` on a desktop that is
 * routinely the empty string — Windows registers no MIME type for it unless the HEIF extension is
 * installed. Gating on that value rejected real HEICs before anything had read them. Every format
 * here is identified by its own header instead, and the result is what decides both admission and
 * which decoder runs.
 *
 * Returns null for anything not supported, including AVIF, which shares the HEIF container but is
 * not something this project accepts today.
 */
export function sniffImageType(input: Uint8Array): string | null {
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...input.subarray(start, end));

  if (input.length >= 3 && input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff) {
    return "image/jpeg";
  }
  if (input.length >= 8 && ascii(0, 8) === "\x89PNG\r\n\x1a\n") {
    return "image/png";
  }
  if (input.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return "image/webp";
  }
  if (input.length >= 12 && ascii(4, 8) === "ftyp" && HEIF_BRANDS.has(ascii(8, 12))) {
    return "image/heic";
  }
  return null;
}

/** Everything is stored as WebP, so the encode and the upload agree on one type. */
export const STORED_CONTENT_TYPE = "image/webp";

export interface ProcessedImage {
  /** sharp's buffer, unmodified. Upload it through `blobFor`, never directly. */
  data: Uint8Array;
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

/**
 * Wraps the encoded bytes for upload.
 *
 * `supabase-js` puts whatever it is handed straight onto a `fetch` body, and a typed array goes
 * through fetch's `BufferSource` conversion. Inside the Alpine container that conversion rejects
 * sharp's buffer with "ArrayBuffer: SharedArrayBuffer is not allowed"; the same bytes convert
 * fine on glibc and from plain Node, so it cannot be reproduced outside production. A Blob takes
 * a different branch of the body handling and skips the conversion entirely.
 *
 * That branch also posts the Blob as one part of a `FormData`, where supabase-js never applies its
 * `contentType` option — passing one alongside would look meaningful and do nothing. The type set
 * here is what the object is stored as, which is why callers pass no options.
 */
export function blobFor(image: ProcessedImage): Blob {
  // `BlobPart` wants a view over a real ArrayBuffer, while TS types every Uint8Array over
  // `ArrayBufferLike`, which includes SharedArrayBuffer. sharp never returns one.
  return new Blob([image.data as unknown as BlobPart], {
    type: STORED_CONTENT_TYPE,
  });
}

/**
 * The body's shape at the moment an upload failed. The storage error reports only that `fetch`
 * refused it, and by the time it surfaces the buffer is gone — so if `blobFor` turns out not to be
 * enough, this is the evidence the next attempt hinges on. `isShared` disagreeing with
 * `isArrayBuffer` would mean a bundled `util.types` misclassifying an externally allocated buffer.
 */
export function describeBytes({ data }: ProcessedImage) {
  return {
    ctor: data.constructor.name,
    bufferCtor: data.buffer.constructor.name,
    isShared: types.isSharedArrayBuffer(data.buffer),
    isArrayBuffer: data.buffer instanceof ArrayBuffer,
    byteLength: data.byteLength,
    byteOffset: data.byteOffset,
    bufferByteLength: data.buffer.byteLength,
    runtime: `${process.platform}/${process.arch}`,
  };
}
