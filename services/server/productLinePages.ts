import { requestWithSplashOwnershipFallback } from "../../lib/portal/splashOwnership";
import type {
  PortalBrand,
  PortalCircle,
  PortalComponent,
  PortalProduct,
  PortalProductLine,
  PortalSession,
  PortalSplash,
  PortalTaste,
} from "../../types/portal";
import type { Currency } from "../../types/strapi";
import {
  getMachineCatalogProducts,
  getMachineCells,
} from "./machineCells";
import { requestStrapiRestAsService } from "./strapiClient";

const REFERENCE_CACHE_MS = 15 * 60 * 1000;

type ReferenceCacheEntry = {
  expiresAt: number;
  value: Promise<unknown>;
};

const referenceCache = new Map<string, ReferenceCacheEntry>();

const cachedReference = <T>(key: string, load: () => Promise<T>): Promise<T> => {
  const cached = referenceCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as Promise<T>;
  }

  const value = load().catch((error) => {
    referenceCache.delete(key);
    throw error;
  });
  referenceCache.set(key, {
    expiresAt: Date.now() + REFERENCE_CACHE_MS,
    value,
  });
  return value;
};

export class ProductLinePageNotFoundError extends Error {
  constructor(message = "Product line not found.") {
    super(message);
    this.name = "ProductLinePageNotFoundError";
  }
}

type ProductWithLine = PortalProduct & {
  product_line?: Pick<PortalProductLine, "id" | "name"> | null;
};

const createProductLineParams = (session: PortalSession) => {
  const params = new URLSearchParams();
  if (session.access === "client") {
    params.set("filters[author][client][id][$eq]", String(session.client.id));
  } else {
    params.set("filters[author][id][$eq]", String(session.user.id));
  }
  params.set("populate[author][fields][0]", "username");
  params.set("populate[cups][populate][image][fields][0]", "url");
  params.set("populate[cups][populate][image][fields][1]", "formats");
  params.set(
    "populate[cups][populate][default_splash][populate][images][fields][0]",
    "url",
  );
  params.set(
    "populate[cups][populate][default_splash][populate][images][fields][1]",
    "formats",
  );
  params.set(
    "populate[cups][populate][default_splash][populate][images][fields][2]",
    "name",
  );
  params.set("populate[base_product_line][fields][0]", "name");
  params.set("sort[0]", "name:ASC");
  params.set("pagination[pageSize]", "2000");
  return params;
};

const createProductParams = (session: PortalSession) => {
  const params = new URLSearchParams();
  if (session.access === "client") {
    params.set("filters[author][client][id][$eq]", String(session.client.id));
  } else {
    params.set("filters[author][id][$eq]", String(session.user.id));
  }
  params.set("fields[0]", "name");
  params.set("fields[1]", "isActive");
  params.set("fields[2]", "product_type");
  params.set("fields[3]", "is_dependent");
  params.set("populate[custom_main][fields][0]", "url");
  params.set("populate[custom_main][fields][1]", "formats");
  params.set("populate[taste][populate][main][fields][0]", "url");
  params.set("populate[taste][populate][main][fields][1]", "formats");
  params.set(
    "populate[taste][populate][default_splash][populate][images][fields][0]",
    "url",
  );
  params.set(
    "populate[taste][populate][default_splash][populate][images][fields][1]",
    "formats",
  );
  params.set(
    "populate[taste][populate][default_splash][populate][images][fields][2]",
    "name",
  );
  params.set("populate[product_line][fields][0]", "name");
  params.set("populate[brand][fields][0]", "name");
  params.set("populate[brand][populate][logo][fields][0]", "url");
  params.set("populate[brand][populate][logo][fields][1]", "formats");
  params.set("populate[dosage]", "*");
  params.set("populate[can_be_added_to][fields][0]", "name");
  params.set("populate[cup][fields][0]", "name");
  params.set("populate[cup][populate][image][fields][0]", "url");
  params.set("populate[cup][populate][image][fields][1]", "formats");
  params.set(
    "populate[cup][populate][default_splash][populate][images][fields][0]",
    "url",
  );
  params.set(
    "populate[cup][populate][default_splash][populate][images][fields][1]",
    "formats",
  );
  params.set(
    "populate[cup][populate][default_splash][populate][images][fields][2]",
    "name",
  );
  params.set("populate[custom_splash][fields][0]", "name");
  params.set("populate[custom_splash][populate][images][fields][0]", "url");
  params.set(
    "populate[custom_splash][populate][images][fields][1]",
    "formats",
  );
  params.set("populate[custom_splash][populate][images][fields][2]", "name");
  params.set("sort[0]", "name:ASC");
  params.set("pagination[pageSize]", "2000");
  return params;
};

const createRootProductLineParams = (includeEditorFields = false) => {
  const params = new URLSearchParams();
  params.set("filters[author][username][$eq]", "root");
  params.set("fields[0]", "name");
  params.set("fields[1]", "isPopular");
  if (includeEditorFields) {
    params.set("fields[2]", "is_template");
    params.set("populate[can_be_added_to][fields][0]", "name");
    params.set("populate[cups][populate][image]", "*");
    params.set(
      "populate[cups][populate][default_splash][populate][images]",
      "*",
    );
    params.set("populate[custom_splash]", "*");
  }
  params.set("sort[0]", "isPopular:DESC");
  params.set("sort[1]", "name:ASC");
  params.set("pagination[pageSize]", "2000");
  return params;
};

const loadRootProductLines = (includeEditorFields = false) => {
  const params = createRootProductLineParams(includeEditorFields);
  const key = includeEditorFields
    ? "product-lines:root:editor"
    : "product-lines:root:list";
  return cachedReference(key, () =>
    requestStrapiRestAsService<PortalProductLine[]>(
      `/api/product-lines?${params.toString()}`,
    ),
  );
};

export const loadProductLinesPage = async (
  session: PortalSession,
  options: { requestedMachineId?: string; initialNewProduct?: boolean } = {},
) => {
  const initialMachineId = session.machines.some(
    (machine) => String(machine.id) === options.requestedMachineId,
  )
    ? options.requestedMachineId
    : undefined;

  const containerData = Promise.all([
    session.machines[0]
      ? getMachineCatalogProducts(
          session.machines[0].id,
          session.client.id,
        )
      : Promise.resolve([]),
    ...session.machines.map((machine) =>
      getMachineCells(machine.id)
        .then((cells) => ({ machine, cells, loadError: null }))
        .catch((error) => {
          console.error(
            `[product-lines] containers for machine ${machine.id} failed:`,
            error,
          );
          return {
            machine,
            cells: [],
            loadError: "Machine containers could not be loaded.",
          };
        }),
    ),
  ]).catch((error) => {
    console.error("[product-lines] container catalog loading failed:", error);
    return [
      [],
      ...session.machines.map((machine) => ({
        machine,
        cells: [],
        loadError: "Product library could not be loaded for assignment.",
      })),
    ];
  });

  const libraryData = Promise.all([
    requestStrapiRestAsService<PortalProductLine[]>(
      `/api/product-lines?${createProductLineParams(session).toString()}`,
    ),
    requestStrapiRestAsService<ProductWithLine[]>(
      `/api/products?${createProductParams(session).toString()}`,
    ),
    loadRootProductLines(),
  ]);

  const [containers, library] = await Promise.all([
    containerData,
    libraryData.catch((error) => {
      console.error("[product-lines] loading failed:", error);
      return null;
    }),
  ]);
  const [catalogProducts, ...machineAssignments] = containers;

  if (!library) {
    return {
      session,
      productLines: [],
      rootProductLines: [],
      orphanProducts: [],
      catalogProducts,
      machineAssignments,
      ...(initialMachineId ? { initialMachineId } : {}),
      ...(options.initialNewProduct ? { initialNewProduct: true } : {}),
      loadError: "Product lines could not be loaded.",
    };
  }

  const [ownProductLines, ownProducts, rootProductLines] = library;
  const productLines = ownProductLines.map((productLine) => ({
    ...productLine,
    products: ownProducts.filter(
      (product) =>
        String(product.product_line?.id) === String(productLine.id),
    ),
  }));

  return {
    session,
    productLines,
    rootProductLines,
    orphanProducts: ownProducts.filter((product) => !product.product_line),
    catalogProducts,
    machineAssignments,
    ...(initialMachineId ? { initialMachineId } : {}),
    ...(options.initialNewProduct ? { initialNewProduct: true } : {}),
  };
};

const createSplashParams = (session: PortalSession) => {
  const params = new URLSearchParams();
  params.set("filters[$or][0][author][username][$eq]", "root");
  params.set(
    "filters[$or][1][author][id][$eq]",
    String(session.user.id),
  );
  params.set("fields[0]", "name");
  params.set("fields[1]", "color");
  params.set("fields[2]", "isEmpty");
  params.set("sort[0]", "name:ASC");
  params.set("pagination[pageSize]", "2000");
  return params;
};

const loadVisibleSplashes = (
  session: PortalSession,
  logLabel: string,
) => {
  const params = createSplashParams(session);
  const request = (query: URLSearchParams) =>
    requestStrapiRestAsService<PortalSplash[]>(
      `/api/splashes?${query.toString()}`,
    );
  return requestWithSplashOwnershipFallback(params, request, () =>
    console.warn(
      `[${logLabel}] splash ownership filtering is unsupported; using the compatible query.`,
    ),
  );
};

export const loadNewProductLinePage = async (
  session: PortalSession,
  requestedBaseProductLineId?: string,
) => {
  const existingParams = new URLSearchParams();
  if (session.access === "client") {
    existingParams.set(
      "filters[author][client][id][$eq]",
      String(session.client.id),
    );
  } else {
    existingParams.set("filters[author][id][$eq]", String(session.user.id));
  }
  existingParams.set("fields[0]", "name");
  existingParams.set("populate[base_product_line][fields][0]", "name");
  existingParams.set("pagination[pageSize]", "2000");

  try {
    const [rootProductLines, splashes, existingProductLines] =
      await Promise.all([
        loadRootProductLines(true),
        loadVisibleSplashes(session, "product-lines/new").catch((error) => {
          console.error(
            "[product-lines/new] splash option loading failed:",
            error,
          );
          return [];
        }),
        requestStrapiRestAsService<PortalProductLine[]>(
          `/api/product-lines?${existingParams.toString()}`,
        ),
      ]);
    const initialBaseProductLineId = rootProductLines.some(
      (line) => String(line.id) === requestedBaseProductLineId,
    )
      ? requestedBaseProductLineId
      : undefined;

    return {
      session,
      rootProductLines,
      existingProductLines,
      splashes,
      ...(initialBaseProductLineId ? { initialBaseProductLineId } : {}),
    };
  } catch (error) {
    console.error("[product-lines/new] option loading failed:", error);
    return {
      session,
      rootProductLines: [],
      existingProductLines: [],
      splashes: [],
      loadError: "Product line options could not be loaded.",
    };
  }
};

export const loadEditProductLinePage = async (
  session: PortalSession,
  productLineId: string,
) => {
  const ownParams = new URLSearchParams();
  ownParams.set("filters[id][$eq]", productLineId);
  if (session.client.id) {
    ownParams.set(
      "filters[author][client][id][$eq]",
      String(session.client.id),
    );
  } else {
    ownParams.set("filters[author][id][$eq]", String(session.user.id));
  }
  ownParams.set("populate[base_product_line][fields][0]", "name");
  ownParams.set("fields[0]", "name");
  ownParams.set("fields[1]", "is_template");
  ownParams.set("populate[can_be_added_to][fields][0]", "name");
  ownParams.set(
    "populate[base_product_line][populate][can_be_added_to][fields][0]",
    "name",
  );
  ownParams.set("populate[cups][populate][image]", "*");
  ownParams.set(
    "populate[cups][populate][default_splash][populate][images]",
    "*",
  );
  ownParams.set("populate[custom_splash]", "*");
  ownParams.set("pagination[pageSize]", "2000");

  const templateParams = new URLSearchParams();
  templateParams.set("filters[is_template][$eq]", "true");
  templateParams.set("fields[0]", "name");
  templateParams.set("fields[1]", "is_template");
  templateParams.set("populate[can_be_added_to][fields][0]", "name");
  templateParams.set("sort[0]", "name:ASC");
  templateParams.set("pagination[pageSize]", "2000");

  const [ownProductLines, rootProductLines, templateProductLines, splashes] =
    await Promise.all([
      requestStrapiRestAsService<PortalProductLine[]>(
        `/api/product-lines?${ownParams.toString()}`,
      ),
      loadRootProductLines(true),
      session.access === "product"
        ? requestStrapiRestAsService<PortalProductLine[]>(
            `/api/product-lines?${templateParams.toString()}`,
          )
        : Promise.resolve([]),
      loadVisibleSplashes(session, "product-lines/edit"),
    ]);

  if (!ownProductLines[0]) throw new ProductLinePageNotFoundError();

  return {
    session,
    productLine: ownProductLines[0],
    rootProductLines,
    templateProductLines,
    splashes,
  };
};

const createProductEditorParams = (productLineId: string, session: PortalSession) => {
  const params = new URLSearchParams();
  params.set("filters[id][$eq]", productLineId);
  if (session.access === "client") {
    params.set(
      "filters[author][client][id][$eq]",
      String(session.client.id),
    );
  } else {
    params.set("filters[author][id][$eq]", String(session.user.id));
  }
  params.set("fields[0]", "name");
  params.set("populate[cups][populate][image][fields][0]", "url");
  params.set("populate[cups][populate][image][fields][1]", "formats");
  params.set("populate[base_product_line][fields][0]", "name");
  params.set(
    "populate[base_product_line][populate][can_be_added_to][fields][0]",
    "name",
  );
  params.set(
    "populate[base_product_line][populate][cups][populate][image][fields][0]",
    "url",
  );
  params.set(
    "populate[base_product_line][populate][cups][populate][image][fields][1]",
    "formats",
  );
  params.set("pagination[pageSize]", "2000");
  return params;
};

const createRootProductParams = () => {
  const params = new URLSearchParams();
  params.set("filters[author][username][$eq]", "root");
  params.set("fields[0]", "name");
  params.set("fields[1]", "description");
  params.set("fields[2]", "product_type");
  params.set("fields[3]", "serving_qty");
  params.set("fields[4]", "serving_unit");
  params.set("fields[5]", "product_purpose");
  params.set("fields[6]", "is_dependent");
  params.set("populate[custom_main][fields][0]", "url");
  params.set("populate[custom_main][fields][1]", "formats");
  params.set("populate[cup][populate][image][fields][0]", "url");
  params.set("populate[cup][populate][image][fields][1]", "formats");
  params.set("populate[custom_splash][fields][0]", "name");
  params.set("populate[custom_circle][fields][0]", "name");
  params.set("populate[custom_circle][populate][images][fields][0]", "url");
  params.set(
    "populate[custom_circle][populate][images][fields][1]",
    "formats",
  );
  params.set("populate[taste][populate][main][fields][0]", "url");
  params.set("populate[taste][populate][main][fields][1]", "formats");
  params.set("populate[taste][populate][default_splash][fields][0]", "name");
  params.set("populate[taste][populate][default_circle][fields][0]", "name");
  params.set("populate[components][fields][0]", "name");
  params.set("populate[components][fields][1]", "unit");
  params.set("populate[components][fields][2]", "default_value");
  params.set("populate[nutrition]", "*");
  params.set("populate[dosage]", "*");
  params.set("populate[author][fields][0]", "username");
  params.set("populate[product_line][fields][0]", "name");
  params.set("populate[can_be_added_to][fields][0]", "name");
  params.set("populate[brand][fields][0]", "name");
  params.set("populate[brand][populate][logo][fields][0]", "url");
  params.set("populate[brand][populate][logo][fields][1]", "formats");
  params.set("sort[0]", "name:ASC");
  params.set("pagination[pageSize]", "2000");
  return params;
};

const createReferenceParams = (
  fields: string[],
  populate: Array<[string, string]> = [],
) => {
  const params = new URLSearchParams();
  fields.forEach((field, index) => params.set(`fields[${index}]`, field));
  populate.forEach(([key, value]) => params.set(key, value));
  params.set("sort[0]", fields.includes("name") ? "name:ASC" : "id:ASC");
  params.set("pagination[pageSize]", "2000");
  return params;
};

export const loadProductEditorPage = async (
  session: PortalSession,
  productLineId: string,
  requestedProductId = "",
) => {
  const productLines = await requestStrapiRestAsService<PortalProductLine[]>(
    `/api/product-lines?${createProductEditorParams(productLineId, session).toString()}`,
  );
  const productLine = productLines[0];
  const genericProductLineId = productLine?.base_product_line?.id;
  if (!productLine || !genericProductLineId) {
    throw new ProductLinePageNotFoundError();
  }

  const rootProductParams = createRootProductParams();
  rootProductParams.set(
    "filters[product_line][id][$eq]",
    String(genericProductLineId),
  );

  const editingProductParams = createRootProductParams();
  editingProductParams.delete("filters[author][username][$eq]");
  editingProductParams.set("filters[id][$eq]", requestedProductId);
  editingProductParams.set(
    "filters[author][id][$eq]",
    String(session.user.id),
  );

  const circleParams = createReferenceParams(["name"], [
    ["populate[images][fields][0]", "url"],
    ["populate[images][fields][1]", "formats"],
  ]);
  const tasteParams = createReferenceParams(["name"], [
    ["populate[main][fields][0]", "url"],
    ["populate[main][fields][1]", "formats"],
  ]);
  const componentParams = createReferenceParams([
    "name",
    "unit",
    "default_value",
  ]);
  const brandParams = createReferenceParams(["name"], [
    ["populate[logo][fields][0]", "url"],
    ["populate[logo][fields][1]", "formats"],
  ]);
  const currencyParams = new URLSearchParams();
  currencyParams.set("filters[isActive][$ne]", "false");
  currencyParams.set("sort[0]", "code:ASC");
  currencyParams.set("pagination[pageSize]", "2000");

  const candidateParams = new URLSearchParams();
  if (session.access === "client") {
    candidateParams.set(
      "filters[author][client][id][$eq]",
      String(session.client.id),
    );
  } else {
    candidateParams.set("filters[author][id][$eq]", String(session.user.id));
  }
  candidateParams.set("fields[0]", "name");
  candidateParams.set("fields[1]", "is_dependent");
  candidateParams.set("populate[dosage]", "*");
  candidateParams.set("populate[can_be_added_to][fields][0]", "name");
  candidateParams.set("populate[product_line][fields][0]", "name");
  candidateParams.set(
    "populate[product_line][populate][base_product_line][fields][0]",
    "name",
  );
  candidateParams.set("sort[0]", "name:ASC");
  candidateParams.set("pagination[pageSize]", "2000");

  const [
    rootProducts,
    editingProducts,
    splashes,
    circles,
    tastes,
    components,
    brands,
    currencies,
    candidateProducts,
  ] = await Promise.all([
    cachedReference(`products:root:${genericProductLineId}`, () =>
      requestStrapiRestAsService<PortalProduct[]>(
        `/api/products?${rootProductParams.toString()}`,
      ),
    ),
    requestedProductId
      ? requestStrapiRestAsService<PortalProduct[]>(
          `/api/products?${editingProductParams.toString()}`,
        )
      : Promise.resolve([]),
    loadVisibleSplashes(session, "products/new"),
    cachedReference("product-editor:circles", () =>
      requestStrapiRestAsService<PortalCircle[]>(
        `/api/circles?${circleParams.toString()}`,
      ),
    ),
    cachedReference("product-editor:tastes", () =>
      requestStrapiRestAsService<PortalTaste[]>(
        `/api/tastes?${tasteParams.toString()}`,
      ),
    ),
    cachedReference("product-editor:components", () =>
      requestStrapiRestAsService<PortalComponent[]>(
        `/api/components?${componentParams.toString()}`,
      ),
    ),
    cachedReference("product-editor:brands", () =>
      requestStrapiRestAsService<PortalBrand[]>(
        `/api/brands?${brandParams.toString()}`,
      ),
    ),
    cachedReference("product-editor:currencies", () =>
      requestStrapiRestAsService<Currency[]>(
        `/api/currencies?${currencyParams.toString()}`,
      ),
    ),
    requestStrapiRestAsService<PortalProduct[]>(
      `/api/products?${candidateParams.toString()}`,
    ),
  ]);

  const matchingRootProducts = rootProducts.filter(
    (product) =>
      product.author?.username === "root" &&
      String(product.product_line?.id) === String(genericProductLineId) &&
      Boolean(product.brand?.id),
  );
  const templateProducts = Array.from(
    new Map(
      matchingRootProducts.map((product) => [
        `${product.brand?.id}:${product.name.trim().toLocaleLowerCase()}`,
        product,
      ]),
    ).values(),
  );

  return {
    session,
    productLine,
    templateProducts,
    editingProduct: editingProducts[0] || null,
    splashes,
    circles,
    tastes,
    components,
    brands,
    currencies,
    candidateProducts,
  };
};
