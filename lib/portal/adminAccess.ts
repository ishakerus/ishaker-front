import crypto from "crypto";
import { seal, unseal } from "../admin/cookies";

const PREFIX = "shared-admin.";
const PURPOSE = "shared-admin-portal";
const TTL_MS = 2 * 60 * 60_000;

type SharedAdminPortalGrant = {
  targetUserId: number;
  passwordVersion: string;
  expiresAt: number;
};

const configuredPassword = () => process.env.ADMIN_PASSWORD || "";

const safeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
};

const passwordVersion = () =>
  crypto.createHash("sha256").update(configuredPassword()).digest("base64url");

export const verifySharedAdminPassword = (candidate: string) => {
  const expected = configuredPassword();
  return Boolean(expected) && safeEqual(candidate, expected);
};

export const createSharedAdminPortalToken = (targetUserId: number) => {
  if (!Number.isSafeInteger(targetUserId) || targetUserId <= 0) {
    throw new Error("A valid portal user id is required.");
  }
  return `${PREFIX}${seal(PURPOSE, {
    targetUserId,
    passwordVersion: passwordVersion(),
    expiresAt: Date.now() + TTL_MS,
  })}`;
};

export const isSharedAdminPortalToken = (token: string | null) =>
  Boolean(token?.startsWith(PREFIX));

export const readSharedAdminPortalUserId = (token: string | null) => {
  if (!token?.startsWith(PREFIX) || !configuredPassword()) return null;
  const grant = unseal<SharedAdminPortalGrant>(
    PURPOSE,
    token.slice(PREFIX.length),
  );
  if (
    !grant ||
    !Number.isSafeInteger(grant.targetUserId) ||
    grant.targetUserId <= 0 ||
    !safeEqual(grant.passwordVersion, passwordVersion())
  ) {
    return null;
  }
  return grant.targetUserId;
};
