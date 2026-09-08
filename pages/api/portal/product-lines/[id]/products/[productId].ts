import { withSupportPortalApi } from "../../../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { getPortalSessionFromApiRequest } from "../../../../../../lib/portal/auth";
import { deleteProductAndAssignments } from "../../../../../../services/server/deleteProduct";
import { requestStrapiRestAsService } from "../../../../../../services/server/strapiClient";
import type { PortalProductLine } from "../../../../../../types/portal";

const asId = (value: unknown) => {
  const id = typeof value === "string" ? value.trim() : "";
  return /^\d+$/.test(id) ? id : "";
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH" && req.method !== "DELETE") {
    res.setHeader("Allow", ["PATCH", "DELETE"]);
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
      if (typeof req.body?.isActive !== "boolean") {
        return res.status(400).json({
          error: "invalid_active_state",
          message: "Active state must be true or false.",
        });
      }

      await requestStrapiRestAsService(`/api/products/${productId}`, {
        method: "PUT",
        body: JSON.stringify({
          data: { isActive: req.body.isActive },
        }),
      });

      return res.status(200).json({
        product: { id: productId, isActive: req.body.isActive },
      });
    }

    const cleanup = await deleteProductAndAssignments(productId);

    return res.status(200).json({ deleted: true, ...cleanup });
  } catch (error) {
    console.error(
      "[portal/product-lines/:id/products/:productId] deletion failed:",
      error,
    );
    return res.status(500).json({
      error: "product_deletion_failed",
      message: "Product could not be deleted.",
    });
  }
}

export default withSupportPortalApi(handler);
