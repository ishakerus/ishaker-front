import { withSupportPortalApi } from "../../../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { getPortalSessionFromApiRequest } from "../../../../../../lib/portal/auth";
import { deleteProductAndAssignments } from "../../../../../../services/server/deleteProduct";
import { requestStrapiRestAsService } from "../../../../../../services/server/strapiClient";
import type { PortalProductLine } from "../../../../../../types/portal";
import { handler as handleProductUpsert } from "../products";

const asId = (value: unknown) => {
  const id = typeof value === "string" ? value.trim() : "";
  return /^\d+$/.test(id) ? id : "";
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!["PUT", "PATCH", "DELETE"].includes(req.method || "")) {
    res.setHeader("Allow", ["PUT", "PATCH", "DELETE"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const session = await getPortalSessionFromApiRequest(req);
  if (!session) return res.status(401).json({ error: "unauthorized" });

  const productLineId = asId(
    Array.isArray(req.query.id) ? req.query.id[0] : req.query.id,
  );
  const productId = asId(
    Array.isArray(req.query.productId)
      ? req.query.productId[0]
      : req.query.productId,
  );
  if (!productLineId || !productId) {
    return res.status(400).json({ error: "invalid_product" });
  }

  if (req.method === "PUT") {
    req.body = { ...(req.body || {}), existingProductId: productId };
    return handleProductUpsert(req, res);
  }

  const params = new URLSearchParams();
  params.set("filters[id][$eq]", productLineId);
  if (session.access === "client") {
    params.set(
      "filters[author][client][id][$eq]",
      String(session.client.id),
    );
  } else {
    params.set("filters[author][id][$eq]", String(session.user.id));
  }
  params.set("populate[products][fields][0]", "name");
  params.set(
    "populate[products][filters][author][id][$eq]",
    String(session.user.id),
  );
  params.set("pagination[pageSize]", "1");

  try {
    const productLines = await requestStrapiRestAsService<PortalProductLine[]>(
      `/api/product-lines?${params.toString()}`,
    );
    const productLine = productLines[0];
    const containsProduct = productLine?.products?.some(
      (product) => String(product.id) === productId,
    );

    if (!productLine?.id || !containsProduct) {
      return res.status(404).json({
        error: "product_not_found",
        message: "Product was not found in this product line.",
      });
    }

    if (req.method === "PATCH") {
      const hasActive = typeof req.body?.isActive === "boolean";
      const hasDependent = typeof req.body?.is_dependent === "boolean";
      const hasMixTargets = Array.isArray(req.body?.can_be_added_to);
      if (!hasActive && !hasDependent && !hasMixTargets) {
        return res.status(400).json({
          error: "invalid_product_update",
          message: "No supported product fields were provided.",
        });
      }

      const targetIds = hasMixTargets
        ? req.body.can_be_added_to.map((value: unknown) =>
            asId(typeof value === "number" ? String(value) : value),
          )
        : [];
      if (
        hasMixTargets &&
        (targetIds.some((id: string) => !id) ||
          targetIds.length > 200 ||
          new Set(targetIds).size !== targetIds.length)
      ) {
        return res.status(400).json({
          error: "invalid_mix_targets",
          message: "Choose unique drinks for this add-on.",
        });
      }

      const data = {
        ...(hasActive ? { isActive: req.body.isActive } : {}),
        ...(hasDependent ? { is_dependent: req.body.is_dependent } : {}),
        ...(hasMixTargets
          ? { can_be_added_to: targetIds.map(Number) }
          : {}),
      };

      await requestStrapiRestAsService(`/api/products/${productId}`, {
        method: "PUT",
        body: JSON.stringify({
          data,
        }),
      });

      return res.status(200).json({
        product: { id: productId, ...data },
      });
    }

    const cleanup = await deleteProductAndAssignments(productId);

    return res.status(200).json({ deleted: true, ...cleanup });
  } catch (error) {
    console.error(
      "[portal/product-lines/:id/products/:productId] mutation failed:",
      error,
    );
    const apiError = error as {
      status?: number;
      response?: { error?: { message?: string } };
    };
    const status = apiError.status && apiError.status < 500 ? apiError.status : 500;
    return res.status(status).json({
      error: "product_deletion_failed",
      message:
        apiError.response?.error?.message ||
        (req.method === "DELETE"
          ? "Product could not be deleted."
          : "Product could not be updated."),
    });
  }
}

export default withSupportPortalApi(handler);
