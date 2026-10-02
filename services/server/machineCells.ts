import type {
  PortalCatalogProduct,
  PortalMachineCell,
} from "../../types/portal";
import { requestStrapiRestAsService } from "./strapiClient";

const PAGE_SIZE = "2000";

export const getMachineCells = async (
  machineId: string | number,
): Promise<PortalMachineCell[]> => {
  const params = new URLSearchParams();
  params.set("filters[machine][id][$eq]", String(machineId));
  params.set("populate[product][populate][taste][fields][0]", "name");
  params.set(
    "populate[product][populate][taste][populate][main][fields][0]",
    "name",
  );
  params.set(
    "populate[product][populate][taste][populate][main][fields][1]",
    "url",
  );
  params.set(
    "populate[product][populate][custom_main][fields][0]",
    "name",
  );
  params.set(
    "populate[product][populate][custom_main][fields][1]",
    "url",
  );
  params.set(
    "populate[product][populate][taste][populate][default_circle][fields][0]",
    "color",
  );
  params.set(
    "populate[product][populate][custom_circle][fields][0]",
    "color",
  );
  params.set(
    "populate[product][populate][product_line][populate][cups][populate][image][fields][0]",
    "url",
  );
  params.set(
    "populate[product][populate][cup][populate][image][fields][0]",
    "url",
  );
  params.set("populate[product][populate][dosage]", "*");
  params.set("populate[product][fields][0]", "name");
  params.set("populate[product][fields][1]", "isActive");
  params.set("populate[product][fields][2]", "product_type");
  params.set("populate[product][fields][3]", "is_dependent");
  params.set(
    "populate[product][populate][can_be_added_to][fields][0]",
    "name",
  );
  params.set("sort[0]", "position:asc");
  params.set("pagination[pageSize]", "2000");

  return requestStrapiRestAsService<PortalMachineCell[]>(
    `/api/machine-cells?${params.toString()}`,
  );
};

export const getMachineCatalogProducts = async (
  _machineId: string | number,
  clientId: string | number,
): Promise<PortalCatalogProduct[]> => {
  const params = new URLSearchParams();
  params.set("filters[author][client][id][$eq]", String(clientId));
  params.set("fields[0]", "name");
  params.set("fields[1]", "product_type");
  params.set("fields[2]", "isActive");
  params.set("fields[3]", "is_dependent");
  params.set("populate[product_line][fields][0]", "name");
  params.set(
    "populate[product_line][populate][cups][populate][image][fields][0]",
    "url",
  );
  params.set("populate[cup][populate][image][fields][0]", "url");
  params.set("populate[brand][fields][0]", "name");
  params.set("populate[brand][populate][logo][fields][0]", "name");
  params.set("populate[brand][populate][logo][fields][1]", "url");
  params.set("populate[custom_main][fields][0]", "name");
  params.set("populate[custom_main][fields][1]", "url");
  params.set("populate[taste][fields][0]", "name");
  params.set("populate[taste][populate][main][fields][0]", "name");
  params.set("populate[taste][populate][main][fields][1]", "url");
  params.set(
    "populate[taste][populate][default_circle][fields][0]",
    "color",
  );
  params.set("populate[custom_circle][fields][0]", "color");
  params.set("populate[dosage]", "*");
  params.set("populate[can_be_added_to][fields][0]", "name");
  params.set("sort[0]", "name:asc");
  params.set("pagination[pageSize]", PAGE_SIZE);

  const products = await requestStrapiRestAsService<PortalCatalogProduct[]>(
    `/api/products?${params.toString()}`,
  );

  return Array.from(
    new Map(products.map((product) => [String(product.id), product])).values(),
  );
};

export const updateMachineCell = async (
  cellId: string | number,
  position: number,
  productId: number | null,
  isActive: boolean,
  price: number | null,
  cellCategory: "powder" | "concentrate",
  amountKg: number,
) =>
  requestStrapiRestAsService(`/api/machine-cells/${cellId}`, {
    method: "PUT",
    body: JSON.stringify({
      data: {
        position,
        product: productId,
        isActive,
        price,
        cell_category: cellCategory,
        amount_kg: amountKg,
      },
    }),
  });

export const createMachineCell = async (data: {
  machineId: string | number;
  position: number;
  productId: number | null;
  isActive: boolean;
  price: number | null;
  cellCategory: "powder" | "concentrate";
  amountKg: number;
}) =>
  requestStrapiRestAsService("/api/machine-cells", {
    method: "POST",
    body: JSON.stringify({
      data: {
        machine: data.machineId,
        position: data.position,
        product: data.productId,
        isActive: data.isActive,
        price: data.price,
        cell_category: data.cellCategory,
        amount_kg: data.amountKg,
      },
    }),
  });

export const deleteMachineCell = async (cellId: string | number) =>
  requestStrapiRestAsService(`/api/machine-cells/${cellId}`, {
    method: "DELETE",
  });
