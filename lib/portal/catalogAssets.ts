export const CATALOG_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const CATALOG_IMAGE_SIZES = {
  brand: { width: 500, height: 330 },
  main: { width: 350, height: 350 },
  ingredient: { width: 500, height: 500 },
  frame: { width: 619, height: 617 },
} as const;
export type CatalogImageKind = keyof typeof CATALOG_IMAGE_SIZES;
export type CatalogAuthor = { id: string | number; company?: string | null };

export const canManageCatalogAsset = (
  author: CatalogAuthor | null | undefined,
  clientId: string | number,
) => Boolean(author?.id && author.company?.trim() && author.company.trim().toLowerCase() !== "root" && String(author.id) === String(clientId));

export function addCatalogVisibilityFilters(params: URLSearchParams, clientId: string | number) {
  params.set("filters[$or][0][author][id][$null]", "true");
  params.set("filters[$or][1][author][company][$eqi]", "root");
  params.set("filters[$or][2][author][id][$eq]", String(clientId));
  return params;
}

export class CatalogValidationError extends Error {
  status = 400;
}

const fail = (message: string): never => { throw new CatalogValidationError(message); };

// Check actual PNG bytes as well as the filename and MIME type. Renaming a
// JPEG to .png must never let it through either the form or the API.
export function validateCatalogPng(
  file: { name: string; type: string; size: number },
  bytes: Uint8Array,
  kind: CatalogImageKind,
  label: string,
) {
  if (!/\.png$/i.test(file.name) || file.type.toLowerCase() !== "image/png") {
    fail(`${label} must be a .png file (PNG format).`);
  }
  if (!file.size || file.size > CATALOG_IMAGE_MAX_BYTES || bytes.length !== file.size) {
    fail(`${label} must be no larger than 5 MB and must not be empty.`);
  }
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 57 || !signature.every((byte, index) => bytes[index] === byte)) {
    fail(`${label} is not a valid PNG image.`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let hasData = false;
  let hasHeader = false;
  let hasEnd = false;
  const dataChunks: Uint8Array[] = [];
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) fail(`${label} contains incomplete PNG data.`);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    let crc = 0xffffffff;
    for (let i = offset + 4; i < end - 4; i++) {
      crc ^= bytes[i];
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    if (((crc ^ 0xffffffff) >>> 0) !== view.getUint32(end - 4)) fail(`${label} contains damaged PNG data.`);
    if (!hasHeader) {
      if (type !== "IHDR" || length !== 13) fail(`${label} has an invalid PNG header.`);
      const { width, height } = CATALOG_IMAGE_SIZES[kind];
      if (view.getUint32(offset + 8) !== width || view.getUint32(offset + 12) !== height) {
        fail(`${label} must be exactly ${width} × ${height} px.`);
      }
      hasHeader = true;
    } else if (type === "IHDR") fail(`${label} has a duplicate PNG header.`);
    if (type === "IDAT") {
      hasData = true;
      dataChunks.push(bytes.subarray(offset + 8, end - 4));
    }
    offset = end;
    if (type === "IEND") {
      if (length !== 0 || offset !== bytes.length) fail(`${label} has an invalid PNG ending.`);
      hasEnd = true;
      break;
    }
  }
  if (!hasHeader || !hasData || !hasEnd) fail(`${label} is not a complete PNG image.`);
  return dataChunks;
}

export async function validateCatalogFile(file: File, kind: CatalogImageKind, label: string) {
  // Reject the cheap checks before reading or decoding the file.
  if (!/\.png$/i.test(file.name) || file.type.toLowerCase() !== "image/png") fail(`${label} must be a .png file (PNG format).`);
  if (!file.size || file.size > CATALOG_IMAGE_MAX_BYTES) fail(`${label} must be no larger than 5 MB and must not be empty.`);
  validateCatalogPng(file, new Uint8Array(await file.arrayBuffer()), kind, label);
  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve();
      image.onerror = () => reject(new CatalogValidationError(`${label} could not be decoded as a PNG image.`));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
