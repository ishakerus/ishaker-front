import { withSupportPortalApi } from "../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { getStrapiBaseUrl } from "../../../services/fetchers";
import { setPortalSession } from "../../../lib/portal/auth";
import { requestStrapiRestAsService } from "../../../services/server/strapiClient";
import type { Client } from "../../../types/strapi";
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const identifier =
    typeof req.body?.identifier === "string"
      ? req.body.identifier.trim().toLowerCase()
      : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!identifier || !password) {
    return res.status(400).json({ error: "identifier_and_password_required" });
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

  const response = await fetch(`${getStrapiBaseUrl()}/api/auth/local`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier: authIdentifier, password }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.jwt) {
    return res.status(401).json({ error: "invalid_credentials" });
  }

  setPortalSession(res, payload.jwt);
  return res.status(200).json({ ok: true });
}

export default withSupportPortalApi(handler);
