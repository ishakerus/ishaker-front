import type { NextApiRequest, NextApiResponse } from "next";
import { clearPortalSessionCookie } from "../../../lib/portal/auth";
import { clearSupportCabinetCookie } from "../../../lib/admin/impersonation";
import { isSameOriginRequest } from "../../../lib/admin/http";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  if (!isSameOriginRequest(req)) return res.status(403).json({ error: "invalid_origin" });
  res.setHeader("Set-Cookie", [clearPortalSessionCookie(), clearSupportCabinetCookie()]);
  return res.status(200).json({ ok: true });
}
