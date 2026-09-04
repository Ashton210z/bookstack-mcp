/**
 * Sniff an image's real type from its leading bytes.
 *
 * BookStack validates uploads with `mimes:jpeg,png,gif,webp,avif` *and* an
 * `image_extension` rule, so the multipart filename has to carry an extension
 * that matches the actual bytes. Callers hand us base64 with no filename, so we
 * derive both from content rather than trusting anything the caller says.
 */

export interface ImageType {
  /** MIME type, e.g. "image/png". */
  mime: string;
  /** Canonical extension without the dot, e.g. "png". */
  ext: string;
}

/** Formats BookStack's image gallery accepts. */
export const SUPPORTED_IMAGE_TYPES: readonly ImageType[] = [
  { mime: 'image/jpeg', ext: 'jpg' },
  { mime: 'image/png', ext: 'png' },
  { mime: 'image/gif', ext: 'gif' },
  { mime: 'image/webp', ext: 'webp' },
  { mime: 'image/avif', ext: 'avif' },
];

const startsWith = (buf: Uint8Array, bytes: number[], offset = 0): boolean =>
  buf.length >= offset + bytes.length &&
  bytes.every((b, i) => buf[offset + i] === b);

const asciiAt = (buf: Uint8Array, offset: number, text: string): boolean =>
  startsWith(buf, [...text].map((c) => c.charCodeAt(0)), offset);

/**
 * Returns the detected type, or null if the bytes are not a format BookStack
 * accepts. SVG is deliberately *not* supported here — see detectRejectedFormat.
 */
export function detectImageType(buf: Uint8Array): ImageType | null {
  // PNG: \x89PNG\r\n\x1a\n
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: 'image/png', ext: 'png' };
  }
  // JPEG: FF D8 FF
  if (startsWith(buf, [0xff, 0xd8, 0xff])) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  // GIF: "GIF87a" or "GIF89a"
  if (asciiAt(buf, 0, 'GIF87a') || asciiAt(buf, 0, 'GIF89a')) {
    return { mime: 'image/gif', ext: 'gif' };
  }
  // WebP: "RIFF" ....size.... "WEBP"
  if (asciiAt(buf, 0, 'RIFF') && asciiAt(buf, 8, 'WEBP')) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  // AVIF: ISO-BMFF "ftyp" box with an AVIF brand.
  if (asciiAt(buf, 4, 'ftyp') && (asciiAt(buf, 8, 'avif') || asciiAt(buf, 8, 'avis'))) {
    return { mime: 'image/avif', ext: 'avif' };
  }
  return null;
}

/**
 * Names a format we can recognise but BookStack will reject, so the caller gets
 * "SVG is not supported, rasterise it" instead of a bare 422 from the API.
 */
export function detectRejectedFormat(buf: Uint8Array): string | null {
  // SVG / XML — the likely mistake when embedding a rendered diagram.
  const head = new TextDecoder('utf-8', { fatal: false })
    .decode(buf.slice(0, 512))
    .trimStart()
    .toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) {
    return 'SVG';
  }
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46])) return 'PDF'; // %PDF
  if (startsWith(buf, [0x42, 0x4d])) return 'BMP';             // BM
  if (startsWith(buf, [0x49, 0x49, 0x2a, 0x00]) || startsWith(buf, [0x4d, 0x4d, 0x00, 0x2a])) {
    return 'TIFF';
  }
  return null;
}

/** Extension list for error messages, e.g. "jpg, png, gif, webp, avif". */
export function supportedExtensions(): string {
  return SUPPORTED_IMAGE_TYPES.map((t) => t.ext).join(', ');
}

/**
 * Ensures `name` ends with the extension matching the detected type, so the
 * multipart filename satisfies BookStack's image_extension rule. Names that
 * already carry the right extension (or a known alias, .jpeg for .jpg) are left
 * alone; anything else gets the correct extension appended.
 */
export function filenameFor(name: string, type: ImageType): string {
  const lower = name.toLowerCase();
  const aliases = type.ext === 'jpg' ? ['jpg', 'jpeg'] : [type.ext];
  if (aliases.some((ext) => lower.endsWith(`.${ext}`))) return name;
  return `${name}.${type.ext}`;
}
