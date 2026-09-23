import type { NextApiRequest, NextApiResponse } from "next";
import { isSameOriginRequest } from "../../lib/admin/http";
import { resolvePortalSession } from "../../lib/portal/auth";
import { requestStrapiRestAsService } from "../../services/server/strapiClient";

const TICKET_STATUSES = new Set(["suggestion", "question", "bug"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const submissions = new Map<string, number[]>();

const resolvedForStatus = (status: string) => {
  if (status === "suggestion") return true;
  if (status === "question") return null;
  return false;
};

const clean = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const requestIp = (req: NextApiRequest) => {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (
    forwardedIp?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown"
  );
};

const consumeRateLimit = (key: string, now = Date.now()) => {
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const recent = (submissions.get(key) || []).filter(
    (timestamp) => timestamp > cutoff,
  );

  if (recent.length >= RATE_LIMIT_MAX) {
    return Math.max(
      1,
      Math.ceil((recent[0] + RATE_LIMIT_WINDOW_MS - now) / 1000),
    );
  }

  recent.push(now);
  submissions.set(key, recent);
  return 0;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader("Cache-Control", "private, no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  if (!isSameOriginRequest(req)) {
    return res.status(403).json({ error: "invalid_origin" });
  }

  const useClient = req.body?.useClient === true;
  const session = useClient
    ? await resolvePortalSession(req.headers.cookie).catch((error) => {
        console.warn("[tickets] session lookup failed:", error);
        return null;
      })
    : null;
  const clientKnown = Boolean(
    session?.access === "client" && session.client?.id,
  );

  const description = clean(req.body?.description);
  const status = clean(req.body?.status);
  const email = clean(req.body?.email).toLowerCase();

  if (!description || description.length > 5000) {
    return res.status(400).json({
      error: "invalid_description",
      message: "Enter a message of up to 5,000 characters.",
    });
  }

  if (!TICKET_STATUSES.has(status)) {
    return res.status(400).json({
      error: "invalid_status",
      message: "Choose what your message is about.",
    });
  }

  if (!clientKnown && (!email || email.length > 254 || !EMAIL_PATTERN.test(email))) {
    return res.status(400).json({
      error: "email_required",
      message: "Enter a valid email address so we can reply.",
    });
  }

  const rateLimitKey = clientKnown
    ? `client:${session!.client.id}`
    : `ip:${requestIp(req)}`;
  const retryAfter = consumeRateLimit(rateLimitKey);
  if (retryAfter) {
    res.setHeader("Retry-After", String(retryAfter));
    return res.status(429).json({
      error: "rate_limited",
      message: "You’ve sent several messages recently. Please try again later.",
    });
  }

  try {
    await requestStrapiRestAsService("/api/tickets", {
      method: "POST",
      body: JSON.stringify({
        data: {
          description,
          status,
          resolved: resolvedForStatus(status),
          ...(clientKnown
            ? { client: session!.client.id }
            : { email }),
        },
      }),
    });

    return res.status(201).json({ created: true });
  } catch (error) {
    console.error("[tickets] create failed:", error);
    return res.status(500).json({
      error: "ticket_create_failed",
      message: "Your message could not be sent. Please try again.",
    });
  }
}
