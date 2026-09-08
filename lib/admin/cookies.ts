import crypto from "crypto";

const key = () => {
  // ADMIN_PASSWORD is kept as a deployment-compatible secret fallback only.
  // It is never compared with a login form or accepted as a credential.
  const configuredSecret = process.env.ADMIN_SESSION_SECRET;
  if (configuredSecret && configuredSecret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET must contain at least 32 characters.");
  }
  const secret = configuredSecret || process.env.ADMIN_PASSWORD;
  if (!secret) throw new Error("Missing ADMIN_SESSION_SECRET.");
  return crypto.createHash("sha256").update(secret).digest();
};

export const readCookie = (header: string | undefined, name: string) => {
  const value = header?.split(";").map((v) => v.trim()).find((v) => v.startsWith(`${name}=`));
  if (!value) return null;
  try { return decodeURIComponent(value.slice(name.length + 1)); } catch { return null; }
};

export const seal = (purpose: string, data: object) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(purpose));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
};

export const unseal = <T extends { expiresAt: number }>(purpose: string, value: string | null): T | null => {
  if (!value || value.length > 6000) return null;
  try {
    const raw = Buffer.from(value, "base64url");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAAD(Buffer.from(purpose));
    decipher.setAuthTag(raw.subarray(12, 28));
    const data = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8"));
    return Number.isSafeInteger(data.expiresAt) && data.expiresAt > Date.now() ? data : null;
  } catch { return null; }
};

export const sessionCookie = (name: string, value: string, ttl: number) =>
  `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${ttl}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
