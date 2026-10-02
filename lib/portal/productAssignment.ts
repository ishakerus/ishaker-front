import type { PortalCatalogProduct } from "../../types/portal";

export type ProductAssignmentProblem = {
  code:
    | "product_disabled"
    | "no_product_type"
    | "no_brand"
    | "no_product_line"
    | "no_usable_price"
    | "bad_volume"
    | "no_image";
  detail: string;
};

export const getProductAssignmentProblems = (
  product: PortalCatalogProduct,
): ProductAssignmentProblem[] => {
  const problems: ProductAssignmentProblem[] = [];
  const price = Number(product.dosage?.full_drink_price);
  const volume = Number(product.dosage?.full_drink_volume);

  if (product.isActive === false) {
    problems.push({
      code: "product_disabled",
      detail: "This product is disabled.",
    });
  }
  if (!["powder", "concentrate"].includes(product.product_type || "")) {
    problems.push({
      code: "no_product_type",
      detail: "Choose powder or concentrate.",
    });
  }
  if (!product.brand?.id) {
    problems.push({ code: "no_brand", detail: "Add a brand." });
  }
  if (!product.product_line?.id) {
    problems.push({
      code: "no_product_line",
      detail: "Attach the product to a product line.",
    });
  }
  if (
    product.is_dependent !== true &&
    (!Number.isFinite(price) || price <= 0)
  ) {
    problems.push({
      code: "no_usable_price",
      detail: "Set a full-drink price greater than zero.",
    });
  }
  if (!Number.isFinite(volume) || volume < 50) {
    problems.push({
      code: "bad_volume",
      detail: "Set a full-drink volume of at least 50 ml.",
    });
  }
  if (
    !product.custom_main?.name &&
    !product.taste?.main?.name
  ) {
    problems.push({
      code: "no_image",
      detail: "Add a custom main image or taste image.",
    });
  }
  return problems;
};

export const canAssignProduct = (product: PortalCatalogProduct) =>
  getProductAssignmentProblems(product).length === 0;
