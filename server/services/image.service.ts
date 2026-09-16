import sharp from "sharp";

const MAX_SIDE = 1800;
const JPEG_QUALITY = 88;

export interface NormalizedImage {
  base64: string;
  mime: "image/jpeg";
  width: number;
  height: number;
}

async function heicToJpegBuffer(input: Buffer): Promise<Buffer> {
  const { default: convert } = await import("heic-convert");
  const out = await convert({ buffer: new Uint8Array(input), format: "JPEG", quality: 0.92 });
  return Buffer.from(out);
}

export async function normalizeImageToJpeg(input: Buffer, ext: string): Promise<NormalizedImage> {
  const source = ext === "heic" || ext === "heif" ? await heicToJpegBuffer(input) : input;

  const { data, info } = await sharp(source)
    .rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return { base64: data.toString("base64"), mime: "image/jpeg", width: info.width, height: info.height };
}
