import type { NextApiRequest, NextApiResponse } from "next";
import { withSupportPortalApi } from "../../../../../lib/admin/access";
import { getPortalSessionFromApiRequest } from "../../../../../lib/portal/auth";
import {
  loadEditProductLinePage,
  ProductLinePageNotFoundError,
} from "../../../../../services/server/productLinePages";

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
  if (!/^\d+$/.test(productLineId)) {
    return res.status(404).json({ error: "not_found" });
  }

  try {
    return res
      .status(200)
      .json(await loadEditProductLinePage(session, productLineId));
  } catch (error) {
    if (error instanceof ProductLinePageNotFoundError) {
      return res.status(404).json({
        error: "not_found",
        message: "Product line not found.",
      });
    }
    console.error(`[portal/product-lines/${productLineId}/editor] load failed:`, error);
    return res.status(500).json({
      error: "product_line_editor_load_failed",
      message: "Product line options could not be loaded.",
    });
  }
}

export default withSupportPortalApi(handler);
