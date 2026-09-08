import { withSupportPortalApi } from "../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { assertMachineBelongsToSessionClient, getPortalSessionFromApiRequest } from "../../../lib/portal/auth";
import { requestStrapiRestAsService } from "../../../services/server/strapiClient";
import type { SalesSummary } from "../../../types/strapi";

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] || "" : value || "";
const iso = (value: string, end: boolean) => {
  if (!value) return "";
  const candidate = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z` : value;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }
  const session = await getPortalSessionFromApiRequest(req);
  if (!session || session.access !== "client" || !session.client.id) return res.status(401).json({ error: "unauthorized" });
  const machineId = first(req.query.machineId).trim();
  if (machineId) {
    const machine = /^\d+$/.test(machineId) ? await assertMachineBelongsToSessionClient(session, machineId) : null;
    if (!machine) return res.status(403).json({ error: "machine_access_denied" });
  }
  const group = first(req.query.group);
  if (!(["day", "product", "machine", "cell"] as string[]).includes(group)) return res.status(400).json({ error: "invalid_group" });
  const rawFrom = first(req.query.from).trim();
  const rawTo = first(req.query.to).trim();
  const from = iso(rawFrom, false);
  const to = iso(rawTo, true);
  if ((rawFrom && !from) || (rawTo && !to) || (from && to && from > to)) {
    return res.status(400).json({ error: "invalid_date_range", message: "Enter a valid sales date range." });
  }
  const params = new URLSearchParams({ client: String(session.client.id), group });
  if (machineId) params.set("machine", machineId);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  try {
    return res.status(200).json(await requestStrapiRestAsService<SalesSummary>(`/api/sales-summary?${params.toString()}`));
  } catch (error) {
    console.error("[portal/sales-summary] load failed:", error);
    return res.status(500).json({ error: "sales_summary_failed", message: "Sales summary could not be loaded." });
  }
}

export default withSupportPortalApi(handler);
