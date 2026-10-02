import type { NextApiRequest, NextApiResponse } from "next";
import { withSupportPortalApi } from "../../../../../../lib/admin/access";
import { getPortalSessionFromApiRequest } from "../../../../../../lib/portal/auth";
import {
  loadProductEditorPage,
  ProductLinePageNotFoundError,
} from "../../../../../../services/server/productLinePages";

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] || "" : value || "";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const session = await getPortalSessionFromApiRequest(req);
  if (!session) return res.status(401).json({ error: "unauthorized" });
  const productLineId = first(req.query.id);
  const requestedProductId = first(req.query.productId);
  if (
    !/^\d+$/.test(productLineId) ||
    (requestedProductId && !/^\d+$/.test(requestedProductId))
  ) {
    return res.status(404).json({ error: "not_found" });
  }

  try {
    return res.status(200).json(
      await loadProductEditorPage(
        session,
        productLineId,
        requestedProductId,
      ),
    );
  } catch (error) {
    if (error instanceof ProductLinePageNotFoundError) {
      return res.status(404).json({
        error: "not_found",
        message: "Product line not found.",
      });
    }
    console.error(
      `[portal/product-lines/${productLineId}/products/editor] load failed:`,
      error,
    );
    return res.status(500).json({
      error: "product_editor_load_failed",
      message: "Product editor data could not be loaded.",
    });
  }
}

export default withSupportPortalApi(handler);
