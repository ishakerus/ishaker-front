import { normalizeMediaFilename } from "./mediaFilename";

export type RecoverableTaste = {
  id: number;
  name: string;
  author?: { id: number } | null;
  default_splash?: {
    name?: string;
    author?: { username?: string; client?: { id: number; company?: string } | null } | null;
    images?: Array<{ name?: string }>;
  } | null;
};

export function recoverPortalTasteClient(taste: RecoverableTaste): number | null {
  const splash = taste.default_splash;
  const user = splash?.author;
  const client = user?.client;
  if (taste.author?.id || !client?.id || !client.company?.trim() || client.company.trim().toLowerCase() === "root" || !user?.username || user.username.toLowerCase() === "root") return null;
  if (splash?.name !== `${taste.name} custom splash` || splash.images?.length !== 20) return null;
  // Only the portal generator's specifically named, complete output proves
  // the originating user. Other unowned tastes must remain read-only.
  const safeName = taste.name.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^[-_]+|[-_]+$/g, "");
  if (!safeName) return null;
  const expected = new Set(Array.from({ length: 20 }, (_, index) => normalizeMediaFilename(`taste-${safeName}_${String(index + 1).padStart(2, "0")}.png`)));
  const actual = new Set(splash.images.map((image) => image.name || ""));
  if (actual.size !== 20 || [...expected].some((name) => !actual.has(name))) return null;
  return client.id;
}
