import type { NextApiRequest, NextApiResponse } from "next";
import { resolveAdminSession } from "../../../../lib/admin/auth";
import { cabinetMatchesAdmin, clearSupportCabinetCookie, readSupportCabinet } from "../../../../lib/admin/impersonation";
import { isSameOriginRequest } from "../../../../lib/admin/http";
import { recordSupportAudit } from "../../../../lib/admin/audit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (!isSameOriginRequest(req)) return res.status(403).json({ error: "invalid_origin" });
  const cabinet = readSupportCabinet(req.headers.cookie);
  const admin = await resolveAdminSession(req.headers.cookie);
  if (cabinetMatchesAdmin(cabinet, admin)) {
    await recordSupportAudit(admin!, { event: "cabinet_end", target_user_id: cabinet!.targetUserId, client_id: cabinet!.clientId, machine_id: cabinet!.machineId })
      .catch(() => console.error("[support] cabinet exit audit unavailable", { actor: admin!.id }));
  }
  // Clearing an expired session must always remain possible.
  res.setHeader("Set-Cookie", clearSupportCabinetCookie());
  res.setHeader("Cache-Control", "private, no-store");
  return res.status(200).json({ ok: true });
}
