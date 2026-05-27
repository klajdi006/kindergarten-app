export interface CompressOptions {
  /** Longest edge cap in pixels. Larger images are scaled down to fit. */
  maxDimension?: number;
  /** JPEG quality, 0..1. */
  quality?: number;
}

/**
 * Downscale + re-encode an image File for upload. Caps the longest edge and
 * re-encodes as JPEG. Leaves already-small images alone, and falls back to the
 * original file on any failure (unsupported format, decode error, etc.) so an
 * upload never breaks because of compression.
 */
export async function compressImage(
  file: File,
  opts: CompressOptions = {},
): Promise<File> {
  const maxDimension = opts.maxDimension ?? 1600;
  const quality = opts.quality ?? 0.82;

  if (!file.type.startsWith('image/')) return file;
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    return file;
  }

  let bitmap: ImageBitmap | null = null;
  try {
    // `from-image` applies EXIF orientation (iPhone photos are often rotated).
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const { width, height } = bitmap;
    const longest = Math.max(width, height);
    const scale = longest > maxDimension ? maxDimension / longest : 1;

    // Already small enough and reasonably sized — keep the original bytes.
    if (scale === 1 && file.size < 1_000_000) return file;

    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
