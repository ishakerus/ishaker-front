import { withAdminApi } from "../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApiSession } from "../../../../lib/admin/auth";
import { requestStrapiRestAsService } from "../../../../services/server/strapiClient";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!requireAdminApiSession(req, res)) return;
  if (req.method !== "DELETE") {
    res.setHeader("Allow", ["DELETE"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id || !/^\d+$/.test(id)) {
    return res.status(400).json({ error: "invalid_voice_clip" });
  }
  try {
    await requestStrapiRestAsService(`/api/voice-clips/${id}`, {
      method: "DELETE",
    });
    return res.status(200).json({ deleted: true });
  } catch (error) {
    console.error("[admin/voice-clips/:id] delete failed:", error);
    return res.status(500).json({ error: "voice_clip_delete_failed" });
  }
}

export default withAdminApi(handler);
