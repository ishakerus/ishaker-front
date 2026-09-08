import { withSupportPortalApi } from "../../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import {
  assertMachineBelongsToSessionClient,
  getPortalSessionFromApiRequest,
} from "../../../../../lib/portal/auth";
import { getMachineCatalogProducts } from "../../../../../services/server/machineCells";

const asId = (value: string | string[] | undefined) => {
  const id = Array.isArray(value) ? value[0] : value;
  return id && /^\d+$/.test(id) ? id : "";
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const session = await getPortalSessionFromApiRequest(req);
  if (!session || session.access !== "client") {
    return res.status(401).json({ error: "unauthorized" });
  }

  const machineId = asId(req.query.id);
  const machine = machineId
    ? await assertMachineBelongsToSessionClient(session, machineId)
    : null;
  if (!machine) {
    return res.status(403).json({ error: "machine_access_denied" });
  }

  try {
    res.setHeader("Cache-Control", "private, no-store");
    const products = await getMachineCatalogProducts(machine.id, session.client.id);
    return res.status(200).json(products);
  } catch (error) {
    console.error("[portal/machines/:id/catalog-products] loading failed:", error);
    return res.status(500).json({
      error: "catalog_products_load_failed",
      message: "Machine catalog products could not be loaded.",
    });
  }
}

export default withSupportPortalApi(handler);
