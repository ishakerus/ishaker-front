import type { NextApiRequest, NextApiResponse } from "next";
import { withSupportPortalApi } from "../../../lib/admin/access";
import { isSameOriginRequest } from "../../../lib/admin/http";
import { getPortalSessionFromApiRequest } from "../../../lib/portal/auth";
import { requestStrapiRestAsService } from "../../../services/server/strapiClient";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (!["GET", "POST"].includes(req.method || "")) {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (!isSameOriginRequest(req)) return res.status(403).json({ error: "invalid_origin" });
  const session = await getPortalSessionFromApiRequest(req);
  if (!session || session.access !== "client" || !session.client.id) return res.status(401).json({ error: "unauthorized" });
  const base = `/api/client-billing/${session.client.id}`;
  try {
    if (req.method === "GET") return res.status(200).json(await requestStrapiRestAsService(base));
    const action = req.body?.action;
    if (!["checkout", "portal", "sync"].includes(action)) return res.status(400).json({ error: "invalid_billing_action" });
    const machineId = req.body?.machineId;
    if (action === "checkout" && (!Number.isSafeInteger(machineId) || !session.machines.some((m) => String(m.id) === String(machineId)))) {
      return res.status(403).json({ error: "machine_access_denied" });
    }
    return res.status(200).json(await requestStrapiRestAsService(`${base}/${action}`, {
      method: "POST", body: JSON.stringify(action === "checkout" ? { machine_id: machineId } : {}),
    }));
  } catch (error) {
    const caught = error as { status?: number; response?: { error?: { message?: string } } };
    const status = caught.status && caught.status >= 400 && caught.status < 500 ? caught.status : 502;
    return res.status(status).json({
      error: "billing_request_failed",
      message: status < 500 ? caught.response?.error?.message || "The billing action could not be completed." : "Billing is temporarily unavailable. Check the Stripe configuration or try again.",
    });
  }
}

export default withSupportPortalApi(handler);
