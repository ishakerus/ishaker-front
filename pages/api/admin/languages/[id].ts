import { withAdminApi } from "../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApiSession } from "../../../../lib/admin/auth";
import {
  decodePortalImage,
  uploadPortalImages,
} from "../../../../services/server/imageUpload";
import { requestStrapiRestAsService } from "../../../../services/server/strapiClient";

const idFrom = (value: string | string[] | undefined) => {
  const id = Array.isArray(value) ? value[0] : value;
  return id && /^\d+$/.test(id) ? id : "";
};
const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
const sortOrder = (value: unknown) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

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
  if (!id) return res.status(400).json({ error: "invalid_language" });

  try {
    if (req.method === "DELETE") {
      await requestStrapiRestAsService(`/api/languages/${id}`, {
        method: "DELETE",
      });
      return res.status(200).json({ deleted: true });
    }
    const code = text(req.body?.code);
    const name = text(req.body?.name);
    if (!code || !name) {
      return res.status(400).json({ error: "invalid_language" });
    }
    let flagId: string | number | undefined;
    if (req.body?.flag?.data) {
      const uploaded = await uploadPortalImages([
        decodePortalImage(req.body.flag, "Flag"),
      ]);
      flagId = uploaded[0]?.id;
    }
    if (req.body?.isDefault === true) {
      const defaults: any[] = await requestStrapiRestAsService(
        `/api/languages?filters[isDefault][$eq]=true&filters[id][$ne]=${id}&pagination[pageSize]=2000`,
      );
      await Promise.all(
        defaults.map((language) =>
          requestStrapiRestAsService(`/api/languages/${language.id}`, {
            method: "PUT",
            body: JSON.stringify({ data: { isDefault: false } }),
          }),
        ),
      );
    }
    const language = await requestStrapiRestAsService(`/api/languages/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        data: {
          code,
          name,
          native_name: text(req.body?.nativeName),
          isDefault: req.body?.isDefault === true,
          isActive: req.body?.isActive !== false,
          sort_order: sortOrder(req.body?.sortOrder),
          ...(flagId ? { flag: flagId } : {}),
        },
      }),
    });
    return res.status(200).json({ language });
  } catch (error) {
    console.error("[admin/languages/:id] request failed:", error);
    return res.status(500).json({ error: "language_request_failed" });
  }
}

export default withAdminApi(handler);
