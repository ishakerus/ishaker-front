import { withSupportPortalApi } from "../../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { withoutMachineNickname } from "../../../../../lib/portal/machinePrivacy";
import {
  assertMachineBelongsToSessionClient,
  getPortalSessionFromApiRequest,
} from "../../../../../lib/portal/auth";
import { requestStrapiRestAsService } from "../../../../../services/server/strapiClient";

const asId = (value: string | string[] | undefined) => {
  const id = Array.isArray(value) ? value[0] : value;
  return id && /^\d+$/.test(id) ? id : "";
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['PUT'].includes(req.method || "")) {
    res.setHeader("Allow", ["PUT"]);
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
  if (!machine) return res.status(403).json({ error: "machine_access_denied" });

  const data: Record<string, unknown> = {};
  if (Object.prototype.hasOwnProperty.call(req.body, "waterType")) {
    if (!['bottle', 'mains'].includes(req.body.waterType)) {
      return res.status(400).json({ error: "invalid_water_type" });
    }
    const amount = Number(req.body.waterAmountLiters);
    if (!Number.isFinite(amount) || amount < 0 || amount > 19) {
      return res.status(400).json({
        error: "invalid_water_amount",
        message: "Water amount must be between 0 and 19 liters.",
      });
    }
    data.water_type = req.body.waterType;
    data.water_amount_liters = Number(amount.toFixed(1));
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "cupsAmount")) {
    const amount = Number(req.body.cupsAmount);
    if (!Number.isInteger(amount) || amount < 0 || amount > 10000) {
      return res.status(400).json({
        error: "invalid_cups_amount",
        message: "Cup amount must be a whole number between 0 and 10,000.",
      });
    }
    data.cups_amount = amount;
  }

  if (!Object.keys(data).length) {
    return res.status(400).json({ error: "no_inventory_updates" });
  }

  try {
    const updated = await requestStrapiRestAsService(`/api/machines/${machine.id}`, {
      method: "PUT",
      body: JSON.stringify({ data }),
    });
    return res.status(200).json({
      machine: withoutMachineNickname(updated as Record<string, unknown>),
    });
  } catch (error) {
    console.error("[portal/machines/:id/inventory] update failed:", error);
    const schemaUnavailable = (error as { status?: number }).status === 500;
    return res.status(schemaUnavailable ? 503 : 500).json({
      error: schemaUnavailable
        ? "inventory_storage_unavailable"
        : "inventory_update_failed",
      message: schemaUnavailable
        ? "Water and cup storage is not active yet. Deploy and restart Strapi, then try again."
        : "Machine inventory could not be saved.",
    });
  }
}

export default withSupportPortalApi(handler);
