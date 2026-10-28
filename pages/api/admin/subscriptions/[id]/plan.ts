import type { NextApiRequest, NextApiResponse } from "next";
import { withAdminApi } from "../../../../../lib/admin/access";
import { requireAdminApiSession } from "../../../../../lib/admin/auth";
import { requestStrapiRestAsService } from "../../../../../services/server/strapiClient";

export const config = { maxDuration: 60 };

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApiSession(req, res)) return;
  if (req.method !== "POST") { res.setHeader("Allow", ["POST"]); return res.status(405).json({ error: "method_not_allowed" }); }
  const id = typeof req.query.id === "string" && /^\d+$/.test(req.query.id) ? req.query.id : "";
  const { action, machineId, priceCents, startsAt } = req.body || {};
  if (!id || !["start", "cancel", "resume", "sync"].includes(action) ||
      (action !== "sync" && (!Number.isSafeInteger(machineId) || machineId <= 0)) ||
      (["start", "resume"].includes(action) && (!Number.isSafeInteger(priceCents) || priceCents < 50))) {
    return res.status(400).json({ error: "invalid_plan_action", message: "Choose a machine and a valid plan action and price." });
  }
  if (["start", "resume"].includes(action) && startsAt != null && (typeof startsAt !== "string" || !Number.isFinite(Date.parse(startsAt)) || new Date(startsAt).toISOString() !== startsAt || Date.parse(startsAt) <= Date.now())) {
    return res.status(400).json({ error: "invalid_start_date", message: "Choose a future date or Now." });
  }
  try {
    const billing = await requestStrapiRestAsService(`/api/client-billing/${id}/admin-plan`, {
      method: "POST", body: JSON.stringify({ action, machine_id: machineId, price_cents: priceCents, starts_at: startsAt }),
    });
    return res.status(200).json({ billing });
  } catch (error) {
    const caught = error as { status?: number; response?: { error?: { message?: string } } };
    const status = caught.status && caught.status >= 400 && caught.status < 500 ? caught.status : 502;
    return res.status(status).json({ error: "plan_action_failed", message: status < 500 ? caught.response?.error?.message || "The plan action could not be completed." : "Stripe plan management is temporarily unavailable." });
  }
}

export default withAdminApi(handler);
