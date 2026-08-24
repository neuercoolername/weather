import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { processUpload, blobFor, sniffImageType, IMAGE_CONFIG } from "./images";

// Real buffers through the real encoder — the whole point of this module is what sharp
// actually emits, so stubbing it would test nothing.
async function jpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 120, b: 60 },
    },
  })
    .jpeg()
    .toBuffer();
}

describe("processUpload", () => {
  it("always emits webp", async () => {
    const out = await processUpload(await jpeg(800, 600), "image/jpeg");
    const meta = await sharp(out.data).metadata();
    expect(meta.format).toBe("webp");
  });

  it("caps the long edge at maxEdge and keeps the aspect ratio", async () => {
    const out = await processUpload(await jpeg(4032, 3024), "image/jpeg");

    expect(out.width).toBe(IMAGE_CONFIG.maxEdge);
    expect(out.height).toBe(Math.round((IMAGE_CONFIG.maxEdge * 3024) / 4032));
  });

  it("caps the long edge on portrait images too", async () => {
    const out = await processUpload(await jpeg(3024, 4032), "image/jpeg");

    expect(out.height).toBe(IMAGE_CONFIG.maxEdge);
    expect(out.width).toBe(Math.round((IMAGE_CONFIG.maxEdge * 3024) / 4032));
  });

  it("does not upscale an image smaller than maxEdge", async () => {
    const out = await processUpload(await jpeg(400, 300), "image/jpeg");

    expect(out.width).toBe(400);
    expect(out.height).toBe(300);
  });

  it("reports dimensions and byte length matching the returned buffer", async () => {
    const out = await processUpload(await jpeg(1200, 900), "image/jpeg");
    const meta = await sharp(out.data).metadata();

    expect(out.bytes).toBe(out.data.length);
    expect(out.width).toBe(meta.width);
    expect(out.height).toBe(meta.height);
  });

  it("substantially shrinks a full-resolution photo", async () => {
    const original = await jpeg(4032, 3024);
    const out = await processUpload(original, "image/jpeg");

    expect(out.bytes).toBeLessThan(original.length);
    expect(out.bytes).toBeLessThan(1024 * 1024);
  });

  it("honours an overridden config", async () => {
    const out = await processUpload(await jpeg(2000, 2000), "image/jpeg", {
      ...IMAGE_CONFIG,
      maxEdge: 500,
    });

    expect(out.width).toBe(500);
    expect(out.height).toBe(500);
  });

  it("applies EXIF orientation, swapping dimensions for a rotated frame", async () => {
    // Orientation 6 = rotate 90° CW on display, so a 400x200 frame reads as 200x400.
    // Must be set via withMetadata: withExif normalises Orientation back to 1.
    const rotated = await sharp({
      create: {
        width: 400,
        height: 200,
        channels: 3,
        background: { r: 10, g: 10, b: 10 },
      },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    const out = await processUpload(rotated, "image/jpeg");

    expect(out.width).toBe(200);
    expect(out.height).toBe(400);
  });

  it("strips EXIF metadata from the stored image", async () => {
    const withGps = await sharp({
      create: {
        width: 300,
        height: 300,
        channels: 3,
        background: { r: 1, g: 2, b: 3 },
      },
    })
      .withExif({ IFD0: { Copyright: "somebody" } })
      .jpeg()
      .toBuffer();

    const out = await processUpload(withGps, "image/jpeg");
    const meta = await sharp(out.data).metadata();

    expect(meta.exif).toBeUndefined();
  });

  it("rejects a buffer that is not a decodable image", async () => {
    await expect(
      processUpload(Buffer.from("this is not an image"), "image/jpeg")
    ).rejects.toThrow();
  });
});

describe("sniffImageType", () => {
  function heif(brand: string): Uint8Array {
    const buf = Buffer.alloc(16);
    buf.writeUInt32BE(16, 0); // box size
    buf.write("ftyp", 4, "ascii");
    buf.write(brand, 8, "ascii");
    return buf;
  }

  it("identifies the formats sharp is given", async () => {
    expect(sniffImageType(await jpeg(20, 20))).toBe("image/jpeg");
    expect(
      sniffImageType(await sharp(await jpeg(20, 20)).png().toBuffer())
    ).toBe("image/png");
    expect(
      sniffImageType(await sharp(await jpeg(20, 20)).webp().toBuffer())
    ).toBe("image/webp");
  });

  it.each(["heic", "heix", "hevc", "mif1", "msf1"])(
    "identifies the HEVC-still brand %s",
    (brand) => {
      expect(sniffImageType(heif(brand))).toBe("image/heic");
    }
  );

  // The whole point: a desktop browser reports "" for .heic, so admission cannot depend on it.
  it("identifies HEIC regardless of what any client would have called it", () => {
    expect(sniffImageType(heif("heic"))).toBe("image/heic");
  });

  it("rejects AVIF, which shares the container but is not supported here", () => {
    expect(sniffImageType(heif("avif"))).toBeNull();
  });

  it("rejects anything else, including truncated headers", () => {
    expect(sniffImageType(Buffer.from("not an image at all"))).toBeNull();
    expect(sniffImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
  });
});

// The upload path only ever sees the value `blobFor` produces, so that is the contract worth
// pinning. These do not reproduce the production "SharedArrayBuffer is not allowed" failure —
// sharp's raw buffer converts fine under glibc, which is the whole reason that bug needed the
// Alpine container to appear.
describe("blobFor", () => {
  it("carries the encoded bytes and the stored content type", async () => {
    const out = await processUpload(await jpeg(600, 400), "image/jpeg");
    const blob = blobFor(out);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBe(out.bytes);
    expect(blob.type).toBe("image/webp");
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(
      new Uint8Array(out.data)
    );
  });

  it("is accepted as a fetch body", async () => {
    const blob = blobFor(await processUpload(await jpeg(600, 400), "image/jpeg"));

    expect(
      () => new Request("http://local", { method: "POST", body: blob })
    ).not.toThrow();
  });
});
