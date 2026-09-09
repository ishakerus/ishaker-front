import crypto from "crypto";
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from "next";
import { requestStrapiRestWithJwt } from "../../services/server/strapiClient";
import { readCookie, seal, sessionCookie, unseal } from "./cookies";
import { supportContext, type SupportIdentity } from "./context";

const COOKIE_NAME = "ishaker_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

export type SupportUser = {
  id: number;
  username: string;
  updatedAt: string;
  blocked?: boolean;
  confirmed?: boolean;
  role?: { type?: string };
};

export const isSupportUser = (user?: SupportUser | null) =>
  Boolean(user?.id && user.role?.type === "support" && !user.blocked && user.confirmed !== false);

export const createAdminSession = (user: SupportUser, jwt: string): SupportIdentity => ({
  id: user.id, username: user.username, updatedAt: user.updatedAt, jwt,
  sid: crypto.randomUUID(), expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
});

export const createAdminSessionCookie = (session: SupportIdentity) =>
  sessionCookie(COOKIE_NAME, seal(COOKIE_NAME, session), SESSION_TTL_SECONDS);
export const clearAdminSessionCookie = () => sessionCookie(COOKIE_NAME, "", 0);
export const setAdminSession = (res: NextApiResponse, session: SupportIdentity) =>
  res.setHeader("Set-Cookie", createAdminSessionCookie(session));

export const resolveAdminSession = async (cookieHeader?: string): Promise<SupportIdentity | null> => {
  const session = unseal<SupportIdentity>(COOKIE_NAME, readCookie(cookieHeader, COOKIE_NAME));
  if (!session?.jwt || !session.id || !session.sid || !session.updatedAt) return null;
  try {
    // Consult Strapi on every request: blocked/deleted users, role changes and
    // account/password changes must invalidate an already issued session.
    const user = await requestStrapiRestWithJwt<SupportUser>("/api/users/me", session.jwt);
    if (!isSupportUser(user) || user.id !== session.id || user.updatedAt !== session.updatedAt) return null;
    return { ...session, username: user.username };
  } catch { return null; }
};

export const requireAdminSession = async (context: GetServerSidePropsContext) => {
  context.res.setHeader("Cache-Control", "private, no-store");
  if (await resolveAdminSession(context.req.headers.cookie)) return null;
  return { redirect: { destination: "/login", permanent: false as const } };
};

// API handlers run inside withAdminApi; the context cannot be supplied by a browser.
export const requireAdminApiSession = (_req: NextApiRequest, res: NextApiResponse) => {
  if (supportContext.getStore()) return true;
  res.status(401).json({ error: "admin_unauthorized" });
  return false;
};
