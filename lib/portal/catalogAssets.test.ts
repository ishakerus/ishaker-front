import assert from "node:assert/strict";
import test from "node:test";
import { deflateSync } from "node:zlib";
import { canManageCatalogAsset, CATALOG_IMAGE_MAX_BYTES, validateCatalogPng } from "./catalogAssets";
import { decodeCatalogImage } from "../../services/server/catalogImage";

function chunk(type: string, data: Buffer) {
  const bytes = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, bytes, checksum]);
}
function png(width: number, height: number, compressed?: Buffer) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", compressed || deflateSync(Buffer.alloc((width * 4 + 1) * height))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const file = (buffer: Buffer, overrides = {}) => ({ name: "logo.png", type: "image/png", size: buffer.length, ...overrides });

test("only matching client-owned assets can be changed; empty and root remain read-only", () => {
  assert.equal(canManageCatalogAsset(null, 12), false);
  assert.equal(canManageCatalogAsset(undefined, 12), false);
  assert.equal(canManageCatalogAsset({ id: 12, company: " Root " }, 12), false);
  assert.equal(canManageCatalogAsset({ id: 13, company: "Another client" }, 12), false);
  assert.equal(canManageCatalogAsset({ id: "12", company: "My client" }, 12), true);
});

test("valid brand, main and ingredient PNG dimensions are accepted", () => {
  for (const [kind, width, height] of [["brand", 500, 330], ["main", 350, 350], ["ingredient", 500, 500], ["frame", 619, 617]] as const) {
    const buffer = png(width, height);
    assert.doesNotThrow(() => validateCatalogPng(file(buffer), buffer, kind, "Image"));
    assert.doesNotThrow(() => decodeCatalogImage({ ...file(buffer), data: buffer.toString("base64") }, kind, "Image"));
  }
});

test("wrong extensions, MIME types, dimensions, empty and oversized files are rejected", () => {
  const buffer = png(500, 330);
  for (const overrides of [{ name: "logo.jpg" }, { type: "image/jpeg" }, { size: 0 }, { size: CATALOG_IMAGE_MAX_BYTES + 1 }]) {
    assert.throws(() => validateCatalogPng(file(buffer, overrides), buffer, "brand", "Logo"));
  }
  assert.throws(() => validateCatalogPng(file(buffer), buffer, "main", "Main"), /350 × 350/);
});

test("renamed files, truncated PNGs and damaged chunks are rejected", () => {
  const jpeg = Buffer.from("this is not a PNG");
  assert.throws(() => validateCatalogPng(file(jpeg), jpeg, "brand", "Logo"), /valid PNG/);
  const buffer = png(500, 330);
  const truncated = buffer.subarray(0, buffer.length - 12);
  assert.throws(() => validateCatalogPng(file(truncated), truncated, "brand", "Logo"), /complete PNG/);
  buffer[40] ^= 1;
  assert.throws(() => validateCatalogPng(file(buffer), buffer, "brand", "Logo"), /damaged PNG/);
});

test("server rejects a PNG container with invalid compressed pixel data", () => {
  const buffer = png(500, 330, Buffer.from("not compressed pixels"));
  assert.throws(() => decodeCatalogImage({ ...file(buffer), data: buffer.toString("base64") }, "brand", "Logo"), /invalid PNG pixel data/);
});

test("server rejects truncated decompressed scanlines even with valid CRC and compression", () => {
  const buffer = png(500, 330, deflateSync(Buffer.alloc(1)));
  assert.throws(() => decodeCatalogImage({ ...file(buffer), data: buffer.toString("base64") }, "brand", "Logo"), /invalid PNG pixel data/);
});
