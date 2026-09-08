import { withAdminApi } from "../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApiSession } from "../../../../lib/admin/auth";
import { requestStrapiRestAsService } from "../../../../services/server/strapiClient";
import {
  firstField,
  firstFile,
  parseVoiceClipMultipart,
  validateAndUploadWav,
} from "../../../../services/server/wavUpload";

export const config = { api: { bodyParser: false } };
const categories = new Set(["event", "screen", "cup", "payment", "button"]);
const statuses = new Set(["draft", "reviewed", "approved"]);

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
      const [voiceClips, languages, cups] = await Promise.all([
        requestStrapiRestAsService(
          "/api/voice-clips?populate[0]=language&populate[1]=cup&populate[2]=audio&sort[0]=category:ASC&sort[1]=key:ASC&pagination[pageSize]=2000",
        ),
        requestStrapiRestAsService(
          "/api/languages?sort[0]=sort_order:ASC&sort[1]=name:ASC&pagination[pageSize]=2000",
        ),
        requestStrapiRestAsService(
          "/api/cups?sort[0]=name:ASC&pagination[pageSize]=2000",
        ),
      ]);
      return res.status(200).json({ voiceClips, languages, cups });
    }

    const { fields, files } = await parseVoiceClipMultipart(req);
    const id = firstField(fields.id);
    const languageId = firstField(fields.languageId);
    const category = firstField(fields.category);
    const key = firstField(fields.key).trim();
    const cupId = firstField(fields.cupId);
    const status = firstField(fields.status) || "draft";
    const file = firstFile(files.audio);
    if (
      (id && !/^\d+$/.test(id)) ||
      !/^\d+$/.test(languageId) ||
      !categories.has(category) ||
      !statuses.has(status) ||
      (category === "cup"
        ? !/^\d+$/.test(cupId)
        : !key || /[\\/]/.test(key))
    ) {
      return res.status(400).json({
        error: "invalid_voice_clip",
        message: "Language, category, token/cup, and status are required.",
      });
    }
    if (!id && !file) {
      return res.status(400).json({
        error: "wav_required",
        message: "Upload a WAV for a new voice clip.",
      });
    }
    const uploaded = file ? await validateAndUploadWav(file) : null;
    const voiceClip = await requestStrapiRestAsService(
      id ? `/api/voice-clips/${id}` : "/api/voice-clips",
      {
        method: id ? "PUT" : "POST",
        body: JSON.stringify({
          data: {
            language: Number(languageId),
            category,
            key: category === "cup" ? null : key,
            cup: category === "cup" ? Number(cupId) : null,
            status,
            ...(uploaded ? { audio: uploaded.id } : {}),
          },
        }),
      },
    );
    return res.status(id ? 200 : 201).json({ voiceClip });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Voice clip could not be saved.";
    const isValidationError =
      /^(Audio must|WAV must|File is not|options\.maxFileSize)/i.test(message);
    console.error("[admin/voice-clips] request failed:", error);
    return res.status(isValidationError ? 400 : 500).json({
      error: isValidationError
        ? "invalid_wav"
        : "voice_clip_request_failed",
      message,
    });
  }
}

export default withAdminApi(handler);
