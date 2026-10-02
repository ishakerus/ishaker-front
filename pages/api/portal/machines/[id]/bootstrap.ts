import type { NextApiRequest, NextApiResponse } from "next";
import { withSupportPortalApi } from "../../../../../lib/admin/access";
import { getPortalSessionFromApiRequest } from "../../../../../lib/portal/auth";
import {
  loadMachineDetailPage,
  PortalMachineNotFoundError,
} from "../../../../../services/server/portalPageLoaders";

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
  if (session.access !== "client") {
    return res.status(403).json({ error: "product_access_required" });
  }

  try {
    return res
      .status(200)
      .json(await loadMachineDetailPage(session, first(req.query.id)));
  } catch (error) {
    if (error instanceof PortalMachineNotFoundError) {
      return res.status(404).json({
        error: "machine_not_found",
        message: error.message,
      });
    }
    console.error("[portal/machines/:id/bootstrap] load failed:", error);
    return res.status(500).json({
      error: "machine_load_failed",
      message: "Machine details could not be loaded.",
    });
  }
}

export default withSupportPortalApi(handler);
