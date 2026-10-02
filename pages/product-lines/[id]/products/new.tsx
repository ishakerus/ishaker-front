import type { GetServerSideProps } from "next";
import {
  NewProductPage,
  type NewProductPageProps,
} from "../../../../components/portal/product-lines";
import { requirePortalSession } from "../../../../lib/portal/auth";
import { requestWithSplashOwnershipFallback } from "../../../../lib/portal/splashOwnership";
import { requestStrapiRestAsService } from "../../../../services/server/strapiClient";
import type {
  PortalBrand,
  PortalCircle,
  PortalComponent,
  PortalProduct,
  PortalProductLine,
  PortalSplash,
  PortalTaste,
} from "../../../../types/portal";
import type { Currency } from "../../../../types/strapi";

export default NewProductPage;

export const getServerSideProps: GetServerSideProps<NewProductPageProps> = async (
  context,
) => {
  const result = await requirePortalSession(context);
  if ("redirect" in result) return { redirect: result.redirect };

  const rawId = Array.isArray(context.params?.id)
    ? context.params?.id[0]
    : context.params?.id;
  const productLineId = rawId && /^\d+$/.test(rawId) ? rawId : "";
  if (!productLineId) return { notFound: true };
  const requestedProductIdRaw = Array.isArray(context.query.productId)
    ? context.query.productId[0]
    : context.query.productId;
  const requestedProductId =
    requestedProductIdRaw && /^\d+$/.test(requestedProductIdRaw)
      ? requestedProductIdRaw
      : "";

  const params = new URLSearchParams();
  params.set("filters[id][$eq]", productLineId);
  if (result.session.access === "client") {
    params.set(
      "filters[author][client][id][$eq]",
      String(result.session.client.id),
    );
  } else {
    params.set("filters[author][id][$eq]", String(result.session.user.id));
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

  const productParams = new URLSearchParams();
  productParams.set("filters[author][username][$eq]", "root");
  productParams.set("fields[0]", "name");
  productParams.set("fields[1]", "description");
  productParams.set("fields[2]", "product_type");
  productParams.set("fields[3]", "serving_qty");
  productParams.set("fields[4]", "serving_unit");
  productParams.set("fields[5]", "product_purpose");
  productParams.set("fields[6]", "is_dependent");
  productParams.set("populate[custom_main][fields][0]", "url");
  productParams.set("populate[custom_main][fields][1]", "formats");
  productParams.set("populate[cup][populate][image][fields][0]", "url");
  productParams.set("populate[cup][populate][image][fields][1]", "formats");
  productParams.set("populate[custom_splash][fields][0]", "name");
  productParams.set("populate[custom_circle][fields][0]", "name");
  productParams.set(
    "populate[custom_circle][populate][images][fields][0]",
    "url",
  );
  productParams.set(
    "populate[custom_circle][populate][images][fields][1]",
    "formats",
  );
  productParams.set("populate[taste][populate][main][fields][0]", "url");
  productParams.set("populate[taste][populate][main][fields][1]", "formats");
  productParams.set("populate[taste][populate][default_splash][fields][0]", "name");
  productParams.set("populate[taste][populate][default_circle][fields][0]", "name");
  productParams.set("populate[components][fields][0]", "name");
  productParams.set("populate[components][fields][1]", "unit");
  productParams.set("populate[components][fields][2]", "default_value");
  productParams.set("populate[nutrition]", "*");
  productParams.set("populate[dosage]", "*");
  productParams.set("populate[author][fields][0]", "username");
  productParams.set("populate[product_line][fields][0]", "name");
  productParams.set(
    "populate[can_be_added_to][fields][0]",
    "name",
  );
  productParams.set("populate[brand][fields][0]", "name");
  productParams.set("populate[brand][populate][logo][fields][0]", "url");
  productParams.set("populate[brand][populate][logo][fields][1]", "formats");
  productParams.set("sort[0]", "name:ASC");
  productParams.set("pagination[pageSize]", "2000");

  const editingProductParams = new URLSearchParams(productParams);
  editingProductParams.delete("filters[author][username][$eq]");
  editingProductParams.set("filters[id][$eq]", requestedProductId);
  editingProductParams.set(
    "filters[author][id][$eq]",
    String(result.session.user.id),
  );

  const splashParams = new URLSearchParams();
  splashParams.set("filters[$or][0][author][username][$eq]", "root");
  splashParams.set(
    "filters[$or][1][author][id][$eq]",
    String(result.session.user.id),
  );
  splashParams.set("fields[0]", "name");
  splashParams.set("fields[1]", "color");
  splashParams.set("fields[2]", "isEmpty");
  splashParams.set("sort[0]", "name:ASC");
  splashParams.set("pagination[pageSize]", "2000");

  const circleParams = new URLSearchParams();
  circleParams.set("fields[0]", "name");
  circleParams.set("populate[images][fields][0]", "url");
  circleParams.set("populate[images][fields][1]", "formats");
  circleParams.set("sort[0]", "name:ASC");
  circleParams.set("pagination[pageSize]", "2000");

  const tasteParams = new URLSearchParams();
  tasteParams.set("fields[0]", "name");
  tasteParams.set("populate[main][fields][0]", "url");
  tasteParams.set("populate[main][fields][1]", "formats");
  tasteParams.set("sort[0]", "name:ASC");
  tasteParams.set("pagination[pageSize]", "2000");

  const componentParams = new URLSearchParams();
  componentParams.set("fields[0]", "name");
  componentParams.set("fields[1]", "unit");
  componentParams.set("fields[2]", "default_value");
  componentParams.set("sort[0]", "name:ASC");
  componentParams.set("pagination[pageSize]", "2000");

  const brandParams = new URLSearchParams();
  brandParams.set("fields[0]", "name");
  brandParams.set("populate[logo][fields][0]", "url");
  brandParams.set("populate[logo][fields][1]", "formats");
  brandParams.set("sort[0]", "name:ASC");
  brandParams.set("pagination[pageSize]", "2000");

  const currencyParams = new URLSearchParams();
  currencyParams.set("filters[isActive][$ne]", "false");
  currencyParams.set("sort[0]", "code:ASC");
  currencyParams.set("pagination[pageSize]", "2000");

  const candidateParams = new URLSearchParams();
  if (result.session.access === "client") {
    candidateParams.set(
      "filters[author][client][id][$eq]",
      String(result.session.client.id),
    );
  } else {
    candidateParams.set(
      "filters[author][id][$eq]",
      String(result.session.user.id),
    );
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

  const loadSplashes = async () => {
    const request = (query: URLSearchParams) =>
      requestStrapiRestAsService<PortalSplash[]>(
        `/api/splashes?${query.toString()}`,
      );
    return requestWithSplashOwnershipFallback(
      splashParams,
      request,
      () =>
        console.warn(
          "[products/new] splash ownership filtering is unsupported; using the compatible query.",
        ),
    );
  };

  try {
    const productLines = await requestStrapiRestAsService<PortalProductLine[]>(
      `/api/product-lines?${params.toString()}`,
    );
    const productLine = productLines[0];
    if (!productLine) return { notFound: true };
    const genericProductLineId = productLine.base_product_line?.id;
    if (!genericProductLineId) return { notFound: true };
    productParams.set(
      "filters[product_line][id][$eq]",
      String(genericProductLineId),
    );

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
      requestStrapiRestAsService<PortalProduct[]>(
        `/api/products?${productParams.toString()}`,
      ),
      requestedProductId
        ? requestStrapiRestAsService<PortalProduct[]>(
            `/api/products?${editingProductParams.toString()}`,
          )
        : Promise.resolve([]),
      loadSplashes(),
      requestStrapiRestAsService<PortalCircle[]>(
        `/api/circles?${circleParams.toString()}`,
      ),
      requestStrapiRestAsService<PortalTaste[]>(
        `/api/tastes?${tasteParams.toString()}`,
      ),
      requestStrapiRestAsService<PortalComponent[]>(
        `/api/components?${componentParams.toString()}`,
      ),
      requestStrapiRestAsService<PortalBrand[]>(
        `/api/brands?${brandParams.toString()}`,
      ),
      requestStrapiRestAsService<Currency[]>(
        `/api/currencies?${currencyParams.toString()}`,
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
    const editingProduct = editingProducts[0] || null;

    return {
      props: {
        session: result.session,
        productLine,
        templateProducts,
        editingProduct,
        splashes,
        circles,
        tastes,
        components,
        brands,
        currencies,
        candidateProducts,
      },
    };
  } catch (error) {
    console.error("[products/new] product line loading failed:", error);
    return { notFound: true };
  }
};
