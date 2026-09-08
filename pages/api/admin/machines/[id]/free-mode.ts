import { withAdminApi } from "../../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApiSession } from "../../../../../lib/admin/auth";
import { parseFreeModeMinutes } from "../../../../../lib/freeMode";
import {
  getMachineFreeModeState,
  setMachineFreeMode,
} from "../../../../../services/server/freeMode";

const asId = (value: string | string[] | undefined) => {
  const id = Array.isArray(value) ? value[0] : value;
  return id && /^\d+$/.test(id) ? id : "";
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader("Cache-Control", "private, no-store");
  if (!requireAdminApiSession(req, res)) return;
  if (!["GET", "PUT"].includes(req.method || "")) {
    res.setHeader("Allow", ["GET", "PUT"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const machineId = asId(req.query.id);
  if (!machineId) return res.status(400).json({ error: "invalid_machine" });

  try {
    if (req.method === "GET") {
      const state = await getMachineFreeModeState(machineId);
      return res.status(200).json({ id: machineId, state });
    }

    if (typeof req.body?.enabled !== "boolean") {
      return res.status(400).json({ error: "bad_enabled" });
    }
    const minutes = parseFreeModeMinutes(req.body?.minutes);
    if (minutes === null) {
      return res.status(400).json({ error: "bad_minutes" });
    }

    const rawBaseRev = req.body?.base_rev;
    const baseRev = rawBaseRev === undefined ? undefined : Number(rawBaseRev);
    if (
      baseRev !== undefined &&
      (!Number.isInteger(baseRev) || baseRev < 0)
    ) {
      return res.status(400).json({ error: "bad_base_rev" });
    }

    const result = await setMachineFreeMode(machineId, {
      enabled: req.body.enabled,
      minutes,
      ...(baseRev === undefined ? {} : { base_rev: baseRev }),
    });
    return res.status(200).json(result);
  } catch (error) {
    const status = (error as { status?: number }).status;
    console.error("[admin/machines/:id/free-mode] request failed:", error);
    return res.status(status === 404 ? 404 : 500).json({
      error:
        status === 404
          ? "machine_not_found"
          : req.method === "GET"
            ? "free_mode_load_failed"
            : "free_mode_update_failed",
    });
  }
}

export default withAdminApi(handler);
