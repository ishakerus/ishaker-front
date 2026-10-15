import assert from "node:assert/strict";
import test from "node:test";
import { loadCatalogCollections } from "./loadCatalogCollections";

const circle = { id: 1, name: "Mint circle" };
const splash = { id: 2, name: "Color Mint" };

test("failed ownership queries preserve existing circles and color splashes", async () => {
  const failure = new Error("Strapi ownership query failed");
  const errors: string[] = [];
  const result = await loadCatalogCollections({
    tastes: async () => { throw failure; },
    brands: async () => { throw failure; },
    circles: async () => [circle],
    splashes: async () => [splash],
  }, (name, error) => { errors.push(name); assert.equal(error, failure); });
  assert.deepEqual(result.circles, [circle]);
  assert.deepEqual(result.splashes, [splash]);
  assert.deepEqual(result.tastes, []);
  assert.deepEqual(result.brands, []);
  assert.deepEqual(result.loadErrors, ["tastes", "brands"]);
  assert.deepEqual(errors, ["tastes", "brands"]);
});

test("a failed image collection does not hide other catalog collections", async () => {
  const result = await loadCatalogCollections({
    tastes: async () => [{ id: 3, name: "Mint" }],
    brands: async () => [{ id: 4, name: "My brand" }],
    circles: async () => { throw new Error("Unavailable"); },
    splashes: async () => [splash],
  }, () => undefined);
  assert.equal(result.tastes.length, 1);
  assert.equal(result.brands.length, 1);
  assert.deepEqual(result.splashes, [splash]);
  assert.deepEqual(result.loadErrors, ["circles"]);
});

test("successful empty collections do not produce load errors", async () => {
  const result = await loadCatalogCollections({
    tastes: async () => [], brands: async () => [],
    circles: async () => [], splashes: async () => [],
  }, () => assert.fail("No error expected"));
  assert.deepEqual(result.loadErrors, []);
});
