import { withSupportPortalApi } from "../../../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import { capitalizeName } from "../../../../../lib/formatName";
import { getPortalSessionFromApiRequest } from "../../../../../lib/portal/auth";
import { requestWithSplashOwnershipFallback } from "../../../../../lib/portal/splashOwnership";
import {
  fetchStrapiCatalogEndpoint,
  hasStrapiCatalogToken,
  requestStrapiRestAsService,
} from "../../../../../services/server/strapiClient";
import type {
  PortalCup,
  PortalProductLine,
} from "../../../../../types/portal";

type CreatedProduct = {
  id: string | number;
  name: string;
};

type RelatedEntity = {
  id: string | number;
};

type CatalogProduct = CreatedProduct & {
  custom_circle?: RelatedEntity | null;
  custom_main?: RelatedEntity | null;
  custom_splash?: RelatedEntity | null;
  taste?: {
    default_circle?: RelatedEntity | null;
    default_splash?: RelatedEntity | null;
    main?: RelatedEntity | null;
  } | null;
};

type CatalogComponent = {
  id: string | number;
  name: string;
  unit?: "mg" | "g" | "mcg" | "kJ" | "kcal";
};

type SubmittedComponent = {
  componentId: string;
  isCustom: boolean;
  name: string;
  quantity: number;
  unit: "mg" | "g" | "mcg" | "kJ" | "kcal";
};

type SubmittedDosage = {
  full_drink_volume: number;
  full_drink_price: number;
  small_drink_volume: number | null;
  small_drink_price: number | null;
  water: number;
  product: number;
  conversion_factor: number;
};

type TargetMachine = {
  id: string | number;
  serial_number?: string | null;
  title?: string | null;
};

const componentUnits = new Set(["mg", "g", "mcg", "kJ", "kcal"]);

const validateTargetMachines = async (machines: TargetMachine[] = []) =>
  !hasStrapiCatalogToken()
    ? []
    :
  Promise.all(
    machines
      .filter((machine) => Boolean(machine.serial_number))
      .map(async (machine) => {
        try {
          const response = await fetchStrapiCatalogEndpoint(
            `/api/machines/${encodeURIComponent(machine.serial_number!)}/planogram`,
          );
          const payload = await response.json().catch(() => null);
          return {
            machineId: machine.id,
            serial: machine.serial_number,
            title: machine.title || null,
            status: response.status,
            source: response.headers.get("x-planogram-source"),
            payload,
          };
        } catch {
          return {
            machineId: machine.id,
            serial: machine.serial_number,
            title: machine.title || null,
            status: 502,
            source: null,
            payload: {
              error: "planogram_unavailable",
              message: "The saved product could not be validated for this machine.",
            },
          };
        }
      }),
  );

const asString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const asId = (value: unknown) => {
  const id =
    typeof value === "number" && Number.isInteger(value)
      ? String(value)
      : asString(value);
  return /^\d+$/.test(id) ? id : "";
};

const optionalAmount = (value: unknown, allowZero = false) => {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && (allowZero ? amount >= 0 : amount > 0)
    ? amount
    : undefined;
};

const parseDosage = (value: unknown): SubmittedDosage | null => {
  if (!value || typeof value !== "object") return null;
  const dosage = value as Record<string, unknown>;
  const fullDrinkVolume = Number(dosage.fullDrinkVolume);
  const fullDrinkPrice = optionalAmount(dosage.fullDrinkPrice);
  const smallDrinkVolume = optionalAmount(dosage.smallDrinkVolume);
  const smallDrinkPrice = optionalAmount(dosage.smallDrinkPrice, true);
  const water = Number(dosage.water);
  const product = Number(dosage.product);
  const conversionFactor = Number(dosage.conversionFactor);
  if (
    ![fullDrinkVolume, water, product, conversionFactor].every(
      (amount) => Number.isFinite(amount) && amount > 0,
    ) ||
    typeof fullDrinkPrice !== "number" ||
    smallDrinkVolume === undefined ||
    smallDrinkPrice === undefined
  ) {
    return null;
  }
  return {
    full_drink_volume: fullDrinkVolume,
    full_drink_price: fullDrinkPrice,
    small_drink_volume: smallDrinkVolume,
    small_drink_price: smallDrinkPrice,
    water,
    product,
    conversion_factor: conversionFactor,
  };
};

const parseComponents = (value: unknown): SubmittedComponent[] | null => {
  if (!Array.isArray(value) || value.length > 50) return null;

  const components = value.map((item) => {
    const component = item && typeof item === "object" ? item : {};
    const componentId = asId((component as { componentId?: unknown }).componentId);
    const isCustom = (component as { isCustom?: unknown }).isCustom === true;
    const name = capitalizeName(asString((component as { name?: unknown }).name));
    const quantity = Number((component as { quantity?: unknown }).quantity);
    const unit = asString((component as { unit?: unknown }).unit);
    return { componentId, isCustom, name, quantity, unit };
  });

  if (
    components.some(
      (component) =>
        (!component.componentId && !component.isCustom) ||
        (!component.componentId && (component.name.length < 2 || component.name.length > 100)) ||
        !Number.isFinite(component.quantity) ||
        component.quantity <= 0 ||
        !componentUnits.has(component.unit),
    )
  ) {
    return null;
  }

  const keys = new Set(
    components.map((component) =>
      component.componentId
        ? `id:${component.componentId}`
        : `name:${component.name.toLocaleLowerCase()}`,
    ),
  );
  return keys.size === components.length
    ? (components as SubmittedComponent[])
    : null;
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "PUT") {
    res.setHeader("Allow", ["POST", "PUT"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const session = await getPortalSessionFromApiRequest(req);
  if (!session) return res.status(401).json({ error: "unauthorized" });

  const productLineId = asId(Array.isArray(req.query.id) ? req.query.id[0] : req.query.id);
  const brandId = asId(req.body?.brandId);
  const existingProductId = asId(req.body?.existingProductId);
  const isEditing = req.method === "PUT";
  const splashId = asId(req.body?.splashId);
  const circleId = asId(req.body?.circleId);
  const mainImageId = asId(req.body?.mainImageId);
  const cupId = asId(req.body?.cupId);
  const submittedComponents = parseComponents(req.body?.components);
  const submittedDosage = parseDosage(req.body?.dosage);
  const name = capitalizeName(asString(req.body?.name));
  const description = asString(req.body?.description);
  const productType = asString(req.body?.productType);
  const productPurpose = asString(req.body?.productPurpose);
  const servingUnit = asString(req.body?.servingUnit);
  const servingQty = Number(req.body?.servingQty);

  if (!productLineId) {
    return res.status(400).json({ error: "invalid_product_line" });
  }
  if (isEditing && !existingProductId) {
    return res.status(400).json({
      error: "invalid_product",
      message: "An existing product ID is required for an in-place edit.",
    });
  }
  if (!brandId) {
    return res.status(400).json({
      error: "invalid_brand",
      message: "Select a brand for this product.",
    });
  }
  if (
    !existingProductId &&
    (!splashId || !circleId || !mainImageId)
  ) {
    return res.status(400).json({
      error: "invalid_visuals",
      message: "Splash, circle, and taste main image are required.",
    });
  }
  if (!submittedComponents) {
    return res.status(400).json({
      error: "invalid_components",
      message: "Components must be unique and include a positive quantity (maximum 50).",
    });
  }
  if (!submittedDosage) {
    return res.status(400).json({
      error: "invalid_dosage",
      message: "Required dosage values and the full-drink price must be positive.",
    });
  }
  if (submittedDosage.full_drink_volume < 50) {
    return res.status(400).json({
      error: "drink_volume_too_low",
      message: "Full drink volume must be at least 50ml.",
    });
  }
  if (
    submittedDosage.water + submittedDosage.product >
    submittedDosage.full_drink_volume
  ) {
    return res.status(400).json({
      error: "dosage_exceeds_drink_volume",
      message: "Water + Product can't exceed the drink volume.",
    });
  }
  if (
    submittedDosage.small_drink_volume !== null &&
    submittedDosage.small_drink_volume < 100
  ) {
    return res.status(400).json({
      error: "small_drink_volume_too_low",
      message: "Small drink volume must be at least 100ml.",
    });
  }
  if (submittedDosage.water < 50 || submittedDosage.water > 500) {
    return res.status(400).json({
      error: "water_out_of_range",
      message: "Water must be between 50ml and 500ml.",
    });
  }
  if (
    submittedDosage.small_drink_volume !== null &&
    submittedDosage.small_drink_volume >= submittedDosage.full_drink_volume
  ) {
    return res.status(400).json({
      error: "small_drink_volume_too_large",
      message: "Small drink volume must be less than full drink volume.",
    });
  }
  if (submittedDosage.small_drink_volume !== null) {
    const scale =
      submittedDosage.small_drink_volume /
      submittedDosage.full_drink_volume;
    const scaledContents =
      submittedDosage.water * scale + submittedDosage.product * scale;
    if (scaledContents > submittedDosage.small_drink_volume + 1e-9) {
      return res.status(400).json({
        error: "dosage_exceeds_small_drink_volume",
        message: "Water + Product can't exceed the drink volume.",
      });
    }
  }
  if (name.length < 2 || name.length > 100) {
    return res.status(400).json({
      error: "invalid_name",
      message: "Name must contain between 2 and 100 characters.",
    });
  }
  if (description.length > 2000) {
    return res.status(400).json({
      error: "invalid_description",
      message: "Description must not exceed 2000 characters.",
    });
  }
  if (!["powder", "concentrate"].includes(productType)) {
    return res.status(400).json({
      error: "invalid_product_type",
      message: "Select a valid product type.",
    });
  }
  if (!["milkshake", "sport nutrition"].includes(productPurpose)) {
    return res.status(400).json({
      error: "invalid_product_purpose",
      message: "Select a valid product purpose.",
    });
  }
  if (
    !["g", "ml"].includes(servingUnit) ||
    !Number.isFinite(servingQty) ||
    servingQty <= 0
  ) {
    return res.status(400).json({
      error: "invalid_serving",
      message: "Serving quantity and unit are invalid.",
    });
  }

  const ownershipParams = new URLSearchParams();
  ownershipParams.set("filters[id][$eq]", productLineId);
  if (session.access === "client") {
    ownershipParams.set(
      "filters[author][client][id][$eq]",
      String(session.client.id),
    );
  } else {
    ownershipParams.set("filters[author][id][$eq]", String(session.user.id));
  }
  ownershipParams.set("populate[products][fields][0]", "name");
  ownershipParams.set(
    "populate[products][filters][author][id][$eq]",
    String(session.user.id),
  );
  ownershipParams.set("populate[base_product_line][fields][0]", "name");
  ownershipParams.set(
    "populate[base_product_line][populate][cups][fields][0]",
    "id",
  );
  ownershipParams.set("populate[machines][fields][0]", "serial_number");
  ownershipParams.set("populate[machines][fields][1]", "title");
  ownershipParams.set("pagination[pageSize]", "2000");

  const componentParams = new URLSearchParams();
  componentParams.set("fields[0]", "name");
  componentParams.set("fields[1]", "unit");
  submittedComponents
    .filter((component) => Boolean(component.componentId))
    .forEach((component, index) => {
    componentParams.set(`filters[id][$in][${index}]`, component.componentId);
  });
  componentParams.set("pagination[pageSize]", "2000");

  try {
    const productLines = await requestStrapiRestAsService<PortalProductLine[]>(
      `/api/product-lines?${ownershipParams.toString()}`,
    );
    const productLine = productLines[0];

    if (!productLine?.id) {
      return res.status(404).json({
        error: "product_line_not_found",
        message: "Product line was not found or does not belong to you.",
      });
    }
    if (
      isEditing &&
      !productLine.products?.some(
        (product) => String(product.id) === existingProductId,
      )
    ) {
      return res.status(404).json({
        error: "product_not_found",
        message: "Product was not found in this product line.",
      });
    }

    const genericProductLineId = productLine.base_product_line?.id;
    if (!genericProductLineId) {
      return res.status(400).json({
        error: "invalid_generic_product_line",
        message: "This product line is not linked to a root generic line.",
      });
    }
    if (
      cupId &&
      !productLine.base_product_line?.cups?.some(
        (cup) => String(cup.id) === cupId,
      )
    ) {
      return res.status(400).json({
        error: "product_line_cup_mismatch",
        message: "The custom cup must belong to this product line.",
      });
    }
    const duplicateNameParams = new URLSearchParams();
    duplicateNameParams.set("filters[name][$eqi]", name);
    duplicateNameParams.set(
      "filters[product_line][id][$eq]",
      productLineId,
    );
    if (isEditing && existingProductId) {
      duplicateNameParams.set("filters[id][$ne]", existingProductId);
    }
    duplicateNameParams.set("fields[0]", "name");
    duplicateNameParams.set("pagination[pageSize]", "1");

    const baseProductParams = new URLSearchParams();
    if (existingProductId && !isEditing) {
      baseProductParams.set("filters[id][$eq]", existingProductId);
      baseProductParams.set("filters[author][username][$eq]", "root");
      baseProductParams.set("filters[brand][id][$eq]", brandId);
      baseProductParams.set(
        "filters[product_line][id][$eq]",
        String(genericProductLineId),
      );
      baseProductParams.set("fields[0]", "name");
      baseProductParams.set("populate[custom_splash][fields][0]", "name");
      baseProductParams.set("populate[custom_circle][fields][0]", "name");
      baseProductParams.set("populate[custom_main][fields][0]", "url");
      baseProductParams.set(
        "populate[taste][populate][default_splash][fields][0]",
        "name",
      );
      baseProductParams.set(
        "populate[taste][populate][default_circle][fields][0]",
        "name",
      );
      baseProductParams.set(
        "populate[taste][populate][main][fields][0]",
        "url",
      );
      baseProductParams.set("pagination[pageSize]", "1");
    }

    const baseProducts =
      existingProductId && !isEditing
        ? await requestStrapiRestAsService<CatalogProduct[]>(
            `/api/products?${baseProductParams.toString()}`,
          )
        : [];
    const baseProduct = baseProducts[0];

    if (existingProductId && !isEditing && !baseProduct?.id) {
      return res.status(400).json({
        error: "invalid_base_product",
        message: "Select a root product from this generic line and brand.",
      });
    }

    const resolvedSplashId =
      splashId ||
      asId(baseProduct?.custom_splash?.id) ||
      asId(baseProduct?.taste?.default_splash?.id);
    const resolvedCircleId =
      circleId ||
      asId(baseProduct?.custom_circle?.id) ||
      asId(baseProduct?.taste?.default_circle?.id);
    const resolvedMainImageId =
      mainImageId ||
      asId(baseProduct?.custom_main?.id) ||
      asId(baseProduct?.taste?.main?.id);

    if (!resolvedSplashId || !resolvedCircleId || !resolvedMainImageId) {
      return res.status(400).json({
        error: "invalid_visuals",
        message:
          "This product is missing a splash, circle, or taste main image. Select the missing visual and try again.",
      });
    }

    const visibleSplashParams = new URLSearchParams();
    visibleSplashParams.set("filters[id][$eq]", resolvedSplashId);
    visibleSplashParams.set(
      "filters[$or][0][author][username][$eq]",
      "root",
    );
    visibleSplashParams.set(
      "filters[$or][1][author][id][$eq]",
      String(session.user.id),
    );
    visibleSplashParams.set("pagination[pageSize]", "1");
    const loadVisibleSplash = (query: URLSearchParams) =>
      requestStrapiRestAsService<RelatedEntity[]>(
        `/api/splashes?${query.toString()}`,
      );

    const [
      splash,
      circle,
      mainImage,
      catalogComponents,
      duplicateProducts,
      brand,
      customCup,
    ] = await Promise.all([
      requestWithSplashOwnershipFallback(
        visibleSplashParams,
        loadVisibleSplash,
      ).then((items) => items[0]),
      requestStrapiRestAsService<RelatedEntity>(
        `/api/circles/${resolvedCircleId}`,
      ),
      requestStrapiRestAsService<RelatedEntity>(
        `/api/upload/files/${resolvedMainImageId}`,
      ),
      submittedComponents.some((component) => component.componentId)
        ? requestStrapiRestAsService<CatalogComponent[]>(
            `/api/components?${componentParams.toString()}`,
          )
        : Promise.resolve([]),
      requestStrapiRestAsService<CreatedProduct[]>(
        `/api/products?${duplicateNameParams.toString()}`,
      ),
      requestStrapiRestAsService<RelatedEntity>(`/api/brands/${brandId}`),
      cupId
        ? requestStrapiRestAsService<PortalCup>(`/api/cups/${cupId}`)
        : Promise.resolve(null),
    ]);

    if (!brand?.id) {
      return res.status(400).json({
        error: "invalid_brand",
        message: "The selected brand no longer exists.",
      });
    }
    if (cupId && !customCup?.id) {
      return res.status(400).json({
        error: "invalid_cup",
        message: "The selected custom cup no longer exists.",
      });
    }

    if (duplicateProducts.length) {
      return res.status(409).json({
        error: "duplicate_name",
        message: "A product with this name already exists in this product line.",
      });
    }

    if (
      existingProductId &&
      !isEditing &&
      productLine.products?.some(
        (product) => String(product.id) === existingProductId,
      )
    ) {
      return res.status(409).json({
        error: "duplicate_product",
        message: "This product has already been added to the product line.",
      });
    }

    if (!splash?.id || !circle?.id || !mainImage?.id) {
      return res.status(400).json({
        error: "invalid_visuals",
        message: "The selected splash, circle, or taste main image no longer exists.",
      });
    }

    const selectedExistingComponents = submittedComponents.filter((component) =>
      Boolean(component.componentId),
    );
    if (catalogComponents.length !== selectedExistingComponents.length) {
      return res.status(400).json({
        error: "invalid_components",
        message: "One or more selected components no longer exist.",
      });
    }

    const componentsById = new Map(
      catalogComponents.map((component) => [String(component.id), component]),
    );
    const customComponents = submittedComponents.filter(
      (component) => !component.componentId,
    );
    const createdCustomComponents = await Promise.all(
      customComponents.map((component) =>
        requestStrapiRestAsService<CatalogComponent>("/api/components", {
          method: "POST",
          body: JSON.stringify({
            data: {
              name: component.name,
              unit: component.unit,
              default_value: component.quantity,
            },
          }),
        }),
      ),
    );
    const customComponentsByName = new Map(
      createdCustomComponents.map((component) => [
        component.name.toLocaleLowerCase(),
        component,
      ]),
    );
    const productComponents = submittedComponents.map((submitted) => {
      const component = submitted.componentId
        ? componentsById.get(submitted.componentId)!
        : customComponentsByName.get(submitted.name.toLocaleLowerCase())!;
      return { component, quantity: submitted.quantity, unit: submitted.unit };
    });
    const componentIds = productComponents.map(({ component }) => component.id);
    const nutrition = productComponents.map(({ component, quantity, unit }) => ({
      name: component.name,
      qty: quantity,
      unit,
    }));

    if (existingProductId && isEditing) {
      // Editing one of the user's own products in this line: update in place.
      const existingProduct = await requestStrapiRestAsService<CreatedProduct>(
        `/api/products/${existingProductId}`,
      );

      if (!existingProduct?.id) {
        return res.status(400).json({
          error: "invalid_product",
          message: "The selected product no longer exists.",
        });
      }

      await requestStrapiRestAsService(`/api/products/${existingProduct.id}`, {
        method: "PUT",
        body: JSON.stringify({
          data: {
            name,
            brand: brand.id,
            ...(description ? { description } : { description: null }),
            product_type: productType,
            product_purpose: productPurpose,
            serving_qty: servingQty,
            serving_unit: servingUnit,
            custom_splash: splash.id,
            custom_circle: circle.id,
            custom_main: mainImage.id,
            cup: customCup?.id || null,
            components: { set: componentIds },
            nutrition,
            dosage: submittedDosage,
          },
        }),
      });

      const planogramChecks = await validateTargetMachines(
        productLine.machines as TargetMachine[] | undefined,
      );
      return res.status(200).json({
        product: { ...existingProduct, id: existingProduct.id },
        updatedInPlace: true,
        planogramChecks,
      });
    }

    // Reusing a reference product must NOT connect it (Product.product_line is
    // many-to-one — connecting would MOVE it out of its owner's line). Instead we
    // CLONE it: a new product owned by this user, with base_product provenance.
    const product = await requestStrapiRestAsService<CreatedProduct>("/api/products", {
      method: "POST",
      body: JSON.stringify({
        data: {
          name,
          brand: brand.id,
          ...(description ? { description } : {}),
          product_type: productType,
          product_purpose: productPurpose,
          serving_qty: servingQty,
          serving_unit: servingUnit,
          author: session.user.id,
          product_line: productLine.id,
          ...(existingProductId ? { base_product: Number(existingProductId) } : {}),
          custom_splash: splash.id,
          custom_circle: circle.id,
          custom_main: mainImage.id,
          ...(customCup?.id ? { cup: customCup.id } : {}),
          ...(componentIds.length ? { components: { connect: componentIds } } : {}),
          nutrition,
          dosage: submittedDosage,
        },
      }),
    });

    const planogramChecks = await validateTargetMachines(
      productLine.machines as TargetMachine[] | undefined,
    );
    return res.status(201).json({ product, planogramChecks });
  } catch (error) {
    console.error("[portal/product-lines/:id/products] creation failed:", error);
    const apiError = error as {
      status?: number;
      response?: { error?: { message?: string } };
    };
    const status = apiError.status && apiError.status < 500 ? apiError.status : 500;
    return res.status(status).json({
      error: "product_creation_failed",
      message:
        apiError.response?.error?.message || "Product could not be created.",
    });
  }
}

export default withSupportPortalApi(handler);
