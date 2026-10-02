import assert from "node:assert/strict";
import test from "node:test";
import type { PortalMachineCell } from "../../types/portal";
import { getMachineMixes } from "./mix";

const product = (
  id: number,
  name: string,
  options: {
    isDependent?: boolean;
    targets?: Array<{ id: number; name: string }>;
  } = {},
) => ({
  id,
  name,
  is_dependent: options.isDependent,
  can_be_added_to: options.targets || [],
});

const cell = (
  position: number,
  assignedProduct: ReturnType<typeof product>,
  isActive = true,
) =>
  ({
    id: position,
    position,
    isActive,
    cell_category: "powder",
    product: assignedProduct,
  }) as PortalMachineCell;

test("machine mixes pair an active add-on container with its active base", () => {
  const vanilla = product(10, "Vanilla Whey");
  const creatine = product(20, "Strawberry Creatine", {
    isDependent: true,
    targets: [{ id: vanilla.id, name: vanilla.name }],
  });

  const result = getMachineMixes([cell(1, vanilla), cell(4, creatine)]);

  assert.deepEqual(
    result.mixes.map((mix) => ({
      addon: mix.addon.name,
      addonPosition: mix.addonPosition,
      base: mix.base.name,
      basePosition: mix.basePosition,
    })),
    [
      {
        addon: "Strawberry Creatine",
        addonPosition: 4,
        base: "Vanilla Whey",
        basePosition: 1,
      },
    ],
  );
  assert.deepEqual(result.warnings, []);
});

test("machine mixes warn for an unloaded target and an unusable dependent add-on", () => {
  const creatine = product(20, "Pure Creatine", {
    isDependent: true,
    targets: [{ id: 10, name: "Vanilla Whey" }],
  });

  const result = getMachineMixes([cell(4, creatine)]);

  assert.equal(result.mixes.length, 0);
  assert.deepEqual(
    result.warnings.map((warning) => warning.message),
    [
      "Pure Creatine can go into Vanilla Whey, but Vanilla Whey isn't in any container.",
      "Pure Creatine is add-on only and nothing on this machine accepts it — it will not be sold.",
    ],
  );
});

test("inactive containers do not create kiosk mixes", () => {
  const vanilla = product(10, "Vanilla Whey");
  const addon = product(20, "Watermelon", {
    targets: [{ id: vanilla.id, name: vanilla.name }],
  });

  const result = getMachineMixes([cell(1, vanilla, false), cell(4, addon)]);

  assert.equal(result.mixes.length, 0);
  assert.equal(result.warnings.length, 1);
});
