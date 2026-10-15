import type { NextApiRequest, NextApiResponse } from "next";
import { getPortalSessionFromApiRequest } from "../../lib/portal/auth";
import { canManageCatalogAsset, type CatalogAuthor } from "../../lib/portal/catalogAssets";
import { requestStrapiRestAsService } from "./strapiClient";

export function deleteCatalogAsset(collection: "tastes" | "brands") {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== "DELETE") {
      res.setHeader("Allow", "DELETE");
      return res.status(405).json({ error: "method_not_allowed" });
    }
    const session = await getPortalSessionFromApiRequest(req);
    if (!session) return res.status(401).json({ error: "unauthorized" });
    if (session.access !== "client") return res.status(403).json({ error: "client_access_required" });
    const id = typeof req.query.id === "string" ? req.query.id : "";
    if (!/^\d+$/.test(id)) return res.status(400).json({ message: "Invalid catalog item." });
    try {
      const query = new URLSearchParams({
        "filters[id][$eq]": id,
        "populate[author][fields][0]": "company",
        "pagination[pageSize]": "1",
        ...(collection === "tastes" ? { "populate[main][fields][0]": "url" } : {}),
      });
      const assets = await requestStrapiRestAsService<Array<{ author?: CatalogAuthor | null; main?: { id: string | number } }>>(`/api/${collection}?${query}`);
      const asset = assets[0];
      if (!asset || !canManageCatalogAsset(asset.author, session.client.id)) {
        return res.status(403).json({ message: "Only your own catalog items can be deleted. Shared and root items are read-only." });
      }
      const usage = new URLSearchParams({ "fields[0]": "name", "pagination[pageSize]": "1" });
      if (collection === "brands") usage.set("filters[brand][id][$eq]", id);
      else {
        usage.set("filters[$or][0][taste][id][$eq]", id);
        if (asset.main?.id) usage.set("filters[$or][1][custom_main][id][$eq]", String(asset.main.id));
      }
      const products = await requestStrapiRestAsService<unknown[]>(`/api/products?${usage}`);
      if (products.length) return res.status(409).json({ message: "This item is used by a product. Remove it from those products before deleting it." });
      await requestStrapiRestAsService(`/api/${collection}/${id}`, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error(`[catalog/${collection}] deletion failed`, error);
      return res.status(500).json({ message: "The item could not be deleted. Please try again." });
    }
  };
}
