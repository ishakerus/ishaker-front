import { inflateSync } from "zlib";
import { CatalogValidationError, validateCatalogPng, type CatalogImageKind } from "../../lib/portal/catalogAssets";
import type { EncodedImage } from "./imageUpload";

export function decodeCatalogImage(value: EncodedImage, kind: CatalogImageKind, label: string) {
  const name = typeof value?.name === "string" ? value.name.trim() : "";
  const type = typeof value?.type === "string" ? value.type.trim().toLowerCase() : "";
  const data = typeof value?.data === "string" ? value.data : "";
  if (!data || data.length > 7 * 1024 * 1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) {
    throw new CatalogValidationError(`${label} contains invalid image data.`);
  }
  const buffer = Buffer.from(data, "base64");
  const chunks = validateCatalogPng({ name, type, size: buffer.length }, buffer, kind, label);
  try {
    // Dimensions are already bounded; cap decompression as well.
    const pixels = inflateSync(Buffer.concat(chunks), { maxOutputLength: 8 * 1024 * 1024 });
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    const depth = buffer[24];
    const color = buffer[25];
    const channels: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
    const allowedDepths: Record<number, number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
    if (!allowedDepths[color]?.includes(depth) || buffer[26] !== 0 || buffer[27] !== 0 || buffer[28] > 1) throw new Error("Invalid PNG header");
    const passes = buffer[28] === 0 ? [[0, 0, 1, 1]] : [
      [0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4],
      [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2],
    ];
    let offset = 0;
    for (const [x, y, dx, dy] of passes) {
      const columns = Math.max(0, Math.ceil((width - x) / dx));
      const rows = Math.max(0, Math.ceil((height - y) / dy));
      if (!columns || !rows) continue;
      const rowBytes = Math.ceil(columns * channels[color] * depth / 8);
      for (let row = 0; row < rows; row++) {
        if (offset + rowBytes + 1 > pixels.length || pixels[offset] > 4) throw new Error("Invalid PNG scanline");
        offset += rowBytes + 1;
      }
    }
    if (offset !== pixels.length) throw new Error("Invalid PNG pixel length");
  } catch {
    throw new CatalogValidationError(`${label} contains invalid PNG pixel data.`);
  }
  return { name, type, buffer };
}
