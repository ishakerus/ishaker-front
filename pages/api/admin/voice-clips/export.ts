import { withAdminApi } from "../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApiSession } from "../../../../lib/admin/auth";
import { requestStrapiRestAsService } from "../../../../services/server/strapiClient";

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
    const clips: any[] = await requestStrapiRestAsService(
      "/api/voice-clips?filters[status][$eq]=approved&populate[0]=language&populate[1]=cup&populate[2]=audio&sort[0]=language.code:ASC&sort[1]=category:ASC&sort[2]=key:ASC&pagination[pageSize]=2000",
    );
    const manifest = clips.map((clip) => {
      const code = String(clip.language?.code || "").toUpperCase();
      const token = String(
        clip.category === "cup" ? clip.cup?.name : clip.key,
      ).trim();
      return {
        language: clip.language?.code || "",
        category: clip.category,
        key: token,
        filename: `${token}${code}.wav`,
        path: `Audio/${code}/${token}${code}.wav`,
        sourceUrl: clip.audio?.url || null,
      };
    });
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="voice-clips-manifest.json"',
    );
    return res.status(200).send(
      JSON.stringify(
        { generatedAt: new Date().toISOString(), clips: manifest },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error("[admin/voice-clips/export] failed:", error);
    return res.status(500).json({ error: "voice_clip_export_failed" });
  }
}

export default withAdminApi(handler);
