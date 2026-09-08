import type { NextApiRequest } from "next";

export const isSameOriginRequest = (req: NextApiRequest) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method || "")) return true;
  if (req.headers["sec-fetch-site"] === "cross-site") return false;
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    const expected = process.env.APP_ORIGIN;
    const host = req.headers.host;
    const parsed = new URL(origin);
    return expected ? parsed.origin === new URL(expected).origin :
      parsed.host === host && ["http:", "https:"].includes(parsed.protocol);
  } catch { return false; }
};

const attempts = new Map<string, { count: number; until: number }>();
export const consumeLoginAttempt = (identifier: string) => {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const key = identifier.toLowerCase();
  const current = attempts.get(key) || { count: 0, until: now + 15 * 60_000 };
  current.count++;
  attempts.set(key, current);
  return current.count <= 10;
};
