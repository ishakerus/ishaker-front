import type { NextApiRequest, NextApiResponse } from "next";
import { withAdminApi } from "../../../../../lib/admin/access";
import { supportContext } from "../../../../../lib/admin/context";
import { createSupportCabinetCookie } from "../../../../../lib/admin/impersonation";
import { recordSupportAudit } from "../../../../../lib/admin/audit";
import { fetchMachineByIdAsService, isClientCabinetUser } from "../../../../../lib/portal/auth";
import { requestStrapiRestWithJwt } from "../../../../../services/server/strapiClient";
import type { PortalUser } from "../../../../../types/portal";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }
  const id = req.query.id;
  if (typeof id !== "string" || !/^[1-9]\d*$/.test(id)) return res.status(400).json({ error: "invalid_machine" });
  const admin = supportContext.getStore()!;
  try {
    // Derive the client and target from the machine on the server. Never accept
    // an account id, login, password or redirect URL supplied by the browser.
    const machine = await fetchMachineByIdAsService(id);
    if (!machine?.client?.id || machine.client.portal_access_enabled === false) {
      return res.status(409).json({ error: "client_cabinet_unavailable", message: "This machine has no active client cabinet." });
    }
    const params = new URLSearchParams();
    params.set("filters[client][id][$eq]", String(machine.client.id));
    params.set("populate[0]", "client");
    params.set("populate[1]", "role");
    const users = await requestStrapiRestWithJwt<PortalUser[]>(`/api/users?${params}`, admin.jwt);
    const user = users.filter(isClientCabinetUser).sort((a, b) => a.id - b.id)[0];
    if (!user) return res.status(409).json({ error: "client_cabinet_unavailable", message: "This client has no active cabinet login yet." });
    const target = { targetUserId: user.id, clientId: Number(machine.client.id), machineId: Number(id) };
    await recordSupportAudit(admin, { event: "cabinet_start", target_user_id: user.id, client_id: target.clientId, machine_id: target.machineId });
    res.setHeader("Set-Cookie", createSupportCabinetCookie(admin, target));
    return res.status(200).json({ redirect: `/machines/${id}` });
  } catch (error) {
    if ((error as { status?: number }).status === 404) return res.status(404).json({ error: "machine_not_found" });
    return res.status(503).json({ error: "cabinet_unavailable", message: "Client cabinet access is temporarily unavailable." });
  }
}

export default withAdminApi(handler);
