import assert from "node:assert/strict";
import test from "node:test";
import { getSharedSyrupCapacity } from "./syrupVolume";

test("syrup bags retain a shared saved maximum volume", () => {
  assert.equal(
    getSharedSyrupCapacity(
      [
        { position: 5, max_amount_kg: 1.2 },
        { position: 6, max_amount_kg: "1.2" },
        { position: 7, max_amount_kg: 1.2 },
      ],
      4,
    ),
    1.2,
  );
});

test("mixed legacy bottles use one common model default", () => {
  assert.equal(
    getSharedSyrupCapacity(
      [
        { position: 5, max_amount_kg: 1 },
        { position: 6, max_amount_kg: 0.7 },
        { position: 7, max_amount_kg: null },
      ],
      4,
    ),
    3,
  );
});

test("powder capacities do not affect syrup capacity", () => {
  assert.equal(
    getSharedSyrupCapacity(
      [
        { position: 1, max_amount_kg: 5.5 },
        { position: 8, max_amount_kg: 5.5 },
        { position: 9, max_amount_kg: 2 },
        { position: 14, max_amount_kg: 2 },
      ],
      8,
    ),
    2,
  );
});

test("unassigned bags and empty capacity overrides use three litres", () => {
  assert.equal(getSharedSyrupCapacity([], 4), 3);
  assert.equal(
    getSharedSyrupCapacity([{ position: 5, max_amount_kg: null }], 4),
    3,
  );
});
