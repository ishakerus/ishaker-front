import { withAdminApi } from "../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApiSession } from "../../../../lib/admin/auth";
import { getMachineContainerCount } from "../../../../lib/portal/containerSlots";
import { getProductAssignmentProblems } from "../../../../lib/portal/productAssignment";
import { requestStrapiRestAsService } from "../../../../services/server/strapiClient";
import type { PortalCatalogProduct } from "../../../../types/portal";

const asString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
const asId = (value: unknown) => {
  const id = asString(value);
  return /^\d+$/.test(id) ? Number(id) : null;
};
const asPrice = (value: unknown) => {
  if (value === "" || value === null || value === undefined) return 5.49;
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : undefined;
};

type PresetCellInput = {
  cellId: number | null;
  position: number;
  cellCategory: "powder" | "concentrate";
  productId: number;
  price: number | null;
  isActive: boolean;
};

const arePresetProductsValid = async (cells: PresetCellInput[]) => {
  if (!cells.length) return true;
  const params = new URLSearchParams();
  cells.forEach((cell, index) =>
    params.set(`filters[id][$in][${index}]`, String(cell.productId)),
  );
  params.set("fields[0]", "name");
  params.set("fields[1]", "product_type");
  params.set("fields[2]", "isActive");
  params.set("populate[product_line][fields][0]", "name");
  params.set("populate[brand][fields][0]", "name");
  params.set("populate[custom_main][fields][0]", "name");
  params.set("populate[custom_main][fields][1]", "url");
  params.set("populate[taste][populate][main][fields][0]", "name");
  params.set("populate[taste][populate][main][fields][1]", "url");
  params.set("populate[dosage]", "*");
  params.set("pagination[pageSize]", "2000");
  const products = await requestStrapiRestAsService<PortalCatalogProduct[]>(
    `/api/products?${params.toString()}`,
  );
  const productsById = new Map(
    products.map((product) => [Number(product.id), product]),
  );
  return cells.every((cell) => {
    const product = productsById.get(cell.productId);
    return (
      Boolean(product) &&
      getProductAssignmentProblems(product!).length === 0 &&
      product!.product_type === cell.cellCategory
    );
  });
};

const parseCells = (value: unknown): PresetCellInput[] | null => {
  if (!Array.isArray(value) || value.length > 200) return null;
  const cells = value.map((row: any) => ({
    cellId:
      row?.id === null || row?.id === undefined || row?.id === ""
        ? null
        : Number(row.id),
    position: Number(row?.position),
    cellCategory: row?.cellCategory,
    productId: Number(row?.productId),
    price: asPrice(row?.price),
    isActive: row?.isActive !== false,
  }));
  if (
    cells.some(
      (cell) =>
        !Number.isInteger(cell.position) ||
        cell.position <= 0 ||
        (cell.cellId !== null &&
          (!Number.isInteger(cell.cellId) || cell.cellId <= 0)) ||
        !["powder", "concentrate"].includes(cell.cellCategory) ||
        !Number.isInteger(cell.productId) ||
        cell.productId <= 0 ||
        cell.price === undefined,
    ) ||
    new Set(cells.map((cell) => cell.position)).size !== cells.length ||
    new Set(
      cells.filter((cell) => cell.cellId !== null).map((cell) => cell.cellId),
    ).size !== cells.filter((cell) => cell.cellId !== null).length
  ) {
    return null;
  }
  return cells as PresetCellInput[];
};

const getMachineTypeContainerCount = async (machineTypeId: number) => {
  const machineType = await requestStrapiRestAsService<{
    container_count?: number | null;
    name?: string;
  }>(
    `/api/machine-types/${machineTypeId}?fields[0]=container_count&fields[1]=name`,
  );
  return getMachineContainerCount(machineType);
};

const arePresetCellSlotsValid = (
  cells: PresetCellInput[],
  containerCount: number,
) => cells.every((cell) => cell.position <= containerCount);

const presetPopulateQuery =
  "populate[machine_type]=*&populate[currency]=*&populate[language]=*&" +
  "populate[product_line]=*&populate[cells][populate][product][populate][dosage]=*&" +
  "sort[0]=name:ASC&pagination[pageSize]=2000";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!requireAdminApiSession(req, res)) return;
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  if (req.method === "GET") {
    try {
      res.setHeader("Cache-Control", "no-store, max-age=0");
      const [presets, machineTypes, currencies, languages, productLines, products, machines] =
        await Promise.all([
          requestStrapiRestAsService(`/api/presets?${presetPopulateQuery}`),
          requestStrapiRestAsService(
            "/api/machine-types?sort[0]=name:ASC&pagination[pageSize]=2000",
          ),
          requestStrapiRestAsService(
            "/api/currencies?sort[0]=code:ASC&pagination[pageSize]=2000",
          ),
          requestStrapiRestAsService(
            "/api/languages?sort[0]=sort_order:ASC&sort[1]=name:ASC&pagination[pageSize]=2000",
          ),
          requestStrapiRestAsService(
            "/api/product-lines?sort[0]=name:ASC&pagination[pageSize]=2000",
          ),
          requestStrapiRestAsService(
            "/api/products?fields[0]=name&fields[1]=product_type&fields[2]=isActive&" +
              "populate[dosage]=*&populate[product_line]=*&" +
              "populate[custom_main][fields][0]=name&populate[custom_main][fields][1]=url&populate[custom_main][fields][2]=formats&" +
              "populate[taste][populate][main][fields][0]=name&populate[taste][populate][main][fields][1]=url&populate[taste][populate][main][fields][2]=formats&" +
              "populate[brand][fields][0]=name&populate[brand][populate][logo][fields][0]=url&" +
              "populate[brand][populate][logo][fields][1]=formats&" +
              "sort[0]=name:ASC&pagination[pageSize]=2000",
          ),
          requestStrapiRestAsService(
            "/api/machines?fields[0]=id&fields[1]=serial_number&sort[0]=serial_number:ASC&pagination[pageSize]=2000",
          ),
        ]);
      return res.status(200).json({
        presets,
        options: { machineTypes, currencies, languages, productLines, products, machines },
      });
    } catch (error) {
      console.error("[admin/presets] load failed:", error);
      return res.status(500).json({ error: "preset_load_failed" });
    }
  }

  const name = asString(req.body?.name);
  const slug = asString(req.body?.slug);
  const machineTypeId = asId(req.body?.machineTypeId);
  const currencyId = asId(req.body?.currencyId);
  const languageId = asId(req.body?.languageId);
  const cells = parseCells(req.body?.cells);
  if (
    !name ||
    !slug ||
    !machineTypeId ||
    !currencyId ||
    !languageId ||
    !cells
  ) {
    return res.status(400).json({
      error: "invalid_preset",
      message: "Complete all preset fields and enter valid unique planogram positions.",
    });
  }

  try {
    const containerCount = await getMachineTypeContainerCount(machineTypeId);
    if (
      containerCount === null ||
      !arePresetCellSlotsValid(cells, containerCount)
    ) {
      return res.status(400).json({
        error: "invalid_container_slot",
        message:
          containerCount === null
            ? "The selected machine model has no powder container count configured."
            : `Every preset cell must use a unique physical container slot from 1 to ${containerCount}.`,
      });
    }
    if (!(await arePresetProductsValid(cells))) {
      return res.status(400).json({
        error: "invalid_preset_products",
        message:
          "Every assigned product must be complete, active, and match its container category.",
      });
    }
    const preset: any = await requestStrapiRestAsService("/api/presets", {
      method: "POST",
      body: JSON.stringify({
        data: {
          name,
          slug,
          description: asString(req.body?.description),
          isDefault: req.body?.isDefault === true,
          isActive: req.body?.isActive !== false,
          is_template: req.body?.isTemplate === true,
          machine_type: machineTypeId,
          currency: currencyId,
          language: languageId,
        },
      }),
    });
    await Promise.all(
      cells.map((cell) =>
        requestStrapiRestAsService("/api/preset-cells", {
          method: "POST",
          body: JSON.stringify({
            data: {
              preset: preset.id,
              position: cell.position,
              cell_category: cell.cellCategory,
              product: cell.productId,
              price: cell.price,
              isActive: cell.isActive,
            },
          }),
        }),
      ),
    );
    return res.status(201).json({ preset });
  } catch (error) {
    console.error("[admin/presets] create failed:", error);
    return res.status(500).json({
      error: "preset_create_failed",
      message: "Preset could not be created.",
    });
  }
}

export {
  arePresetProductsValid,
  arePresetCellSlotsValid,
  getMachineTypeContainerCount,
  parseCells,
  presetPopulateQuery,
};

export default withAdminApi(handler);
