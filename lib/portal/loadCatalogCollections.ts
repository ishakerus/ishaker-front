import type { PortalBrand, PortalCircle, PortalSplash, PortalTaste } from "../../types/portal";

type CatalogCollections = {
  tastes: PortalTaste[];
  brands: PortalBrand[];
  circles: PortalCircle[];
  splashes: PortalSplash[];
};
type CollectionName = keyof CatalogCollections;
type CatalogLoaders = { [K in CollectionName]: () => Promise<CatalogCollections[K]> };

export async function loadCatalogCollections(
  loaders: CatalogLoaders,
  onError: (name: CollectionName, error: unknown) => void,
) {
  const [tastes, brands, circles, splashes] = await Promise.allSettled([
    loaders.tastes(), loaders.brands(), loaders.circles(), loaders.splashes(),
  ]);
  const loadErrors: string[] = [];
  function read<T>(name: CollectionName, result: PromiseSettledResult<T[]>): T[] {
    if (result.status === "fulfilled") return result.value;
    loadErrors.push(name);
    onError(name, result.reason);
    return [];
  }
  return {
    tastes: read("tastes", tastes),
    brands: read("brands", brands),
    circles: read("circles", circles),
    splashes: read("splashes", splashes),
    loadErrors,
  };
}
