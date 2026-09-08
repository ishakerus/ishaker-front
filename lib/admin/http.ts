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

export const loginAttemptKey = (req: NextApiRequest, identifier: string) => {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip = forwardedIp?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  return `${ip}:${identifier.trim().toLowerCase()}`;
};

export const isLoginRateLimited = (key: string) => {
  const now = Date.now();
  for (const [entryKey, value] of attempts) {
    if (value.until <= now) attempts.delete(entryKey);
  }
  return (attempts.get(key)?.count || 0) >= 10;
};

export const recordLoginFailure = (key: string) => {
  const now = Date.now();
  const current = attempts.get(key) || { count: 0, until: now + 15 * 60_000 };
  current.count++;
  attempts.set(key, current);
};

export const clearLoginFailures = (key: string) => attempts.delete(key);
