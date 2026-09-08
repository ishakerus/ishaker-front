import { withSupportPortalApi } from "../../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";

function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Allow", []);
  return res.status(410).json({
    error: "deprecated_product_line_binding",
    message:
      "Product lines are library records. Configure currency and products on the machine containers.",
  });
}

export default withSupportPortalApi(handler);
