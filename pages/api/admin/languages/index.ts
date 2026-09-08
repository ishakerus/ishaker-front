import { withAdminApi } from "../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApiSession } from "../../../../lib/admin/auth";
import {
  decodePortalImage,
  uploadPortalImages,
} from "../../../../services/server/imageUpload";
import { requestStrapiRestAsService } from "../../../../services/server/strapiClient";

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
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  if (req.method === "GET") {
    const languages = await requestStrapiRestAsService(
      "/api/languages?populate[flag]=*&sort[0]=sort_order:ASC&sort[1]=name:ASC&pagination[pageSize]=2000",
    ).catch(() => null);
    return languages
      ? res.status(200).json({ languages })
      : res.status(500).json({ error: "language_load_failed" });
  }

  const code = text(req.body?.code);
  const name = text(req.body?.name);
  if (!code || !name) {
    return res.status(400).json({
      error: "invalid_language",
      message: "Code and CSV column-header name are required.",
    });
  }
  try {
    let flagId: string | number | undefined;
    if (req.body?.flag?.data) {
      const file = decodePortalImage(req.body.flag, "Flag");
      const uploaded = await uploadPortalImages([file]);
      flagId = uploaded[0]?.id;
    }
    if (req.body?.isDefault === true) {
      const defaults: any[] = await requestStrapiRestAsService(
        "/api/languages?filters[isDefault][$eq]=true&pagination[pageSize]=2000",
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
    const language = await requestStrapiRestAsService("/api/languages", {
      method: "POST",
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
    return res.status(201).json({ language });
  } catch (error) {
    console.error("[admin/languages] create failed:", error);
    return res.status(500).json({ error: "language_create_failed" });
  }
}

export default withAdminApi(handler);
