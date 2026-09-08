import type { NextApiRequest, NextApiResponse } from "next";
import { getStrapiBaseUrl } from "../../../services/fetchers";
import { requestStrapiRestWithJwt } from "../../../services/server/strapiClient";
import { createAdminSession, createAdminSessionCookie, isSupportUser, type SupportUser } from "../../../lib/admin/auth";
import { clearSupportCabinetCookie } from "../../../lib/admin/impersonation";
import { consumeLoginAttempt, isSameOriginRequest } from "../../../lib/admin/http";
import { recordSupportAudit } from "../../../lib/admin/audit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (!isSameOriginRequest(req)) return res.status(403).json({ error: "invalid_origin" });
  const identifier = typeof req.body?.identifier === "string" ? req.body.identifier.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!identifier || identifier.length > 254 || !password || password.length > 1024) return res.status(400).json({ error: "credentials_required" });
  if (!consumeLoginAttempt(identifier)) {
    res.setHeader("Retry-After", "900");
    return res.status(429).json({ error: "rate_limited" });
  }
  try {
    const response = await fetch(`${getStrapiBaseUrl()}/api/auth/local`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.jwt) return res.status(401).json({ error: "invalid_credentials" });
    const user = await requestStrapiRestWithJwt<SupportUser>("/api/users/me", payload.jwt);
    if (!isSupportUser(user)) return res.status(403).json({ error: "support_access_required" });
    const session = createAdminSession(user, payload.jwt);
    await recordSupportAudit(session, { event: "login" });
    res.setHeader("Set-Cookie", [createAdminSessionCookie(session), clearSupportCabinetCookie()]);
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(503).json({ error: "admin_auth_unavailable" });
  }
}
