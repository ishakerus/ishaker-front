export const PROMO_QR_CODE_RE = /^[A-Z0-9_-]{1,32}$/;

export const PUBLIC_SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL || "https://ishakeradmin.com";

export const isQrSafePromoCode = (code: string) =>
  PROMO_QR_CODE_RE.test(code.trim().toUpperCase());

export const buildPromoQrUrl = (
  code: string,
  origin = PUBLIC_SITE_ORIGIN,
) =>
  `${origin.replace(/\/+$/, "")}/p/${encodeURIComponent(
    code.trim().toUpperCase(),
  )}`;
