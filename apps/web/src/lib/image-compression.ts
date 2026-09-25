// Client-side only — a Canvas API resize/re-encode, not a library. A phone
// photo selected as-is can be several MB; downscaling the longest edge and
// re-encoding as JPEG at a reasonable quality typically cuts that by
// 80-90% with no visible loss on a phone screen, which matters twice over
// once this is on a real hosted Supabase project: it shrinks both the
// stored bytes (Storage volume) and what every future profile view has to
// download (Storage egress) — see docs/gather_web_architecture.md's cost
// notes on the gallery feature.
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

export async function compressImageFile(file: File): Promise<File> {
  if (typeof window === "undefined" || !file.type.startsWith("image/")) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) return file;

    // Only use the compressed version if it's actually smaller — a tiny
    // already-optimized image can occasionally come out larger once
    // re-encoded, and there's no reason to make that case worse.
    if (blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    // A decode failure (an unusual/corrupt file, an older browser missing
    // createImageBitmap) shouldn't block the upload entirely — fall back to
    // the original file and let the server's own type/size checks decide.
    return file;
  }
}
