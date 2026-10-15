import { validateCatalogFile } from "./catalogAssets";
import { getStrapiBaseUrl } from "../../services/fetchers";
import type { PortalSplash } from "../../types/portal";

export type GeneratedSplashFrame = {
  name: string;
  type: "image/png";
  data: string;
};

const CANVAS_WIDTH = 619;
const CANVAS_HEIGHT = 617;
const FRAME_COUNT = 20;
const ELEMENT_SCALE = 0.5;

const ELEMENT_MOTION = [
  { angle: -120, distance: 154, speed: 1.18, rotate: 40, offset: [-6, 4], lift: 4 },
  { angle: -104, distance: 168, speed: 1.05, rotate: 20, offset: [-3, -2], lift: 34 },
  { angle: -90, distance: 112, speed: 0.96, rotate: 0, offset: [2, 1], lift: 0 },
  { angle: -76, distance: 170, speed: 1.1, rotate: -20, offset: [5, -3], lift: 34 },
  { angle: -60, distance: 158, speed: 1.24, rotate: -40, offset: [7, 3], lift: 4 },
] as const;

type Drawable = CanvasImageSource & { width: number; height: number };

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

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("An image needed for the splash could not be loaded."));
    image.src = src;
  });

const trimTransparentPixels = (source: HTMLImageElement): HTMLCanvasElement => {
  // Very large phone photos can exhaust the browser while scanning pixels. They
  // do not need their full resolution on a 619px output canvas.
  const maxDimension = 2048;
  const downscale = Math.min(
    1,
    maxDimension / Math.max(source.naturalWidth, source.naturalHeight),
  );
  const width = Math.max(1, Math.round(source.naturalWidth * downscale));
  const height = Math.max(1, Math.round(source.naturalHeight * downscale));
  const working = document.createElement("canvas");
  working.width = width;
  working.height = height;
  const context = working.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("This browser cannot prepare the ingredient images.");
  context.drawImage(source, 0, 0, width, height);

  const pixels = context.getImageData(0, 0, width, height).data;
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) return working;
  const trimmed = document.createElement("canvas");
  trimmed.width = right - left + 1;
  trimmed.height = bottom - top + 1;
  const trimmedContext = trimmed.getContext("2d");
  if (!trimmedContext) throw new Error("This browser cannot prepare the ingredient images.");
  trimmedContext.drawImage(
    working,
    left,
    top,
    trimmed.width,
    trimmed.height,
    0,
    0,
    trimmed.width,
    trimmed.height,
  );
  return trimmed;
};

const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);
const easeInOutSine = (value: number) => -(Math.cos(Math.PI * value) - 1) / 2;

const drawElements = (
  context: CanvasRenderingContext2D,
  elements: Drawable[],
  progress: number,
) => {
  if (progress <= 0) return;

  elements.forEach((element, index) => {
    const motion = ELEMENT_MOTION[index];
    const phaseDelay = index * 0.018;
    const localProgress = Math.min(
      1,
      Math.max(0, (progress - phaseDelay) / (1 - phaseDelay)),
    );
    const eased = easeOutCubic(Math.min(1, localProgress * motion.speed));
    const scaleEased = easeInOutSine(localProgress);
    const angle = (motion.angle * Math.PI) / 180;
    const startX = CANVAS_WIDTH / 2 + motion.offset[0];
    const startY = CANVAS_HEIGHT + 70 + motion.offset[1];
    const endX = startX + Math.cos(angle) * motion.distance;
    const endY = startY + Math.sin(angle) * motion.distance;
    const centerX = startX + (endX - startX) * eased;
    const centerY =
      startY +
      (endY - startY) * eased -
      Math.sin(Math.PI * localProgress) * 18 -
      (50 + motion.lift) * eased;
    const scale = ELEMENT_SCALE * (1 + 0.1 * scaleEased);

    context.save();
    context.globalAlpha = localProgress < 0.18 ? localProgress / 0.18 : 1;
    context.translate(centerX, centerY);
    context.rotate((motion.rotate * scaleEased * Math.PI) / 180);
    context.drawImage(
      element,
      (-element.width * scale) / 2,
      (-element.height * scale) / 2,
      element.width * scale,
      element.height * scale,
    );
    context.restore();
  });
};

const canvasToFrame = (canvas: HTMLCanvasElement, name: string) =>
  new Promise<GeneratedSplashFrame>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("The browser could not encode a generated splash frame."));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("The generated splash frame could not be read."));
      reader.onload = () =>
        resolve({
          name,
          type: "image/png",
          data: String(reader.result || "").split(",")[1] || "",
        });
      reader.readAsDataURL(blob);
    }, "image/png");
  });

const safeTasteName = (name: string) => {
  const safe = name.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^[-_]+|[-_]+$/g, "");
  if (!safe) throw new Error("Enter a valid taste name before generating.");
  return safe;
};

export const generateSplashInBrowser = async ({
  name,
  splash,
  elements,
}: {
  name: string;
  splash: PortalSplash;
  elements: File[];
}): Promise<GeneratedSplashFrame[]> => {
  const frameUrls = sortFrames(splash.images)
    .map((frame) => absoluteMediaUrl(frame.url))
    .filter(Boolean);
  if (frameUrls.length !== FRAME_COUNT) {
    throw new Error(`The selected color splash must contain exactly ${FRAME_COUNT} frames.`);
  }
  if (elements.length !== 5) {
    throw new Error("Choose exactly 5 ingredient images before generating.");
  }
  await Promise.all(elements.map((file, index) =>
    validateCatalogFile(file, "ingredient", `Ingredient image ${index + 1}`),
  ));

  const objectUrls = elements.map((file) => URL.createObjectURL(file));
  try {
    const [baseFrames, sourceElements] = await Promise.all([
      Promise.all(frameUrls.map(loadImage)),
      Promise.all(objectUrls.map(loadImage)),
    ]);
    const preparedElements = sourceElements.map(trimTransparentPixels);
    const safeName = safeTasteName(name);
    const generated: GeneratedSplashFrame[] = [];

    for (let index = 0; index < FRAME_COUNT; index += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser cannot generate splash images.");

      if (index > 0) {
        drawElements(context, preparedElements, index / (FRAME_COUNT - 1));
        context.drawImage(baseFrames[index], 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
      generated.push(
        await canvasToFrame(
          canvas,
          `taste-${safeName}_${String(index + 1).padStart(2, "0")}.png`,
        ),
      );
      // Let React paint the loading state instead of locking the page for all
      // twenty PNG encodes in one long task.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }

    return generated;
  } finally {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
  }
};
