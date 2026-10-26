import type { NextApiRequest, NextApiResponse } from "next";
import { withAdminApi } from "../../../../lib/admin/access";
import { requireAdminApiSession } from "../../../../lib/admin/auth";
import { parseSubscriptionPlan } from "../../../../lib/admin/subscriptions";
import { requestStrapiRestAsService } from "../../../../services/server/strapiClient";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApiSession(req, res)) return;
  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }
  const id = typeof req.query.id === "string" && /^\d+$/.test(req.query.id) ? req.query.id : "";
  const data = parseSubscriptionPlan(req.body);
  if (!id || !data) return res.status(400).json({ error: "invalid_subscription_plan", message: "Select a client, set the restrictions toggle, and enter a valid end date or leave it blank to use Stripe dates." });
  try {
    const client = await requestStrapiRestAsService(`/api/clients/${id}`, { method: "PUT", body: JSON.stringify({ data }) });
    return res.status(200).json({ client });
  } catch (error) {
    const status = (error as { status?: number }).status === 404 ? 404 : 502;
    return res.status(status).json({ error: "subscription_save_failed", message: status === 404 ? "Client not found." : "Subscription settings could not be saved." });
  }
}

export default withAdminApi(handler);
