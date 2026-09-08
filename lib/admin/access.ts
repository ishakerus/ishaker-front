import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { resolveAdminSession } from "./auth";
import { supportContext, type SupportIdentity } from "./context";
import { isSameOriginRequest } from "./http";
import { canSupportUseRoute } from "./permissions";
import { hasSupportCabinet } from "./impersonation";
import { resolvePortalSession } from "../portal/auth";
import { recordSupportAudit } from "./audit";
import type { PortalSession } from "../../types/portal";

const runSupportRequest = async (handler: NextApiHandler, req: NextApiRequest, res: NextApiResponse, admin: SupportIdentity, scope: "admin" | "portal", portalSession?: PortalSession) => {
  res.setHeader("Cache-Control", "private, no-store");
  if (!isSameOriginRequest(req)) return res.status(403).json({ error: "invalid_origin" });
  const path = (req.url || "").split("?")[0];
  const method = req.method || "";
  if (!canSupportUseRoute(path, method, scope)) return res.status(403).json({ error: "support_permission_denied", message: "This action is outside your support permissions." });
  const mutation = !["GET", "HEAD"].includes(method);
  const audit = { path, method,
    ...(portalSession?.support ? { target_user_id: portalSession.user.id, client_id: Number(portalSession.client.id), machine_id: portalSession.support.machineId } : {}),
  };
  if (mutation) {
    try { await recordSupportAudit(admin, { event: "write_attempt", ...audit }); }
    catch { return res.status(503).json({ error: "support_audit_unavailable" }); }
  }
  try {
    return await supportContext.run({ ...admin, portalSession }, () => handler(req, res));
  } finally {
    if (mutation) {
      await recordSupportAudit(admin, { event: "write_result", ...audit, status: res.statusCode }).catch(() => {
        console.error("[support] audit result unavailable", { actor: admin.id, ...audit, status: res.statusCode });
      });
    }
  }
};

export const withAdminApi = (handler: NextApiHandler): NextApiHandler => async (req, res) => {
  const admin = await resolveAdminSession(req.headers.cookie);
  if (!admin) return res.status(401).json({ error: "admin_unauthorized" });
  return runSupportRequest(handler, req, res, admin, "admin");
};

export const withSupportPortalApi = (handler: NextApiHandler): NextApiHandler => async (req, res) => {
  if (!hasSupportCabinet(req.headers.cookie)) return handler(req, res);
  const admin = await resolveAdminSession(req.headers.cookie);
  const session = admin ? await resolvePortalSession(req.headers.cookie).catch(() => null) : null;
  if (!admin || !session?.support) return res.status(401).json({ error: "support_session_expired", message: "Return to the dashboard and reopen this cabinet." });
  return runSupportRequest(handler, req, res, admin, "portal", session);
};
