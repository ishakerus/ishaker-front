// Current paid-add-on kiosks reserve prices <= 0.011 as free placeholders.
// With two decimal places, 0.02 is the smallest charge they can apply.
export const isValidAddonPrice = (value: unknown): boolean => {
  if (typeof value !== "number" && typeof value !== "string") return false;
  if (typeof value === "string" && !value.trim()) return false;
  const price = Number(value);
  return Number.isFinite(price) && (price === 0 || price >= 0.02);
};

export const ADDON_PRICE_ERROR =
  "Set an add-on price of 0 (free) or at least 0.02.";
