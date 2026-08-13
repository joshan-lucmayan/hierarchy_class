// Shared client-side validation for image/file uploads.
//
// Supabase Storage RLS is the real gate (owner folder + school scoping), but
// every upload path validates MIME + extension + size here too, and derives
// the extension from the detected MIME type instead of trusting the file name
// (which is also what prevents path-traversal-style names from reaching the
// storage path).

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB for documents

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

/** Extensions we accept, mapped to the same values MIME_TO_EXT produces. */
const EXT_TO_EXT: Record<string, string> = {
  jpg: "jpg",
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  gif: "gif",
  pdf: "pdf",
};

export type UploadKind = "image" | "document";

/**
 * Resolves the safe extension for a file, preferring the MIME type but
 * falling back to the file name extension. Browsers on Android or over
 * plain HTTP often report `application/octet-stream` (or an empty MIME)
 * for perfectly valid PDFs, which would otherwise be rejected.
 */
export function resolveFileExtension(file: File): string | null {
  const byMime = MIME_TO_EXT[file.type];
  if (byMime) return byMime;
  if (file.type && file.type !== "application/octet-stream") return null;
  const nameExt = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_EXT[nameExt] ?? null;
}

export function validateUpload(file: File, kind: UploadKind): string | null {
  const max = kind === "image" ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
  if (file.size <= 0) return "The file is empty.";
  if (file.size > max) {
    return `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${Math.floor(max / 1024 / 1024)} MB.`;
  }

  const ext = resolveFileExtension(file);
  if (!ext) {
    return kind === "image"
      ? "Only JPG, PNG, WebP, or GIF images are allowed."
      : "Only JPG, PNG, WebP, GIF, or PDF files are allowed.";
  }
  return null;
}

/** Returns the safe extension derived from the MIME type, or null if unsupported. */
export function extensionForMime(mime: string): string | null {
  return MIME_TO_EXT[mime] ?? null;
}

/** True when the MIME type is a supported image. */
export function isSupportedImage(mime: string): boolean {
  return !!MIME_TO_EXT[mime] && mime.startsWith("image/");
}

/**
 * Extracts the object path from a Supabase Storage public URL so stored files
 * can be removed later (e.g. when a profile picture is cleared).
 * Returns null when the URL isn't a storage URL.
 */
export function storagePathFromUrl(url: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const rest = url.slice(idx + marker.length).split("?")[0];
  return rest || null;
}
