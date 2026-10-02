import type { NextApiRequest, NextApiResponse } from "next";
import { withSupportPortalApi } from "../../../../lib/admin/access";
import { getPortalSessionFromApiRequest } from "../../../../lib/portal/auth";
import { loadNewProductLinePage } from "../../../../services/server/productLinePages";

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

  try {
    return res.status(200).json(
      await loadNewProductLinePage(
        session,
        first(req.query.baseProductLineId),
      ),
    );
  } catch (error) {
    console.error("[portal/product-lines/editor] load failed:", error);
    return res.status(500).json({
      error: "product_line_editor_load_failed",
      message: "Product line options could not be loaded.",
    });
  }
}

export default withSupportPortalApi(handler);
