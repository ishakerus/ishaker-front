export type MachineTypeContainerSource = {
  container_count?: unknown;
  syrup_container_count?: unknown;
  name?: unknown;
};

export const getMachineContainerCount = (
  machineType?: MachineTypeContainerSource | null,
) => {
  const configuredCount = Number(machineType?.container_count);
  if (Number.isInteger(configuredCount) && configuredCount > 0) {
    return configuredCount;
  }

  // Preserve support for existing machine types that predate container_count.
  const model = String(machineType?.name || "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
  if (model.includes("touch")) return 8;
  if (
    model === "shaker s" ||
    model.endsWith(" shaker s") ||
    model === "milkshaker" ||
    model.endsWith(" milkshaker")
  ) {
    return 4;
  }
  return null;
};

export const getMachineSyrupContainerCount = (
  machineType?: MachineTypeContainerSource | null,
) => {
  const count = Number(machineType?.syrup_container_count);
  return Number.isInteger(count) && count >= 0 ? count : 0;
};

export const getMachineTotalContainerCount = (
  machineType?: MachineTypeContainerSource | null,
) => {
  const powderCount = getMachineContainerCount(machineType);
  return powderCount === null
    ? null
    : powderCount + getMachineSyrupContainerCount(machineType);
};

export const getContainerCategory = (
  position: number,
  powderCount: number,
  syrupCount: number,
): "powder" | "concentrate" | null => {
  if (!isValidContainerSlot(position, powderCount + syrupCount)) return null;
  return position <= powderCount ? "powder" : "concentrate";
};

// amount_kg and max_amount_kg store kilograms for powder and litres for syrup.
export const getContainerMaxAmountKg = (
  containerCount: number,
  position = 1,
  maxAmountKg?: unknown,
) => {
  const configured = Number(maxAmountKg);
  if (Number.isFinite(configured) && configured > 0) return configured;
  if (position > containerCount) return 3;
  return containerCount === 8 ? 5.5 : 1.5;
};

export const clampContainerAmountKg = (
  amountKg: unknown,
  containerCount: number,
  position = 1,
  maxAmountKg?: unknown,
) => {
  const amount = Number(amountKg);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.min(
    amount,
    getContainerMaxAmountKg(containerCount, position, maxAmountKg),
  );
};

export const getLowestFreeContainerSlot = (
  positions: number[],
  containerCount: number,
) => {
  const occupied = new Set(positions);
  for (let slot = 1; slot <= containerCount; slot += 1) {
    if (!occupied.has(slot)) return slot;
  }
  return null;
};

export const getDuplicateContainerSlots = (positions: number[]) => {
  const counts = new Map<number, number>();
  positions.forEach((position) =>
    counts.set(position, (counts.get(position) || 0) + 1),
  );
  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([position]) => position),
  );
};

export const isValidContainerSlot = (
  position: number,
  containerCount: number | null,
) =>
  containerCount !== null &&
  Number.isInteger(position) &&
  position >= 1 &&
  position <= containerCount;
