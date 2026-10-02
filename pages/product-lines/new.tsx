import type { GetServerSideProps } from "next";
import {
  NewProductLinePage,
  type NewProductLinePageProps,
} from "../../components/portal/product-lines";
import { requirePortalSession } from "../../lib/portal/auth";
import { requestWithSplashOwnershipFallback } from "../../lib/portal/splashOwnership";
import { requestStrapiRestAsService } from "../../services/server/strapiClient";
import type {
  PortalProductLine,
  PortalSplash,
} from "../../types/portal";

export default NewProductLinePage;

export const getServerSideProps: GetServerSideProps<NewProductLinePageProps> = async (
  context,
) => {
  const result = await requirePortalSession(context);
  if ("redirect" in result) return { redirect: result.redirect };

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

  const existingParams = new URLSearchParams();
  if (result.session.access === "client") {
    existingParams.set(
      "filters[author][client][id][$eq]",
      String(result.session.client.id),
    );
  } else {
    existingParams.set(
      "filters[author][id][$eq]",
      String(result.session.user.id),
    );
  }
  existingParams.set("fields[0]", "name");
  existingParams.set("populate[base_product_line][fields][0]", "name");
  existingParams.set("pagination[pageSize]", "2000");

  try {
    const [rootProductLines, splashes, existingProductLines] =
      await Promise.all([
        requestStrapiRestAsService<PortalProductLine[]>(
          `/api/product-lines?${rootParams.toString()}`,
        ),
        requestWithSplashOwnershipFallback(splashParams, loadSplashes, () =>
          console.warn(
            "[product-lines/new] splash ownership filtering is unsupported; using the compatible query.",
          ),
        ).catch((error) => {
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
    const requestedBaseProductLineId = Array.isArray(
      context.query.baseProductLineId,
    )
      ? context.query.baseProductLineId[0]
      : context.query.baseProductLineId;
    const initialBaseProductLineId = rootProductLines.some(
      (line) => String(line.id) === requestedBaseProductLineId,
    )
      ? requestedBaseProductLineId
      : undefined;

    return {
      props: {
        session: result.session,
        rootProductLines,
        existingProductLines,
        splashes,
        ...(initialBaseProductLineId ? { initialBaseProductLineId } : {}),
      },
    };
  } catch (error) {
    console.error("[product-lines/new] option loading failed:", error);
    return {
      props: {
        session: result.session,
        rootProductLines: [],
        existingProductLines: [],
        splashes: [],
        loadError: "Product line options could not be loaded.",
      },
    };
  }
};
