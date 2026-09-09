const writableCollections = new Set([
  "machines", "machine-cells", "clients", "currencies", "presets", "preset-cells",
  "languages", "translations", "translation-entries", "translation-sets", "voice-clips",
  "products", "product-lines", "components", "tastes", "splashes", "circles",
  "promo-codes", "portal-registration-requests", "door-accesses", "tutorials",
]);

// These are the records a client can remove through an ownership-checked
// portal handler. Support gets the same operation while inside that client's
// cabinet; admin routes still reject DELETE below.
const deletableCollections = new Set([
  "machine-cells", "preset-cells", "products", "product-lines",
  "translation-entries",
]);

export const canSupportWriteStrapi = (path: string, method: string) => {
  const pathname = path.split("?")[0];
  if (pathname === "/api/upload") return method === "POST";
  if (/^\/api\/machines\/\d+\/free-mode$/.test(pathname)) return method === "PUT";
  if (/^\/api\/machines\/\d+\/apply-preset$/.test(pathname)) return method === "POST";
  const match = pathname.match(/^\/api\/([a-z-]+)(?:\/(\d+))?$/);
  if (!match || !writableCollections.has(match[1])) return false;
  if (!match[2]) return method === "POST";
  if (["PUT", "PATCH"].includes(method)) return true;
  return method === "DELETE" && deletableCollections.has(match[1]);
};

export const canSupportUseRoute = (path: string, method: string, scope: "admin" | "portal") => {
  if (["GET", "HEAD"].includes(method)) return true;
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return false;
  if (scope === "admin") {
    if (method === "DELETE") return false;
    if (/^\/api\/admin\/machines\/\d+\/cabinet$/.test(path)) return method === "POST";
    if (path === "/api/admin/cabinet/exit") return method === "POST";
    return /^\/api\/admin\/(machines|currencies|presets|languages|translations|translation-sets|voice-clips|products|product-lines|tutorials)(?:\/\d+)?(?:\/(free-mode|apply|entries))?$/.test(path);
  }
  // A valid support cabinet is bound to one portal user/client. The portal
  // handlers keep their normal ownership checks, so support can safely use the
  // same client-facing operations while every mutation remains audited.
  return /^\/api\/portal(?:\/|$)/.test(path);
};
