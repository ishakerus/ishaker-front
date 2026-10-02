import type { NextApiRequest, NextApiResponse } from "next";
import { withSupportPortalApi } from "../../../../lib/admin/access";
import { getPortalSessionFromApiRequest } from "../../../../lib/portal/auth";
import { loadMachinesPage } from "../../../../services/server/portalPageLoaders";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const session = await getPortalSessionFromApiRequest(req);
  if (!session) return res.status(401).json({ error: "unauthorized" });
  if (session.access !== "client") {
    return res.status(403).json({ error: "product_access_required" });
  }

  return res.status(200).json(loadMachinesPage(session));
}

export default withSupportPortalApi(handler);
