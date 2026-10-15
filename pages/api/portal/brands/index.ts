import type { NextApiRequest, NextApiResponse } from "next";
import { withSupportPortalApi } from "../../../../lib/admin/access";
import { getPortalSessionFromApiRequest } from "../../../../lib/portal/auth";
import { decodeCatalogImage } from "../../../../services/server/catalogImage";
import { uploadPortalImages } from "../../../../services/server/imageUpload";
import { requestStrapiRestAsService } from "../../../../services/server/strapiClient";

export const config = { api: { bodyParser: { sizeLimit: "8mb" } } };
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  const session = await getPortalSessionFromApiRequest(req);
  if (!session) return res.status(401).json({ error: "unauthorized" });
  if (session.access !== "client") return res.status(403).json({ error: "client_access_required" });
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (name.length < 2 || name.length > 80) return res.status(400).json({ message: "Brand name must be 2–80 characters." });
  try {
    const logo = decodeCatalogImage(req.body?.logo || {}, "brand", "Brand logo");
    const query = new URLSearchParams({ "filters[name][$eqi]": name, "fields[0]": "name", "pagination[pageSize]": "1" });
    const existing = await requestStrapiRestAsService<unknown[]>(`/api/brands?${query}`);
    if (existing.length) return res.status(409).json({ message: "A brand with this name already exists. Pick another name." });
    const uploaded = await uploadPortalImages([logo]);
    if (!uploaded[0]?.id) throw new Error("The logo could not be uploaded.");
    const brand = await requestStrapiRestAsService("/api/brands", {
      method: "POST",
      body: JSON.stringify({ data: { name, logo: uploaded[0].id, author: session.client.id, isPopular: false } }),
    });
    return res.status(201).json({ ok: true, brand });
  } catch (error) {
    const status = (error as { status?: number }).status;
    return res.status(status === 400 ? 400 : 500).json({ message: error instanceof Error ? error.message : "Brand creation failed." });
  }
}
export default withSupportPortalApi(handler);
