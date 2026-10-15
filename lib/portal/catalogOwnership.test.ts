import assert from "node:assert/strict";
import test from "node:test";
import { addCatalogVisibilityFilters, canManageCatalogAsset } from "./catalogAssets";
import { isCatalogAssetVisible, requestVisibleCatalogAssets } from "./catalogOwnership";

const own = { id: 1, author: { id: 12, company: "My client" } };
const other = { id: 2, author: { id: 13, company: "Other client" } };
const root = { id: 3, author: { id: 14, company: "Root" } };
const legacy = { id: 4 };

test("catalog visibility includes own and shared assets but excludes other clients", () => {
  assert.equal(isCatalogAssetVisible(own, 12), true);
  assert.equal(isCatalogAssetVisible(other, 12), false);
  assert.equal(isCatalogAssetVisible(root, 12), true);
  assert.equal(isCatalogAssetVisible(legacy, 12), true);
  assert.equal(canManageCatalogAsset(undefined, 12), false);
  assert.equal(canManageCatalogAsset({ id: 12 }, 12), false);
});

test("older Strapi fallback strips author filters and still excludes other clients", async () => {
  const params = addCatalogVisibilityFilters(new URLSearchParams({ "populate[author][fields][0]": "company", "populate[main]": "*", "filters[name][$eq]": "Mint" }), 12);
  let calls = 0;
  const result = await requestVisibleCatalogAssets(params, 12, async (query) => {
    calls++;
    if (calls === 1) throw Object.assign(new Error("Missing relation"), { status: 500 });
    assert.equal(query.get("filters[$or][0][author][id][$null]"), null);
    assert.equal(query.get("populate[author][fields][0]"), "company");
    assert.equal(query.get("populate[main]"), "*");
    assert.equal(query.get("filters[name][$eq]"), "Mint");
    return [own, other, root, legacy];
  });
  assert.deepEqual(result, [own, root, legacy]);
  assert.equal(calls, 2);
  assert.equal(params.get("filters[$or][0][author][id][$null]"), "true");
});

test("catalog reads all pages before applying ownership filters", async () => {
  const result = await requestVisibleCatalogAssets(new URLSearchParams(), 12, async (query) =>
    query.get("pagination[page]") === "1" ? Array.from({ length: 100 }, () => other) : [own],
  );
  assert.deepEqual(result, [own]);
});

test("authorization failures are never retried with fewer filters", async () => {
  let calls = 0;
  await assert.rejects(requestVisibleCatalogAssets(new URLSearchParams(), 12, async () => {
    calls++;
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }), /Forbidden/);
  assert.equal(calls, 1);
});
