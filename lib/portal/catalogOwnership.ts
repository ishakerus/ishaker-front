import { type CatalogAuthor, canManageCatalogAsset } from "./catalogAssets";

type Asset = { id: string | number; author?: CatalogAuthor | null };

export function isCatalogAssetVisible(asset: Asset, clientId: string | number) {
  return !asset.author || asset.author.company?.trim().toLowerCase() === "root" || canManageCatalogAsset(asset.author, clientId);
}

// Older Strapi installations reject deep filters on an author relation that
// has not been deployed yet. Fetch through the service account and filter on
// the server so the cabinet still gets shared assets without exposing another
// client's records or granting ownership to legacy, unowned records.
export async function requestVisibleCatalogAssets<T extends Asset>(
  params: URLSearchParams,
  clientId: string | number,
  request: (query: URLSearchParams) => Promise<T[]>,
) {
  const populated = new URLSearchParams(params);
  populated.set("populate[author][fields][0]", "company");
  async function readPages(query: URLSearchParams) {
    const paged = new URLSearchParams(query);
    paged.delete("pagination[start]");
    paged.delete("pagination[limit]");
    paged.set("pagination[pageSize]", "100");
    const assets: T[] = [];
    for (let page = 1; ; page++) {
      paged.set("pagination[page]", String(page));
      const batch = await request(paged);
      assets.push(...batch.filter((asset) => isCatalogAssetVisible(asset, clientId)));
      if (batch.length < 100) return assets;
    }
  }
  try {
    return await readPages(populated);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status !== 400 && status !== 500) throw error;
    const compatible = new URLSearchParams(populated);
    for (const key of Array.from(compatible.keys())) {
      if (key.startsWith("filters[") && key.includes("[author]")) compatible.delete(key);
    }
    // Keep media and author population intact; apply ownership on the server.
    return readPages(compatible);
  }
}
