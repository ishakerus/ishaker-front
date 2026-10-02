import type { NextApiRequest, NextApiResponse } from "next";
import { withSupportPortalApi } from "../../../../lib/admin/access";
import { getPortalSessionFromApiRequest } from "../../../../lib/portal/auth";
import { loadProductLinesPage } from "../../../../services/server/productLinePages";

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
      await loadProductLinesPage(session, {
        requestedMachineId: first(req.query.machineId),
        initialNewProduct: first(req.query.action) === "new-product",
      }),
    );
  } catch (error) {
    console.error("[portal/product-lines/bootstrap] load failed:", error);
    return res.status(500).json({
      error: "product_lines_load_failed",
      message: "Product lines could not be loaded.",
    });
  }
}

export default withSupportPortalApi(handler);
