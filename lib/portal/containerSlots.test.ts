import assert from "node:assert/strict";
import test from "node:test";
import {
  clampContainerAmountKg,
  getContainerMaxAmountKg,
  getMachineContainerCount,
  getMachineSyrupContainerCount,
  getMachineTotalContainerCount,
  getContainerCategory,
  isValidContainerSlot,
  getLowestFreeContainerSlot,
} from "./containerSlots";

test("container capacity is 1.5 kg for Shaker S and 5.5 kg for Touch", () => {
  assert.equal(getContainerMaxAmountKg(4), 1.5);
  assert.equal(getContainerMaxAmountKg(8), 5.5);
});

test("container amounts are capped at the machine capacity", () => {
  assert.equal(clampContainerAmountKg(2, 4), 1.5);
  assert.equal(clampContainerAmountKg(7, 8), 5.5);
  assert.equal(clampContainerAmountKg(0.7, 4), 0.7);
});

const small = {
  name: "shaker s",
  container_count: 4,
  syrup_container_count: 3,
};
const touch = {
  name: "shaker touch",
  container_count: 8,
  syrup_container_count: 6,
};

test("Shaker S has physical positions 1–4 powder and 5–7 syrup", () => {
  assert.equal(getMachineContainerCount(small), 4);
  assert.equal(getMachineSyrupContainerCount(small), 3);
  assert.equal(getMachineTotalContainerCount(small), 7);
  assert.deepEqual(
    Array.from({ length: 7 }, (_, i) => getContainerCategory(i + 1, 4, 3)),
    [
      "powder",
      "powder",
      "powder",
      "powder",
      "concentrate",
      "concentrate",
      "concentrate",
    ],
  );
});

test("Touch keeps syrup positions 9–14 after eight powder slots", () => {
  assert.equal(getMachineTotalContainerCount(touch), 14);
  assert.equal(getContainerCategory(8, 8, 6), "powder");
  assert.equal(getContainerCategory(9, 8, 6), "concentrate");
  assert.equal(getContainerCategory(14, 8, 6), "concentrate");
  assert.equal(getContainerCategory(15, 8, 6), null);
});

test("missing powder counts use the legacy model fallback; missing syrup counts mean zero", () => {
  for (const name of ["shaker s", "milkshaker"])
    assert.equal(getMachineContainerCount({ name }), 4);
  assert.equal(getMachineContainerCount({ name: "Shaker Touch" }), 8);
  for (const count of [undefined, null, "", -1, 2.5, "invalid"]) {
    assert.equal(
      getMachineSyrupContainerCount({ syrup_container_count: count }),
      0,
    );
  }
  assert.equal(
    getMachineSyrupContainerCount({ syrup_container_count: "6" }),
    6,
  );
  assert.equal(
    getMachineTotalContainerCount({
      name: "unknown",
      syrup_container_count: 3,
    }),
    null,
  );
  assert.equal(getMachineTotalContainerCount({ name: "milkshaker" }), 4);
});

test("physical positions reject zero, fractions and positions beyond the combined count", () => {
  for (const position of [0, -1, 1.5, 8, NaN]) {
    assert.equal(getContainerCategory(position, 4, 3), null);
  }
  assert.equal(
    isValidContainerSlot(7, getMachineTotalContainerCount(small)),
    true,
  );
  assert.equal(getLowestFreeContainerSlot([1, 2, 3, 4], 7), 5);
});

test("syrup capacity uses litres, with per-slot overrides and a 3 litre default", () => {
  assert.equal(getContainerMaxAmountKg(4, 5, 1), 1);
  assert.equal(getContainerMaxAmountKg(4, 6, "0.7"), 0.7);
  assert.equal(getContainerMaxAmountKg(4, 7, null), 3);
  assert.equal(getContainerMaxAmountKg(8, 9), 3);
  assert.equal(clampContainerAmountKg(0.985, 4, 5, 1), 0.985);
  assert.equal(clampContainerAmountKg(1, 4, 6, 1.2), 1);
  assert.equal(clampContainerAmountKg(4, 4, 6, 1.2), 1.2);
  assert.equal(clampContainerAmountKg(2.5, 4, 7), 2.5);
  assert.equal(clampContainerAmountKg(-1, 4, 5), 0);
  assert.equal(clampContainerAmountKg("invalid", 4, 5), 0);
});
