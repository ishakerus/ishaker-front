import { withSupportPortalApi } from "../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { getPortalSessionFromApiRequest } from "../../../../lib/portal/auth";
import { requestWithSplashOwnershipFallback } from "../../../../lib/portal/splashOwnership";
import { requestStrapiRestAsService } from "../../../../services/server/strapiClient";
import {
  decodePortalImage,
  uploadPortalImages,
} from "../../../../services/server/imageUpload";

const GENERATED_FRAME_COUNT = 20;

const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const session = await getPortalSessionFromApiRequest(req);
  if (!session) return res.status(401).json({ error: "unauthorized" });
  if (session.access !== "client") {
    return res.status(403).json({ error: "client_access_required" });
  }

  const name = asString(req.body?.name);
  const circleId = asString(req.body?.circleId);
  const splashId = asString(req.body?.splashId);
  const rawFrames = Array.isArray(req.body?.generatedFrames)
    ? req.body.generatedFrames
    : [];

  if (name.length < 2 || name.length > 80) {
    return res.status(400).json({ error: "invalid_name", message: "Taste name must be 2–80 characters." });
  }
  if (!circleId) {
    return res.status(400).json({ error: "invalid_circle", message: "Select an existing circle image." });
  }
  if (!/^\d+$/.test(splashId)) {
    return res.status(400).json({ error: "invalid_splash", message: "Generate a splash from an existing color splash." });
  }
  if (rawFrames.length !== GENERATED_FRAME_COUNT) {
    return res.status(400).json({
      error: "invalid_generated_splash",
      message: "Generate and preview the custom splash before submitting.",
    });
  }

  try {
    // Reject duplicates before uploading anything: a retried submission
    // must not leave behind another circle, taste and image set.
    const duplicateParams = new URLSearchParams();
    duplicateParams.set("filters[name][$eqi]", name);
    duplicateParams.set("fields[0]", "name");
    duplicateParams.set("pagination[pageSize]", "1");
    const existing = await requestStrapiRestAsService<{ id: string | number }[]>(
      `/api/tastes?${duplicateParams.toString()}`,
    );
    if (Array.isArray(existing) && existing.length > 0) {
      return res.status(409).json({
        error: "duplicate_name",
        message: `A taste named "${name}" already exists. Pick another name.`,
      });
    }

    const circleParams = new URLSearchParams();
    circleParams.set("filters[id][$eq]", circleId);
    circleParams.set("fields[0]", "name");
    circleParams.set("pagination[pageSize]", "1");

    const splashParams = new URLSearchParams();
    splashParams.set("filters[id][$eq]", splashId);
    splashParams.set("filters[name][$startsWithi]", "color ");
    splashParams.set("filters[author][username][$eq]", "root");
    splashParams.set("fields[0]", "name");
    splashParams.set("fields[1]", "color");
    splashParams.set("pagination[pageSize]", "1");

    const [circles, splashes] = await Promise.all([
      requestStrapiRestAsService<Array<{ id: string | number }>>(
        `/api/circles?${circleParams.toString()}`,
      ),
      requestWithSplashOwnershipFallback(
        splashParams,
        (query) =>
          requestStrapiRestAsService<
            Array<{ id: string | number; color?: string | null }>
          >(`/api/splashes?${query.toString()}`),
        () =>
          console.warn(
            "[portal/tastes] splash ownership filtering is unsupported; using the compatible query.",
          ),
      ),
    ]);
    if (!circles[0]) {
      return res.status(400).json({ error: "invalid_circle", message: "Select an existing circle image." });
    }
    if (!splashes[0]) {
      return res.status(400).json({ error: "invalid_splash", message: 'Select a splash whose name starts with "color ".' });
    }

    const main = decodePortalImage(req.body?.main || {}, "Main image");
    const generatedFrames = rawFrames.map((file: unknown, index: number) =>
      decodePortalImage(file || {}, `Generated splash frame ${index + 1}`),
    );
    const uploaded = await uploadPortalImages([main, ...generatedFrames]);

    if (!Array.isArray(uploaded) || uploaded.length !== GENERATED_FRAME_COUNT + 1) {
      throw new Error("Strapi did not return all uploaded splash images.");
    }

    const customSplash = await requestStrapiRestAsService<{ id: string | number }>(
      "/api/splashes",
      {
        method: "POST",
        body: JSON.stringify({
          data: {
            name: `${name} custom splash`,
            color: splashes[0].color || null,
            isEmpty: false,
            images: uploaded.slice(1).map((file) => file.id),
            author: session.user.id,
          },
        }),
      },
    );

    const taste = await requestStrapiRestAsService("/api/tastes", {
      method: "POST",
      body: JSON.stringify({
        data: {
          name,
          main: uploaded[0].id,
          default_circle: circles[0].id,
          default_splash: customSplash.id,
          isWebsiteVisible: false,
          submission_status: "pending",
        },
      }),
    });

    return res.status(201).json({ ok: true, taste });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Custom taste submission failed.";
    console.error("[portal/tastes] submission failed:", error);
    return res.status(500).json({ error: "taste_submission_failed", message });
  }
}

export default withSupportPortalApi(handler);
