import assert from "node:assert/strict";
import test from "node:test";
import type { PortalCatalogProduct } from "../../types/portal";
import {
  canAssignProduct,
  getProductAssignmentProblems,
} from "./productAssignment";

const addon: PortalCatalogProduct = {
  id: 17,
  name: "Creatine",
  is_dependent: true,
  product_type: "powder",
  brand: { id: 2, name: "Test Brand" },
  product_line: { id: 3, name: "Supplements" },
  dosage: {
    product: 5,
    water: 0,
    full_drink_volume: 0,
    full_drink_price: 0,
    conversion_factor: 4,
  },
};

test("a free add-on is assignable without drink sizes or artwork", () => {
  assert.deepEqual(getProductAssignmentProblems(addon), []);
  assert.equal(canAssignProduct(addon), true);
});

test("add-on assignment requires an explicit supported price", () => {
  for (const price of [undefined, null, "", -1, 0.01, "NaN", "Infinity"]) {
    assert.deepEqual(
      getProductAssignmentProblems({
        ...addon,
        dosage: { ...addon.dosage, full_drink_price: price },
      }).map((problem) => problem.code),
      ["no_usable_price"],
    );
  }
  assert.equal(canAssignProduct({
    ...addon,
    dosage: { ...addon.dosage, full_drink_price: 1.5 },
  }), true);
});

test("add-on assignment requires a positive finite dosage", () => {
  for (const product of [undefined, null, 0, -5, "NaN", "Infinity"]) {
    assert.deepEqual(
      getProductAssignmentProblems({
        ...addon,
        dosage: { ...addon.dosage, product },
      }).map((problem) => problem.code),
      ["bad_dosage"],
    );
  }
});

test("add-ons still require an active product, brand, line and dispenser type", () => {
  const problems = getProductAssignmentProblems({
    ...addon,
    isActive: false,
    brand: null,
    product_line: null,
    product_type: null,
  });
  assert.deepEqual(
    problems.map((problem) => problem.code),
    ["product_disabled", "no_product_type", "no_brand", "no_product_line"],
  );
});

test("ordinary drinks still require a price, volume and image", () => {
  for (const is_dependent of [false, null, undefined]) {
    const drink = { ...addon, is_dependent };
    assert.equal(canAssignProduct(drink), false);
    assert.deepEqual(
      getProductAssignmentProblems(drink).map((problem) => problem.code),
      ["no_usable_price", "bad_volume", "no_image"],
    );
  }
});
