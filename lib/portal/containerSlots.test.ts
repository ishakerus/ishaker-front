import assert from "node:assert/strict";
import test from "node:test";
import {
  clampContainerAmountKg,
  getContainerMaxAmountKg,
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
