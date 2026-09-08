import { withAdminApi } from "../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApiSession } from "../../../../lib/admin/auth";
import { requestStrapiRestAsService } from "../../../../services/server/strapiClient";

const idFrom = (value: string | string[] | undefined) => {
  const id = Array.isArray(value) ? value[0] : value;
  return id && /^\d+$/.test(id) ? id : "";
};
const text = (input: unknown) =>
  typeof input === "string" ? input.trim() : "";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!requireAdminApiSession(req, res)) return;
  if (req.method !== "PUT" && req.method !== "DELETE") {
    res.setHeader("Allow", ["PUT", "DELETE"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }
  const id = idFrom(req.query.id);
  if (!id) return res.status(400).json({ error: "invalid_translation" });
  try {
    if (req.method === "DELETE") {
      const entries: any[] = await requestStrapiRestAsService(
        `/api/translation-entries?filters[translation][id][$eq]=${id}&pagination[pageSize]=2000`,
      );
      for (const entry of entries) {
        await requestStrapiRestAsService(
          `/api/translation-entries/${entry.id}`,
          { method: "DELETE" },
        );
      }
      await requestStrapiRestAsService(`/api/translations/${id}`, {
        method: "DELETE",
      });
      return res.status(200).json({ deleted: true });
    }
    const key = text(req.body?.key);
    if (!key) return res.status(400).json({ error: "translation_key_required" });
    const translation = await requestStrapiRestAsService(
      `/api/translations/${id}`,
      {
        method: "PUT",
        body: JSON.stringify({
          data: {
            key,
            namespace: text(req.body?.namespace),
            description: text(req.body?.description),
          },
        }),
      },
    );
    return res.status(200).json({ translation });
  } catch (error) {
    console.error("[admin/translations/:id] request failed:", error);
    return res.status(500).json({ error: "translation_request_failed" });
  }
}

export default withAdminApi(handler);
