import { withSupportPortalApi } from "../../../../lib/admin/access";
import { execFile } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import type { NextApiRequest, NextApiResponse } from "next";
import { getPortalSessionFromApiRequest } from "../../../../lib/portal/auth";
import { requestWithSplashOwnershipFallback } from "../../../../lib/portal/splashOwnership";
import { decodePortalImage } from "../../../../services/server/imageUpload";
import { requestStrapiRestAsService } from "../../../../services/server/strapiClient";
import { getStrapiBaseUrl } from "../../../../services/fetchers";
import type { PortalSplash } from "../../../../types/portal";

const execFileAsync = promisify(execFile);
const GENERATED_FRAME_COUNT = 20;

const asString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const sortFrames = <T extends { name?: string; url?: string }>(frames: T[] = []) =>
  [...frames].sort((left, right) =>
    (left.name || left.url || "").localeCompare(
      right.name || right.url || "",
      undefined,
      { numeric: true, sensitivity: "base" },
    ),
  );

const absoluteMediaUrl = (url?: string) => {
  if (!url) return "";
  return url.startsWith("http") ? url : `${getStrapiBaseUrl()}${url}`;
};

export const config = {
  api: {
    bodyParser: { sizeLimit: "40mb" },
    responseLimit: "50mb",
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
  const splashId = asString(req.body?.splashId);
  const rawElements = Array.isArray(req.body?.elements) ? req.body.elements : [];

  if (name.length < 2 || name.length > 80) {
    return res.status(400).json({
      error: "invalid_name",
      message: "Taste name must be 2–80 characters.",
    });
  }
  if (!/^\d+$/.test(splashId)) {
    return res.status(400).json({
      error: "invalid_splash",
      message: "Select an existing color splash.",
    });
  }
  if (rawElements.length !== 5) {
    return res.status(400).json({
      error: "invalid_elements",
      message: "Choose exactly 5 ingredient images before generating.",
    });
  }

  let temporaryRoot = "";
  try {
    const params = new URLSearchParams();
    params.set("filters[id][$eq]", splashId);
    params.set("filters[name][$startsWithi]", "color ");
    params.set("filters[author][username][$eq]", "root");
    params.set("fields[0]", "name");
    params.set("fields[1]", "color");
    params.set("populate[images][fields][0]", "url");
    params.set("populate[images][fields][1]", "name");
    params.set("pagination[pageSize]", "1");
    const splashes = await requestWithSplashOwnershipFallback(
      params,
      (query) =>
        requestStrapiRestAsService<PortalSplash[]>(
          `/api/splashes?${query.toString()}`,
        ),
      () =>
        console.warn(
          "[portal/tastes/generate] splash ownership filtering is unsupported; using the compatible query.",
        ),
    );
    const splash = splashes[0];
    const baseFrames = sortFrames(splash?.images).filter((frame) => frame.url);

    if (!splash || baseFrames.length !== GENERATED_FRAME_COUNT) {
      return res.status(400).json({
        error: "invalid_splash",
        message: `The selected root color splash must contain exactly ${GENERATED_FRAME_COUNT} frames.`,
      });
    }
    if (!splash.color || !/^#[0-9a-f]{6}$/i.test(splash.color)) {
      return res.status(400).json({
        error: "invalid_splash_color",
        message: "The selected color splash does not have a valid color value.",
      });
    }

    const elements: ReturnType<typeof decodePortalImage>[] = rawElements.map(
      (file: unknown, index: number) =>
        decodePortalImage(file || {}, `Ingredient image ${index + 1}`),
    );

    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ishaker-splash-"));
    const splashDirectory = path.join(temporaryRoot, "splash");
    const elementsDirectory = path.join(temporaryRoot, "elements");
    const resultDirectory = path.join(temporaryRoot, "result");
    await Promise.all([
      fs.mkdir(splashDirectory),
      fs.mkdir(elementsDirectory),
      fs.mkdir(resultDirectory),
    ]);

    await Promise.all(
      baseFrames.map(async (frame, index) => {
        const response = await fetch(absoluteMediaUrl(frame.url));
        if (!response.ok) {
          throw new Error(`Could not download base splash frame ${index + 1}.`);
        }
        const bytes = Buffer.from(await response.arrayBuffer());
        await fs.writeFile(
          path.join(splashDirectory, `base_${String(index + 1).padStart(2, "0")}.png`),
          bytes,
        );
      }),
    );
    await Promise.all(
      elements.map((element, index) =>
        fs.writeFile(
          path.join(elementsDirectory, `element_${String(index + 1).padStart(2, "0")}.png`),
          element.buffer,
        ),
      ),
    );

    const generatorPath = path.resolve(process.cwd(), "../taste/generate.py");
    await execFileAsync(
      "python3",
      [
        generatorPath,
        "--splash-dir",
        splashDirectory,
        "--elements-dir",
        elementsDirectory,
        "--result-dir",
        resultDirectory,
        "--name",
        name,
        "--color",
        splash.color,
      ],
      { timeout: 120_000, maxBuffer: 1024 * 1024 },
    );

    const resultNames = (await fs.readdir(resultDirectory))
      .filter((filename) => filename.toLowerCase().endsWith(".png"))
      .sort((left, right) =>
        left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }),
      );
    if (resultNames.length !== GENERATED_FRAME_COUNT) {
      throw new Error(`The generator returned ${resultNames.length} frames instead of ${GENERATED_FRAME_COUNT}.`);
    }

    const frames = await Promise.all(
      resultNames.map(async (filename) => ({
        name: filename,
        type: "image/png",
        data: (await fs.readFile(path.join(resultDirectory, filename))).toString("base64"),
      })),
    );

    return res.status(200).json({
      frames,
      preview: `data:image/png;base64,${frames[frames.length - 1].data}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Splash generation failed.";
    console.error("[portal/tastes/generate] generation failed:", error);
    return res.status(500).json({ error: "splash_generation_failed", message });
  } finally {
    if (temporaryRoot) {
      await fs.rm(temporaryRoot, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

export default withSupportPortalApi(handler);
