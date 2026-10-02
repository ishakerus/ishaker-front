import type { GetServerSideProps } from "next";
import {
  NewProductLinePage,
  type NewProductLinePageProps,
} from "../../../components/portal/product-lines";
import { requirePortalSession } from "../../../lib/portal/auth";
import { requestWithSplashOwnershipFallback } from "../../../lib/portal/splashOwnership";
import { requestStrapiRestAsService } from "../../../services/server/strapiClient";
import type {
  PortalProductLine,
  PortalSplash,
} from "../../../types/portal";

export default NewProductLinePage;

const asId = (value: string | string[] | undefined) => {
  const id = Array.isArray(value) ? value[0] : value;
  return id && /^\d+$/.test(id) ? id : "";
};

export const getServerSideProps: GetServerSideProps<NewProductLinePageProps> = async (
  context,
) => {
  const result = await requirePortalSession(context);
  if ("redirect" in result) return { redirect: result.redirect };

  const productLineId = asId(context.params?.id);
  if (!productLineId) return { notFound: true };

  const ownParams = new URLSearchParams();
  ownParams.set("filters[id][$eq]", productLineId);
  if (result.session.client.id) {
    ownParams.set(
      "filters[author][client][id][$eq]",
      String(result.session.client.id),
    );
  } else {
    ownParams.set("filters[author][id][$eq]", String(result.session.user.id));
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
  ownParams.set("populate[cups][populate][default_splash][populate][images]", "*");
  ownParams.set("populate[custom_splash]", "*");
  ownParams.set("pagination[pageSize]", "2000");

  const rootParams = new URLSearchParams();
  rootParams.set("filters[author][username][$eq]", "root");
  rootParams.set("fields[0]", "name");
  rootParams.set("fields[1]", "isPopular");
  rootParams.set("fields[2]", "is_template");
  rootParams.set("populate[can_be_added_to][fields][0]", "name");
  rootParams.set("populate[cups][populate][image]", "*");
  rootParams.set("populate[cups][populate][default_splash][populate][images]", "*");
  rootParams.set("populate[custom_splash]", "*");
  rootParams.set("sort[0]", "isPopular:DESC");
  rootParams.set("sort[1]", "name:ASC");
  rootParams.set("pagination[pageSize]", "2000");

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
  const loadSplashes = (params: URLSearchParams) =>
    requestStrapiRestAsService<PortalSplash[]>(
      `/api/splashes?${params.toString()}`,
    );

  const templateParams = new URLSearchParams();
  templateParams.set("filters[is_template][$eq]", "true");
  templateParams.set("fields[0]", "name");
  templateParams.set("fields[1]", "is_template");
  templateParams.set("populate[can_be_added_to][fields][0]", "name");
  templateParams.set("sort[0]", "name:ASC");
  templateParams.set("pagination[pageSize]", "2000");

  try {
    const [ownProductLines, rootProductLines, templateProductLines, splashes] =
      await Promise.all([
        requestStrapiRestAsService<PortalProductLine[]>(
          `/api/product-lines?${ownParams.toString()}`,
        ),
        requestStrapiRestAsService<PortalProductLine[]>(
          `/api/product-lines?${rootParams.toString()}`,
        ),
        result.session.access === "product"
          ? requestStrapiRestAsService<PortalProductLine[]>(
              `/api/product-lines?${templateParams.toString()}`,
            )
          : Promise.resolve([]),
        requestWithSplashOwnershipFallback(
          splashParams,
          loadSplashes,
          () =>
            console.warn(
              "[product-lines/edit] splash ownership filtering is unsupported; using the compatible query.",
            ),
        ),
      ]);

    if (!ownProductLines[0]) return { notFound: true };

    return {
      props: {
        session: result.session,
        productLine: ownProductLines[0],
        rootProductLines,
        templateProductLines,
        splashes,
      },
    };
  } catch (error) {
    console.error("[product-lines/edit] option loading failed:", error);
    return {
      props: {
        session: result.session,
        rootProductLines: [],
        splashes: [],
        loadError: "Product line options could not be loaded.",
      },
    };
  }
};
