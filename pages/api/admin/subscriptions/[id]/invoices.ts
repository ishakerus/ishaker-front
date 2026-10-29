import type { NextApiRequest, NextApiResponse } from "next";
import { withAdminApi } from "../../../../../lib/admin/access";
import { requireAdminApiSession } from "../../../../../lib/admin/auth";
import { requestStrapiRestAsService } from "../../../../../services/server/strapiClient";
export const config = { maxDuration: 60 };
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApiSession(req, res)) return;
  if (!["GET", "POST"].includes(req.method || "")) { res.setHeader("Allow", ["GET", "POST"]); return res.status(405).json({ error: "method_not_allowed" }); }
  const id = typeof req.query.id === "string" && /^\d+$/.test(req.query.id) ? req.query.id : "";
  if (!id) return res.status(400).json({ message: "Choose a client." });
  try {
    const data = await requestStrapiRestAsService(`/api/client-billing/${id}/account-invoices`, req.method === "POST" ? { method: "POST", body: JSON.stringify(req.body) } : undefined);
    return res.status(200).json(data);
  } catch (error) {
    const caught = error as { status?: number; response?: { error?: { message?: string } } };
    const status = caught.status && caught.status >= 400 && caught.status < 500 ? caught.status : 502;
    return res.status(status).json({ message: status < 500 ? caught.response?.error?.message || "The invoice action failed." : "Could not confirm the invoice action. Refresh before retrying; the same request can be retried safely." });
  }
}
export default withAdminApi(handler);
