import { withAdminApi } from "../../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApiSession } from "../../../../../lib/admin/auth";
import { withoutMachineNickname } from "../../../../../lib/portal/machinePrivacy";
import { requestStrapiRestAsService } from "../../../../../services/server/strapiClient";

const idFrom = (value: string | string[] | undefined) => {
  const id = Array.isArray(value) ? value[0] : value;
  return id && /^\d+$/.test(id) ? id : "";
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!requireAdminApiSession(req, res)) return;
  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const machineId = idFrom(req.query.id);
  if (!machineId) return res.status(400).json({ error: "invalid_machine" });
  if (typeof req.body?.has_door_lock !== "boolean") {
    return res.status(400).json({ error: "invalid_has_door_lock" });
  }

  try {
    const machine = await requestStrapiRestAsService(
      `/api/machines/${machineId}`,
      {
        method: "PUT",
        body: JSON.stringify({
          data: { has_door_lock: req.body.has_door_lock },
        }),
      },
    );
    return res.status(200).json({
      machine: withoutMachineNickname(machine as Record<string, unknown>),
    });
  } catch (error) {
    console.error("[admin/machines/:id] update failed:", error);
    return res.status(500).json({ error: "machine_update_failed" });
  }
}

export default withAdminApi(handler);
