import {
  Button,
  HStack,
  Link,
  SimpleGrid,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { capitalizeName } from "../../../../lib/formatName";
import { getMediaUrl, getSmallestMediaUrl } from "../../../../lib/portal/media";
import { getStrapiBaseUrl } from "../../../../services/fetchers";
import type {
  PortalBrand,
  PortalCircle,
  PortalComponent,
  PortalProduct,
  PortalProductLine,
  PortalProductPurpose,
  PortalProductType,
  PortalSession,
  PortalSplash,
  PortalTaste,
} from "../../../../types/portal";
import type { Currency } from "../../../../types/strapi";
import { PortalShell } from "../../PortalShell";
import {
  type ProductComponentRow,
  type ProductDosageValue,
} from "./ProductComponentsTable";
import { type ProductNameOption } from "./ProductNameSelect";
import { type SearchableImageOption } from "../SearchableImageSelect";
import { NewProductForm } from "./NewProductForm";
import { NewProductSelectionDialogs } from "./NewProductSelectionDialogs";
import { NewProductVisualPreview } from "./NewProductVisualPreview";

const fetcher = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || "Request failed.");
  return payload as T;
};

const toAbsoluteUrl = (url?: string) => {
  if (!url) return "";
  return url.startsWith("http") ? url : `${getStrapiBaseUrl()}${url}`;
};

const sortFramesByName = <T extends { name?: string; url?: string }>(
  frames: T[] = [],
) =>
  [...frames].sort((left, right) =>
    (left.name || left.url || "").localeCompare(
      right.name || right.url || "",
      undefined,
      { numeric: true, sensitivity: "base" },
    ),
  );

const DEFAULT_DOSAGE: ProductDosageValue = {
  drinkVolume: "300",
  fullDrinkPrice: "5.49",
  smallDrinkVolume: "",
  smallDrinkPrice: "",
  water: "270",
  product: "30",
  conversionFactor: "4",
};

const componentUnits = new Set(["mg", "g", "mcg", "kJ", "kcal"]);
const NEW_PRODUCT_FORM_ID = "new-product-form";

type PlanogramCheck = {
  serial?: string | null;
  title?: string | null;
  status?: number;
  payload?: any;
};

const planogramWarnings = (checks: PlanogramCheck[] = []) =>
  checks.flatMap((check) => {
    const payload = check.payload?.data || check.payload || {};
    const machine = check.title || check.serial || "Target machine";
    const mediaKeys =
      payload.media_keys ||
      payload.fleet_status?.media_keys ||
      payload.body?.media_keys;
    const missing = Array.isArray(mediaKeys?.missing) ? mediaKeys.missing : [];
    const problems = Array.isArray(payload.problems) ? payload.problems : [];
    const warnings = Array.isArray(payload.warnings) ? payload.warnings : [];

    return [
      ...missing.map((key: unknown) => `${machine}: missing artwork ${String(key)}`),
      ...problems.map(
        (problem: any) =>
          `${machine}: ${problem?.detail || problem?.code || "planogram problem"}`,
      ),
      ...warnings.map((warning: any) =>
        `${machine}: ${warning?.detail || warning?.message || String(warning)}`,
      ),
      ...(Number(check.status) >= 400 && !problems.length
        ? [
            `${machine}: ${
              payload.message || payload.error?.message || payload.error || "planogram validation failed"
            }`,
          ]
        : []),
    ];
  });

const toDosageValue = (product?: PortalProduct): ProductDosageValue => ({
  drinkVolume:
    product?.dosage?.full_drink_volume !== undefined &&
    product.dosage.full_drink_volume !== null
      ? String(product.dosage.full_drink_volume)
      : DEFAULT_DOSAGE.drinkVolume,
  fullDrinkPrice:
    product?.dosage?.full_drink_price !== undefined &&
    product.dosage.full_drink_price !== null
      ? String(product.dosage.full_drink_price)
      : DEFAULT_DOSAGE.fullDrinkPrice,
  smallDrinkVolume:
    product?.dosage?.small_drink_volume !== undefined &&
    product.dosage.small_drink_volume !== null
      ? String(product.dosage.small_drink_volume)
      : DEFAULT_DOSAGE.smallDrinkVolume,
  smallDrinkPrice:
    product?.dosage?.small_drink_price !== undefined &&
    product.dosage.small_drink_price !== null
      ? String(product.dosage.small_drink_price)
      : DEFAULT_DOSAGE.smallDrinkPrice,
  water:
    product?.dosage?.water !== undefined && product.dosage.water !== null
      ? String(product.dosage.water)
      : DEFAULT_DOSAGE.water,
  product:
    product?.dosage?.product !== undefined && product.dosage.product !== null
      ? String(product.dosage.product)
      : DEFAULT_DOSAGE.product,
  conversionFactor:
    product?.dosage?.conversion_factor !== undefined &&
    product.dosage.conversion_factor !== null
      ? String(product.dosage.conversion_factor)
      : DEFAULT_DOSAGE.conversionFactor,
});

const toComponentRows = (product?: PortalProduct): ProductComponentRow[] => {
  if (!product) return [];
  const productComponents = product.components || [];
  const componentsByName = new Map(
    productComponents.map((component) => [
      component.name.trim().toLocaleLowerCase(),
      component,
    ]),
  );

  if (product.nutrition?.length) {
    return product.nutrition.map((fact, index) => {
      const component = componentsByName.get(
        fact.name.trim().toLocaleLowerCase(),
      );
      const unit = componentUnits.has(fact.unit || "")
        ? fact.unit!
        : component?.unit || "g";
      return {
        id: `selected-component-${product.id}-${index}`,
        componentId: component ? String(component.id) : "",
        isCustom: !component,
        name: fact.name,
        quantity: String(fact.qty),
        unit,
      };
    });
  }

  return productComponents.map((component, index) => ({
    id: `selected-component-${product.id}-${index}`,
    componentId: String(component.id),
    isCustom: false,
    name: component.name,
    quantity:
      component.default_value !== undefined && component.default_value !== null
        ? String(component.default_value)
        : "",
    unit: component.unit || "g",
  }));
};

export type NewProductPageProps = {
  brands: PortalBrand[];
  currencies: Currency[];
  circles: PortalCircle[];
  components: PortalComponent[];
  editingProduct?: PortalProduct | null;
  productLine: PortalProductLine;
  templateProducts: PortalProduct[];
  candidateProducts: PortalProduct[];
  session: PortalSession;
  splashes: PortalSplash[];
  tastes: PortalTaste[];
};

export function NewProductPage({
  brands,
  currencies,
  circles,
  components,
  editingProduct = null,
  productLine,
  templateProducts,
  candidateProducts,
  session,
  splashes,
  tastes,
}: NewProductPageProps) {
  const router = useRouter();
  const toast = useToast();
  const splashDialog = useDisclosure();
  const tasteMainDialog = useDisclosure();
  const availableCups = productLine.base_product_line?.cups?.length
    ? productLine.base_product_line.cups
    : productLine.cups || [];
  const assignedDefaultCupId = productLine.cups?.[0]?.id
    ? String(productLine.cups[0].id)
    : "";
  const defaultCup =
    availableCups.find((cup) => String(cup.id) === assignedDefaultCupId) ||
    availableCups[0];
  const defaultCupId = defaultCup ? String(defaultCup.id) : "";
  const validCupId = (candidate?: string) =>
    candidate && availableCups.some((cup) => String(cup.id) === candidate)
      ? candidate
      : defaultCupId;
  const {
    data: allSplashOptions,
    error: allSplashOptionsError,
    isLoading: areAllSplashOptionsLoading,
  } = useSWR<{ splashes: PortalSplash[] }>(
    splashDialog.isOpen
      ? "/api/portal/visual-options?type=splashes"
      : null,
    fetcher,
  );
  const {
    data: allTasteOptions,
    error: allTasteOptionsError,
    isLoading: areAllTasteOptionsLoading,
  } = useSWR<{ tastes: PortalTaste[] }>(
    tasteMainDialog.isOpen
      ? "/api/portal/visual-options?type=tastes"
      : null,
    fetcher,
  );
  const initialProduct = editingProduct || undefined;
  const isEditing = Boolean(initialProduct);
  const editingProductId = initialProduct ? String(initialProduct.id) : "";
  const [brandId, setBrandId] = useState(
    initialProduct?.brand?.id ? String(initialProduct.brand.id) : "",
  );
  const [name, setName] = useState(
    initialProduct ? capitalizeName(initialProduct.name) : "",
  );
  const [existingProductId, setExistingProductId] = useState(
    editingProductId,
  );
  const [splashId, setSplashId] = useState(
    initialProduct?.custom_splash?.id
      ? String(initialProduct.custom_splash.id)
      : initialProduct?.taste?.default_splash?.id
        ? String(initialProduct.taste.default_splash.id)
        : "",
  );
  const [circleId, setCircleId] = useState(
    initialProduct?.custom_circle?.id
      ? String(initialProduct.custom_circle.id)
      : initialProduct?.taste?.default_circle?.id
        ? String(initialProduct.taste.default_circle.id)
        : "",
  );
  const [mainImageId, setMainImageId] = useState(
    initialProduct?.custom_main?.id
      ? String(initialProduct.custom_main.id)
      : initialProduct?.taste?.main?.id
        ? String(initialProduct.taste.main.id)
        : "",
  );
  const [cupId, setCupId] = useState(
    validCupId(
      initialProduct?.cup?.id ? String(initialProduct.cup.id) : undefined,
    ),
  );
  const [componentRows, setComponentRows] = useState<ProductComponentRow[]>(
    toComponentRows(initialProduct),
  );
  const [dosage, setDosage] = useState<ProductDosageValue>(
    toDosageValue(initialProduct),
  );
  const [description, setDescription] = useState(
    initialProduct?.description || "",
  );
  const [productType, setProductType] = useState<PortalProductType>(
    initialProduct?.product_type === "concentrate" ? "concentrate" : "powder",
  );
  const [productPurpose, setProductPurpose] = useState<PortalProductPurpose>(
    initialProduct?.product_purpose === "milkshake"
      ? "milkshake"
      : "sport nutrition",
  );
  const [servingQuantity, setServingQuantity] = useState(
    initialProduct?.serving_qty !== undefined &&
      initialProduct.serving_qty !== null
      ? String(initialProduct.serving_qty)
      : "100",
  );
  const [servingUnit, setServingUnit] = useState<"g" | "ml">(
    initialProduct?.serving_unit === "ml" ? "ml" : "g",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDependent, setIsDependent] = useState(
    initialProduct?.is_dependent === true,
  );
  const [canBeAddedToIds, setCanBeAddedToIds] = useState(
    (initialProduct?.can_be_added_to || []).map((product) => String(product.id)),
  );
  const [error, setError] = useState("");
  const hydratedProductDetailsId = useRef(
    initialProduct?.components !== undefined &&
      initialProduct.dosage !== undefined
      ? String(initialProduct.id)
      : "",
  );
  const productLineName = capitalizeName(productLine.name);
  const priceCurrencyId = session.client.currency?.id
    ? String(session.client.currency.id)
    : "";
  const selectedProduct = templateProducts.find(
    (product) => String(product.id) === existingProductId,
  ) ||
    (editingProduct && String(editingProduct.id) === existingProductId
      ? editingProduct
      : undefined);
  const {
    data: selectedProductResponse,
    error: selectedProductError,
    isLoading: isSelectedProductLoading,
  } = useSWR<{ product: PortalProduct }>(
    existingProductId ? `/api/portal/products/${existingProductId}` : null,
    fetcher,
  );
  const {
    data: selectedSplashResponse,
    error: selectedSplashError,
    isLoading: isSelectedSplashLoading,
  } = useSWR<{ splash: PortalSplash }>(
    splashId ? `/api/portal/splashes/${splashId}` : null,
    fetcher,
  );
  const previewProduct = selectedProductResponse?.product || selectedProduct;

  useEffect(() => {
    const product = selectedProductResponse?.product;
    const taste = product?.taste;
    if (!existingProductId || !product) return;

    if (hydratedProductDetailsId.current !== existingProductId) {
      setComponentRows(toComponentRows(product));
      setDosage(toDosageValue(product));
      hydratedProductDetailsId.current = existingProductId;
    }

    setSplashId(
      (current) =>
        current ||
        (product.custom_splash?.id
          ? String(product.custom_splash.id)
          : taste?.default_splash?.id
            ? String(taste.default_splash.id)
            : ""),
    );
    setCircleId(
      (current) =>
        current ||
        (product.custom_circle?.id
          ? String(product.custom_circle.id)
          : taste?.default_circle?.id
            ? String(taste.default_circle.id)
            : ""),
    );
    setMainImageId(
      (current) =>
        current ||
        (product.custom_main?.id
          ? String(product.custom_main.id)
          : taste?.main?.id
            ? String(taste.main.id)
            : ""),
    );
  }, [existingProductId, selectedProductResponse]);

  const productOptions: ProductNameOption[] = templateProducts
    .filter((product) => String(product.brand?.id) === brandId)
    .map((product) => ({
      id: String(product.id),
      name: capitalizeName(product.name),
      imageUrl: product.taste?.main?.url
        ? toAbsoluteUrl(product.taste.main.url)
        : "",
    }));
  const brandOptions: SearchableImageOption[] = brands.map((brand) => ({
    id: String(brand.id),
    name: capitalizeName(brand.name),
    imageUrl: getSmallestMediaUrl(brand.logo),
  }));
  const splashOptions: SearchableImageOption[] = splashes.map((splash) => ({
    id: String(splash.id),
    name: capitalizeName(splash.name),
    color: splash.color || "transparent",
    ...(splash.isEmpty ? { badge: "Empty", badgeColorScheme: "gray" } : {}),
  }));
  const circleOptions: SearchableImageOption[] = circles.map((circle) => ({
    id: String(circle.id),
    name: capitalizeName(circle.name || `Circle ${circle.id}`),
    imageUrl: getSmallestMediaUrl(circle.images?.[0]),
  }));
  const mainImageOptions: SearchableImageOption[] = tastes
    .filter((taste) => Boolean(taste.main?.id))
    .map((taste) => ({
      id: String(taste.main!.id),
      name: capitalizeName(taste.name),
      imageUrl: getSmallestMediaUrl(taste.main),
    }));
  const cupOptions: SearchableImageOption[] = availableCups.map((cup) => ({
    id: String(cup.id),
    name: capitalizeName(cup.name),
    imageUrl: getSmallestMediaUrl(cup.image),
  }));
  const selectedCup =
    availableCups.find((cup) => String(cup.id) === cupId) || defaultCup;
  const splashFrames = useMemo(() => {
    const selectedFrames = sortFramesByName(
      selectedSplashResponse?.splash.images,
    )
      .map((image) => getMediaUrl(image))
      .filter(Boolean);
    if (selectedFrames.length) return selectedFrames;

    return sortFramesByName(previewProduct?.taste?.default_splash?.images)
      .map((image) => toAbsoluteUrl(image.url))
      .filter(Boolean);
  }, [previewProduct, selectedSplashResponse]);
  const selectedSplash = splashes.find(
    (splash) => String(splash.id) === splashId,
  );
  const selectedCircle = circles.find(
    (circle) => String(circle.id) === circleId,
  );
  const selectedMain = tastes.find(
    (taste) => String(taste.main?.id) === mainImageId,
  )?.main;
  const selectedBrand = brands.find((brand) => String(brand.id) === brandId);
  const allowedLineIds = useMemo(
    () =>
      new Set(
        (productLine.base_product_line?.can_be_added_to || []).map((line) =>
          String(line.id),
        ),
      ),
    [productLine.base_product_line?.can_be_added_to],
  );
  const eligibleCandidateProducts = useMemo(
    () =>
      candidateProducts.filter((candidate) => {
        const candidateRootLineId =
          candidate.product_line?.base_product_line?.id ||
          candidate.product_line?.id;
        return (
          String(candidate.id) !== editingProductId &&
          candidate.is_dependent !== true &&
          Boolean(candidateRootLineId) &&
          allowedLineIds.has(String(candidateRootLineId))
        );
      }),
    [allowedLineIds, candidateProducts, editingProductId],
  );
  const canBeAddedToOptions = eligibleCandidateProducts.map((candidate) => {
    const hasReversePair = (candidate.can_be_added_to || []).some(
      (target) => String(target.id) === editingProductId,
    );
    return {
      id: String(candidate.id),
      label: capitalizeName(candidate.name),
      ...(candidate.product_line?.name
        ? { note: hasReversePair ? "already added to this one" : capitalizeName(candidate.product_line.name) }
        : hasReversePair
          ? { note: "already added to this one" }
          : {}),
      isDisabled: hasReversePair,
    };
  });
  const mixPreview = canBeAddedToIds.flatMap((targetId) => {
    const target = eligibleCandidateProducts.find(
      (candidate) => String(candidate.id) === targetId,
    );
    if (!target) return [];
    const baseGrams = Number(target.dosage?.product);
    const addonGrams = Number(dosage.product);
    if (!(baseGrams > 0)) return [];
    if (isDependent) {
      return [
        `${capitalizeName(target.name)} ${baseGrams} g + ${capitalizeName(name || "Add-on")} ${
          addonGrams > 0 ? addonGrams : "?"
        } g`,
      ];
    }
    const ratio = 40;
    return [
      `${capitalizeName(target.name)} ${(baseGrams * (1 - ratio / 100)).toFixed(1).replace(/\.0$/, "")} g + ${capitalizeName(
        name || "Add-on",
      )} ${(baseGrams * ratio / 100).toFixed(1).replace(/\.0$/, "")} g at ${ratio}% (available: 20–80% in 10% steps)`,
    ];
  });

  useEffect(() => {
    if (!splashDialog.isOpen || !allSplashOptions?.splashes) return;
    allSplashOptions.splashes.forEach((splash) =>
      (splash.images || []).forEach((media) => {
        const url = getSmallestMediaUrl(media);
        if (url) {
          const image = new window.Image();
          image.src = url;
        }
      }),
    );
  }, [allSplashOptions, splashDialog.isOpen]);

  useEffect(() => {
    if (!tasteMainDialog.isOpen || !allTasteOptions?.tastes) return;
    allTasteOptions.tastes.forEach((taste) => {
      const url = getSmallestMediaUrl(taste.main);
      if (url) {
        const image = new window.Image();
        image.src = url;
      }
    });
  }, [allTasteOptions, tasteMainDialog.isOpen]);
  const canUseCatalogVisuals = Boolean(existingProductId) && !isEditing;
  const hasRequiredVisuals =
    canUseCatalogVisuals ||
    (Boolean(splashId) && Boolean(circleId) && Boolean(mainImageId));
  const componentKeys = componentRows.map((row) =>
    row.componentId
      ? `id:${row.componentId}`
      : `name:${row.name.trim().toLocaleLowerCase()}`,
  );
  const hasValidComponents =
    componentRows.length <= 50 &&
    new Set(componentKeys).size === componentKeys.length &&
    componentRows.every(
      (row) =>
        row.name.trim().length >= 2 &&
        row.name.trim().length <= 100 &&
        (Boolean(row.componentId) || row.isCustom) &&
        Boolean(row.unit) &&
        Number(row.quantity) > 0,
    );
  const validationMessage = (() => {
    if (!brandId) return "Select a brand.";
    if (name.trim().length < 2 || name.trim().length > 100) {
      return "Select or enter a product name between 2 and 100 characters.";
    }
    if (!hasRequiredVisuals) {
      return "Select a splash, circle, and taste main image.";
    }
    if (!hasValidComponents) {
      return "Components must be unique and include a name, unit, and positive quantity (maximum 50).";
    }
    if (!(Number(servingQuantity) > 0)) {
      return "Serving quantity must be greater than zero.";
    }
    if (!(Number(dosage.drinkVolume) >= 50)) {
      return "Full drink volume must be at least 50ml.";
    }
    if (!isDependent && !(Number(dosage.fullDrinkPrice) > 0)) {
      return "Full drink price must be greater than zero.";
    }
    if (
      dosage.smallDrinkVolume !== "" &&
      (Number(dosage.smallDrinkVolume) < 100 ||
        Number(dosage.smallDrinkVolume) >= Number(dosage.drinkVolume))
    ) {
      return "Small drink volume must be at least 100ml and less than the full drink volume.";
    }
    if (
      dosage.smallDrinkPrice !== "" &&
      !(Number(dosage.smallDrinkPrice) >= 0)
    ) {
      return "Small drink price cannot be negative.";
    }
    if (Number(dosage.water) < 50 || Number(dosage.water) > 500) {
      return "Water must be between 50ml and 500ml.";
    }
    if (!(Number(dosage.product) > 0)) {
      return "Product amount must be greater than zero.";
    }
    if (
      Number(dosage.water) + Number(dosage.product) >
      Number(dosage.drinkVolume)
    ) {
      return "Water + Product can't exceed the drink volume.";
    }
    if (!(Number(dosage.conversionFactor) > 0)) {
      return "Conversion factor must be greater than zero.";
    }
    return "";
  })();
  const canSubmit = !validationMessage;

  const resetProductVisuals = () => {
    setExistingProductId("");
    setSplashId("");
    setCircleId("");
    setMainImageId("");
    setCupId(defaultCupId);
  };
  const selectProduct = (product: ProductNameOption) => {
    setName(product.name);
    setExistingProductId(product.id);
    const selected = templateProducts.find(
      (item) => String(item.id) === product.id,
    );
    hydratedProductDetailsId.current =
      selected?.components !== undefined && selected.dosage !== undefined
        ? product.id
        : "";
    setDescription(selected?.description || "");
    setProductType(
      selected?.product_type === "concentrate" ? "concentrate" : "powder",
    );
    setProductPurpose(
      selected?.product_purpose === "milkshake"
        ? "milkshake"
        : "sport nutrition",
    );
    setServingQuantity(
      selected?.serving_qty !== undefined && selected?.serving_qty !== null
        ? String(selected.serving_qty)
        : "100",
    );
    setServingUnit(selected?.serving_unit === "ml" ? "ml" : "g");
    setIsDependent(selected?.is_dependent === true);
    setCanBeAddedToIds([]);
    setComponentRows(toComponentRows(selected));
    setDosage(toDosageValue(selected));
    setSplashId(
      selected?.custom_splash?.id
        ? String(selected.custom_splash.id)
        : selected?.taste?.default_splash?.id
          ? String(selected.taste.default_splash.id)
          : "",
    );
    setCircleId(
      selected?.custom_circle?.id
        ? String(selected.custom_circle.id)
        : selected?.taste?.default_circle?.id
          ? String(selected.taste.default_circle.id)
          : "",
    );
    setMainImageId(
      selected?.custom_main?.id
        ? String(selected.custom_main.id)
        : selected?.taste?.main?.id
          ? String(selected.taste.main.id)
          : "",
    );
    setCupId(
      validCupId(selected?.cup?.id ? String(selected.cup.id) : undefined),
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      setError(validationMessage);
      toast({
        title: "Complete the product",
        description: validationMessage,
        status: "warning",
        duration: 7000,
        isClosable: true,
      });
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch(
        isEditing
          ? `/api/portal/product-lines/${productLine.id}/products/${editingProductId}`
          : `/api/portal/product-lines/${productLine.id}/products`,
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: capitalizeName(name),
            brandId,
            existingProductId: isEditing
              ? editingProductId
              : existingProductId,
            splashId,
            circleId,
            mainImageId,
            cupId: validCupId(cupId),
            components: componentRows.map(
              ({
                componentId,
                isCustom,
                name: componentName,
                quantity,
                unit,
              }) => ({
                componentId,
                isCustom,
                name: componentName,
                quantity: Number(quantity),
                unit,
              }),
            ),
            description,
            productType,
            productPurpose,
            servingQty: Number(servingQuantity),
            servingUnit,
            dosage: {
              fullDrinkVolume: Number(dosage.drinkVolume),
              fullDrinkPrice:
                dosage.fullDrinkPrice === ""
                  ? null
                  : Number(dosage.fullDrinkPrice),
              smallDrinkVolume:
                dosage.smallDrinkVolume === ""
                  ? null
                  : Number(dosage.smallDrinkVolume),
              smallDrinkPrice:
                dosage.smallDrinkPrice === ""
                  ? null
                  : Number(dosage.smallDrinkPrice),
              water: Number(dosage.water),
              product: Number(dosage.product),
              conversionFactor: Number(dosage.conversionFactor),
            },
            isDependent,
            canBeAddedToIds,
          }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || "Product could not be created.");
      }
      toast({
        title: "Product saved",
        description: isEditing
          ? "Updates will take place on machine in 5 minutes."
          : "Assign new product to container",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      const validationWarnings = planogramWarnings(payload?.planogramChecks);
      if (validationWarnings.length) {
        const warning = `Product saved, but machine validation reported: ${validationWarnings.join(
          " · ",
        )}`;
        setError(warning);
        toast({
          title: "Machine artwork or planogram needs attention",
          description: validationWarnings.join(" · "),
          status: "warning",
          duration: 12000,
          isClosable: true,
        });
        return;
      }
      await router.push("/product-lines");
    } catch (submissionError) {
      const message =
        submissionError instanceof Error
          ? submissionError.message
          : "Product could not be saved.";
      setError(message);
      toast({
        title: "Product save failed",
        description: message,
        status: "error",
        duration: 7000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PortalShell
      title={isEditing ? "Edit product" : "New product"}
      description={`Edit what customers will see as one of ${productLineName} product line items (flavors).`}
      clientName={session.client.company}
      access={session.access}
    >
      <SimpleGrid
        columns={{ base: 1, lg: 2 }}
        spacing={{ base: "6", lg: "8" }}
        alignItems="stretch"
      >
        <NewProductForm
          brandId={brandId}
          brandOptions={brandOptions}
          componentRows={componentRows}
          components={components}
          description={description}
          dosage={dosage}
          error={error}
          formId={NEW_PRODUCT_FORM_ID}
          mainImageId={mainImageId}
          mainImageOptions={mainImageOptions}
          name={name}
          onBrandChange={(value) => {
            setBrandId(value);
            if (!isEditing) {
              setName("");
              resetProductVisuals();
            }
          }}
          onComponentRowsChange={setComponentRows}
          onCreateCustomProduct={() => {
            if (!isEditing) resetProductVisuals();
          }}
          onDescriptionChange={setDescription}
          onDosageChange={setDosage}
          onNameChange={(value) => {
            setName(value);
            if (!isEditing) resetProductVisuals();
          }}
          onProductSelect={selectProduct}
          onProductPurposeChange={setProductPurpose}
          onProductTypeChange={setProductType}
          onServingQuantityChange={setServingQuantity}
          onServingUnitChange={setServingUnit}
          onShowMoreMainImages={tasteMainDialog.onOpen}
          onShowMoreSplashes={splashDialog.onOpen}
          onSubmit={submit}
          onVisualChange={{
            splash: setSplashId,
            circle: setCircleId,
            mainImage: setMainImageId,
          }}
          productLineName={productLineName}
          currencies={currencies}
          canEditMachineCurrency={false}
          priceCurrencyId={priceCurrencyId}
          isCurrencySaving={false}
          onPriceCurrencyChange={() => undefined}
          productOptions={productOptions}
          productPurpose={productPurpose}
          productType={productType}
          servingQuantity={servingQuantity}
          servingUnit={servingUnit}
          splashId={splashId}
          splashOptions={splashOptions}
          circleId={circleId}
          circleOptions={circleOptions}
          cupId={cupId}
          cupOptions={cupOptions}
          defaultCup={
            defaultCup
              ? {
                  id: String(defaultCup.id),
                  name: capitalizeName(defaultCup.name),
                  imageUrl: getSmallestMediaUrl(defaultCup.image),
                  subtitle: "Product-line default",
                }
              : undefined
          }
          onCupChange={setCupId}
          isDependent={isDependent}
          onIsDependentChange={(value) => {
            setIsDependent(value);
            if (value) {
              setDosage((current) => ({
                ...current,
                fullDrinkPrice: "",
                smallDrinkPrice: "",
                smallDrinkVolume: "",
              }));
            }
          }}
          canBeAddedToIds={canBeAddedToIds}
          canBeAddedToOptions={canBeAddedToOptions}
          onCanBeAddedToChange={setCanBeAddedToIds}
          mixAllowlistEmpty={allowedLineIds.size === 0}
          mixPreview={mixPreview}
        />
        <NewProductVisualPreview
          brand={selectedBrand}
          circle={selectedCircle}
          cup={selectedCup}
          isSplashLoading={Boolean(
            (existingProductId && isSelectedProductLoading) ||
            (splashId && isSelectedSplashLoading),
          )}
          main={selectedMain}
          productLineName={name || previewProduct?.name || productLineName}
          splashError={Boolean(
            (existingProductId && selectedProductError) ||
            (splashId && selectedSplashError),
          )}
          splashFrames={splashFrames}
          splashIsEmpty={
            selectedSplashResponse?.splash.isEmpty ?? selectedSplash?.isEmpty
          }
        />
      </SimpleGrid>

      <NewProductSelectionDialogs
        isMainImageOpen={tasteMainDialog.isOpen}
        isMainImageLoading={areAllTasteOptionsLoading}
        isSplashOpen={splashDialog.isOpen}
        isSplashLoading={areAllSplashOptionsLoading}
        mainImageError={Boolean(allTasteOptionsError)}
        mainImageId={mainImageId}
        onCloseMainImage={tasteMainDialog.onClose}
        onCloseSplash={splashDialog.onClose}
        onSelectMainImage={(id) => {
          setMainImageId(id);
          tasteMainDialog.onClose();
        }}
        onSelectSplash={(id) => {
          setSplashId(id);
          splashDialog.onClose();
        }}
        splashId={splashId}
        splashError={Boolean(allSplashOptionsError)}
        splashes={allSplashOptions?.splashes || []}
        tastes={allTasteOptions?.tastes || []}
      />
      <HStack spacing="3" mt="4" justify="flex-start">
        <Button
          type="submit"
          form={NEW_PRODUCT_FORM_ID}
          variant="primary"
          size="lg"
          isLoading={isSubmitting}
        >
          Save product
        </Button>
        <Button as={Link} href="/product-lines" size="lg" variant="ghost">
          Cancel
        </Button>
      </HStack>
    </PortalShell>
  );
}

export { NewProductForm } from "./NewProductForm";
export { NewProductSelectionDialogs } from "./NewProductSelectionDialogs";
export { NewProductVisualPreview } from "./NewProductVisualPreview";
