import { getContainerMaxAmountKg } from "./containerSlots";

export const SYRUP_CAPACITY_OPTIONS = [
  { litres: 0.3, label: "300 ml" },
  { litres: 0.5, label: "500 ml" },
  { litres: 0.7, label: "700 ml" },
  { litres: 0.75, label: "750 ml" },
  { litres: 1, label: "1 litre" },
  { litres: 1.2, label: "1.2 litres" },
  { litres: 1.5, label: "1.5 litres" },
  { litres: 2, label: "2 litres" },
  { litres: 3, label: "3 litres" },
  { litres: 3.785411784, label: "1 US gallon" },
  { litres: 5, label: "5 litres" },
  { litres: 10, label: "10 litres" },
];

export const getSharedSyrupCapacity = (
  cells: Array<{ position: number; max_amount_kg?: unknown }>,
  powderCount: number,
) => {
  const capacities = new Set(
    cells
      .filter((cell) => cell.position > powderCount)
      .map((cell) =>
        getContainerMaxAmountKg(powderCount, cell.position, cell.max_amount_kg),
      ),
  );
  // Keep an existing common capacity; mixed legacy bottles start at the model default.
  return capacities.size === 1 ? [...capacities][0] : 3;
};
