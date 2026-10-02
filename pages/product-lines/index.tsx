import type { GetServerSideProps } from "next";
import {
  ProductLinesPage,
  type MachineContainerAssignment,
  type ProductLinesPageProps,
} from "../../components/portal/product-lines";
import { requirePortalSession } from "../../lib/portal/auth";
import {
  getMachineCatalogProducts,
  getMachineCells,
} from "../../services/server/machineCells";
import { requestStrapiRestAsService } from "../../services/server/strapiClient";
import type {
  PortalCatalogProduct,
  PortalProduct,
  PortalProductLine,
  PortalSession,
} from "../../types/portal";

export default ProductLinesPage;

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
  params.set(
    "populate[custom_splash][populate][images][fields][0]",
    "url",
  );
  params.set(
    "populate[custom_splash][populate][images][fields][1]",
    "formats",
  );
  params.set(
    "populate[custom_splash][populate][images][fields][2]",
    "name",
  );
  params.set("sort[0]", "name:ASC");
  params.set("pagination[pageSize]", "2000");
  return params;
};

const createRootProductLineParams = () => {
  const params = new URLSearchParams();
  params.set("filters[author][username][$eq]", "root");
  params.set("fields[0]", "name");
  params.set("fields[1]", "isPopular");
  params.set("sort[0]", "isPopular:DESC");
  params.set("sort[1]", "name:ASC");
  params.set("pagination[pageSize]", "2000");
  return params;
};

export const getServerSideProps: GetServerSideProps<ProductLinesPageProps> = async (
  context,
) => {
  const result = await requirePortalSession(context);
  if ("redirect" in result) return { redirect: result.redirect };
  const requestedMachineId = Array.isArray(context.query.machineId)
    ? context.query.machineId[0]
    : context.query.machineId;
  const initialMachineId = result.session.machines.some(
    (machine) => String(machine.id) === requestedMachineId,
  )
    ? requestedMachineId
    : undefined;
  const initialNewProduct = context.query.action === "new-product";

  let catalogProducts: PortalCatalogProduct[] = [];
  let machineAssignments: MachineContainerAssignment[] = [];
  try {
    const [catalog, ...cellResults] = await Promise.all([
      result.session.machines[0]
        ? getMachineCatalogProducts(
            result.session.machines[0].id,
            result.session.client.id,
          )
        : Promise.resolve([]),
      ...result.session.machines.map((machine) =>
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
    ]);
    catalogProducts = catalog;
    machineAssignments = cellResults;
  } catch (error) {
    console.error("[product-lines] container catalog loading failed:", error);
    machineAssignments = result.session.machines.map((machine) => ({
      machine,
      cells: [],
      loadError: "Product library could not be loaded for assignment.",
    }));
  }

  try {
    const [ownProductLines, ownProducts, rootProductLines] = await Promise.all([
      requestStrapiRestAsService<PortalProductLine[]>(
        `/api/product-lines?${createProductLineParams(result.session).toString()}`,
      ),
      requestStrapiRestAsService<ProductWithLine[]>(
        `/api/products?${createProductParams(result.session).toString()}`,
      ),
      requestStrapiRestAsService<PortalProductLine[]>(
        `/api/product-lines?${createRootProductLineParams().toString()}`,
      ),
    ]);
    const productLines = ownProductLines.map((productLine) => ({
      ...productLine,
      products: ownProducts.filter(
        (product) =>
          String(product.product_line?.id) === String(productLine.id),
      ),
    }));

    return {
      props: {
        session: result.session,
        productLines,
        rootProductLines,
        orphanProducts: ownProducts.filter((product) => !product.product_line),
        catalogProducts,
        machineAssignments,
        ...(initialMachineId ? { initialMachineId } : {}),
        ...(initialNewProduct ? { initialNewProduct: true } : {}),
      },
    };
  } catch (error) {
    console.error("[product-lines] loading failed:", error);
    return {
      props: {
        session: result.session,
        productLines: [],
        rootProductLines: [],
        orphanProducts: [],
        catalogProducts,
        machineAssignments,
        ...(initialMachineId ? { initialMachineId } : {}),
        ...(initialNewProduct ? { initialNewProduct: true } : {}),
        loadError: "Product lines could not be loaded.",
      },
    };
  }
};
