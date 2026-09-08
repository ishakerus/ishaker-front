import { withAdminApi } from "../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApiSession } from "../../../../lib/admin/auth";
import { requestStrapiRestAsService } from "../../../../services/server/strapiClient";

const value = (input: unknown) =>
  typeof input === "string" ? input.trim() : "";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!requireAdminApiSession(req, res)) return;
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }
  try {
    if (req.method === "GET") {
      const translations = await requestStrapiRestAsService(
        "/api/translations?sort[0]=sort_order:ASC&sort[1]=key:ASC&pagination[pageSize]=2000",
      );
      return res.status(200).json({ translations });
    }
    const key = value(req.body?.key);
    if (!key) return res.status(400).json({ error: "translation_key_required" });
    const translation = await requestStrapiRestAsService("/api/translations", {
      method: "POST",
      body: JSON.stringify({
        data: {
          key,
          namespace: value(req.body?.namespace),
          description: value(req.body?.description),
        },
      }),
    });
    return res.status(201).json({ translation });
  } catch (error) {
    console.error("[admin/translations] request failed:", error);
    return res.status(500).json({ error: "translation_request_failed" });
  }
}

export default withAdminApi(handler);
