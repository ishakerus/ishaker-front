const writableCollections = new Set([
  "machines", "machine-cells", "currencies", "presets", "preset-cells",
  "languages", "translations", "translation-entries", "translation-sets", "voice-clips",
  "products", "product-lines", "tutorials",
]);

export const canSupportWriteStrapi = (path: string, method: string) => {
  const pathname = path.split("?")[0];
  if (pathname === "/api/upload") return method === "POST";
  if (/^\/api\/machines\/\d+\/free-mode$/.test(pathname)) return method === "PUT";
  if (/^\/api\/machines\/\d+\/apply-preset$/.test(pathname)) return method === "POST";
  const match = pathname.match(/^\/api\/([a-z-]+)(?:\/(\d+))?$/);
  if (!match || !writableCollections.has(match[1])) return false;
  return match[2] ? method === "PUT" : method === "POST";
};

export const canSupportUseRoute = (path: string, method: string, scope: "admin" | "portal") => {
  if (["GET", "HEAD"].includes(method)) return true;
  if (!["POST", "PUT", "PATCH"].includes(method)) return false;
  if (scope === "admin") {
    if (/^\/api\/admin\/machines\/\d+\/cabinet$/.test(path)) return method === "POST";
    if (path === "/api/admin/cabinet/exit") return method === "POST";
    return /^\/api\/admin\/(machines|currencies|presets|languages|translations|translation-sets|voice-clips|products|product-lines|tutorials)(?:\/\d+)?(?:\/(free-mode|apply|entries))?$/.test(path);
  }
  // Account settings, promotions, registration and physical door access are
  // outside support's content editing permissions, even while viewing a client.
  return /^\/api\/portal\/machines\/\d+(?:\/(inventory|free-mode|cells|kiosk-texts))?$/.test(path) ||
    /^\/api\/portal\/products\/\d+$/.test(path) ||
    /^\/api\/portal\/product-lines(?:\/\d+)?(?:\/(machine-currency|products)(?:\/\d+)?)?$/.test(path);
};
