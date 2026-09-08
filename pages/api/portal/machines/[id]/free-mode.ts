import { withSupportPortalApi } from "../../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { parseFreeModeMinutes } from "../../../../../lib/freeMode";
import {
  assertMachineBelongsToSessionClient,
  getPortalSessionFromApiRequest,
} from "../../../../../lib/portal/auth";
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
  if (!["GET", "PUT"].includes(req.method || "")) {
    res.setHeader("Allow", ["GET", "PUT"]);
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
    if (req.method === "GET") {
      const state = await getMachineFreeModeState(machine.id);
      return res.status(200).json({ id: machine.id, state });
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

    const result = await setMachineFreeMode(machine.id, {
      enabled: req.body.enabled,
      minutes,
      ...(baseRev === undefined ? {} : { base_rev: baseRev }),
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error("[portal/machines/:id/free-mode] request failed:", error);
    return res.status(500).json({
      error:
        req.method === "GET"
          ? "free_mode_load_failed"
          : "free_mode_update_failed",
    });
  }
}

export default withSupportPortalApi(handler);
