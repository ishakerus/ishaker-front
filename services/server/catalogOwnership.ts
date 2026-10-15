import { requestStrapiRestAsService } from "./strapiClient";

// Creation must fail before uploading if an older Strapi instance would drop
// the author field. Reads can support legacy data; new records need ownership.
export async function requireCatalogAuthorRelation(collection: "tastes" | "brands", clientId: string | number) {
  const query = new URLSearchParams({
    "filters[author][id][$eq]": String(clientId),
    "fields[0]": "name",
    "pagination[pageSize]": "1",
  });
  try {
    await requestStrapiRestAsService(`/api/${collection}?${query}`);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 400 || status === 500) {
      throw Object.assign(new Error("Catalog creation is temporarily unavailable. Please try again later."), { status: 503 });
    }
    throw error;
  }
}
