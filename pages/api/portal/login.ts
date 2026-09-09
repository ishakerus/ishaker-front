import type { NextApiRequest, NextApiResponse } from "next";
import { getStrapiBaseUrl } from "../../../services/fetchers";
import {
  clearPortalSessionCookie,
  createPortalSessionCookie,
  isClientCabinetUser,
  isProductClientUser,
} from "../../../lib/portal/auth";
import {
  requestStrapiRestAsService,
  requestStrapiRestWithJwt,
} from "../../../services/server/strapiClient";
import type { Client } from "../../../types/strapi";
import type { PortalUser } from "../../../types/portal";
import {
  createSharedAdminPortalToken,
  verifySharedAdminPassword,
} from "../../../lib/portal/adminAccess";
import {
  clearLoginFailures,
  isLoginRateLimited,
  isSameOriginRequest,
  loginAttemptKey,
  recordLoginFailure,
} from "../../../lib/admin/http";
import {
  clearAdminSessionCookie,
  createAdminSession,
  createAdminSessionCookie,
  isSupportUser,
  type SupportUser,
} from "../../../lib/admin/auth";
import { clearSupportCabinetCookie } from "../../../lib/admin/impersonation";
import { recordSupportAudit } from "../../../lib/admin/audit";

const findPortalUser = async (identifier: string) => {
  const params = new URLSearchParams();
  params.set("filters[$or][0][email][$eqi]", identifier);
  params.set("filters[$or][1][username][$eqi]", identifier);
  params.set("populate[0]", "client");
  params.set("populate[1]", "role");
  params.set("pagination[pageSize]", "2");
  const users = await requestStrapiRestAsService<PortalUser[]>(
    `/api/users?${params.toString()}`,
  );
  return users.find(
    (user) =>
      user.email?.toLowerCase() === identifier ||
      user.username?.toLowerCase() === identifier,
  );
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (!isSameOriginRequest(req)) {
    return res.status(403).json({ error: "invalid_origin" });
  }

  const identifier =
    typeof req.body?.identifier === "string"
      ? req.body.identifier.trim().toLowerCase()
      : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!identifier || !password) {
    return res.status(400).json({ error: "identifier_and_password_required" });
  }
  const attemptKey = loginAttemptKey(req, identifier);
  if (isLoginRateLimited(attemptKey)) {
    res.setHeader("Retry-After", "900");
    return res.status(429).json({ error: "rate_limited" });
  }

  let authIdentifier = identifier;
  if (!identifier.includes("@")) {
    const params = new URLSearchParams();
    params.set("filters[company][$eqi]", identifier);
    params.set("fields[0]", "portal_email");
    params.set("pagination[pageSize]", "1");
    const clients = await requestStrapiRestAsService<Client[]>(
      `/api/clients?${params.toString()}`,
    ).catch(() => []);
    authIdentifier = clients[0]?.portal_email?.toLowerCase() || identifier;
  }

  if (verifySharedAdminPassword(password)) {
    try {
      const user = await findPortalUser(authIdentifier);
      if (
        !user?.id ||
        user.blocked ||
        user.confirmed === false ||
        (!(
          user.client?.id &&
          (user.client as Client).portal_access_enabled !== false
        ) &&
          !isProductClientUser(user))
      ) {
        recordLoginFailure(attemptKey);
        return res.status(401).json({ error: "invalid_credentials" });
      }
      clearLoginFailures(attemptKey);
      res.setHeader("Set-Cookie", [
        createPortalSessionCookie(createSharedAdminPortalToken(user.id)),
        clearAdminSessionCookie(),
        clearSupportCabinetCookie(),
      ]);
      return res.status(200).json({
        ok: true,
        role: "client",
        redirectTo: "/machines",
        sharedAdminAccess: true,
      });
    } catch (error) {
      console.error("[portal/login] shared admin access failed:", error);
      return res.status(503).json({ error: "portal_auth_unavailable" });
    }
  }

  const response = await fetch(`${getStrapiBaseUrl()}/api/auth/local`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier: authIdentifier, password }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.jwt) {
    recordLoginFailure(attemptKey);
    return res.status(401).json({ error: "invalid_credentials" });
  }

  try {
    const user = await requestStrapiRestWithJwt<PortalUser & SupportUser>(
      "/api/users/me?populate[0]=client&populate[1]=role",
      payload.jwt,
    );

    if (isSupportUser(user)) {
      clearLoginFailures(attemptKey);
      const session = createAdminSession(user, payload.jwt);
      await recordSupportAudit(session, { event: "login" });
      res.setHeader("Set-Cookie", [
        createAdminSessionCookie(session),
        clearPortalSessionCookie(),
        clearSupportCabinetCookie(),
      ]);
      return res.status(200).json({
        ok: true,
        role: "support",
        redirectTo: "/admin",
      });
    }

    if (!isClientCabinetUser(user) && !isProductClientUser(user)) {
      recordLoginFailure(attemptKey);
      return res.status(403).json({ error: "portal_access_required" });
    }

    clearLoginFailures(attemptKey);
    res.setHeader("Set-Cookie", [
      createPortalSessionCookie(payload.jwt),
      clearAdminSessionCookie(),
      clearSupportCabinetCookie(),
    ]);
    return res.status(200).json({
      ok: true,
      role: "client",
      redirectTo: isProductClientUser(user) ? "/product-lines" : "/machines",
    });
  } catch (error) {
    console.error("[portal/login] role resolution failed:", error);
    return res.status(503).json({ error: "portal_auth_unavailable" });
  }
}

export default handler;
