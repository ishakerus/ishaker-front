import { withAdminApi } from "../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApiSession } from "../../../../lib/admin/auth";
import { requestStrapiRestAsService } from "../../../../services/server/strapiClient";

const quoteCsv = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!requireAdminApiSession(req, res)) return;
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }
  try {
    const [languages, translations]: any[] = await Promise.all([
      requestStrapiRestAsService(
        "/api/languages?filters[isActive][$eq]=true&sort[0]=sort_order:ASC&sort[1]=name:ASC&pagination[pageSize]=2000",
      ),
      requestStrapiRestAsService(
        "/api/translations?populate[entries][populate][language]=*&sort[0]=key:ASC&pagination[pageSize]=2000",
      ),
    ]);
    const lines = [
      ["Key", ...languages.map((language: any) => language.name)]
        .map(quoteCsv)
        .join(","),
      ...translations.map((translation: any) => {
        const byLanguage = new Map(
          (translation.entries || [])
            .filter((entry: any) => entry.status === "approved")
            .map((entry: any) => [String(entry.language?.id), entry.value]),
        );
        return [
          translation.key,
          ...languages.map(
            (language: any) => byLanguage.get(String(language.id)) || "",
          ),
        ]
          .map(quoteCsv)
          .join(",");
      }),
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Localization.csv"',
    );
    return res.status(200).send(`\uFEFF${lines.join("\r\n")}\r\n`);
  } catch (error) {
    console.error("[admin/translations/export] failed:", error);
    return res.status(500).json({ error: "translation_export_failed" });
  }
}

export default withAdminApi(handler);
