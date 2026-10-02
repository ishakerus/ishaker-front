import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Grid,
  HStack,
  Text,
  useToast,
} from "@chakra-ui/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useMemo, useState } from "react";
import {
  FaBalanceScale,
  FaBolt,
  FaCapsules,
  FaDumbbell,
  FaFilter,
  FaFire,
  FaFlask,
  FaGlassWhiskey,
  FaHeartbeat,
  FaLayerGroup,
  FaLeaf,
  FaRedoAlt,
  FaRunning,
  FaSeedling,
  FaSpa,
  FaStar,
  FaTint,
  FaWater,
  FaWeight,
} from "react-icons/fa";
import { GiBiceps } from "react-icons/gi";
import useSWR from "swr";
import { CupPreview } from "./CupPreview";
import { CupSelector } from "./CupSelector";
import { ProductLineForm } from "./ProductLineForm";
import { type SearchableImageOption } from "./SearchableImageSelect";
import { PortalShell } from "../PortalShell";
import { getMediaUrl } from "../../../lib/portal/media";
import { capitalizeName } from "../../../lib/formatName";
import type {
  PortalProductLine,
  PortalSession,
  PortalSplash,
} from "../../../types/portal";

export type NewProductLinePageProps = {
  session: PortalSession;
  rootProductLines: PortalProductLine[];
  templateProductLines?: PortalProductLine[];
  existingProductLines?: PortalProductLine[];
  splashes: PortalSplash[];
  productLine?: PortalProductLine;
  initialBaseProductLineId?: string;
  loadError?: string;
};

const fetcher = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || "Request failed.");
  return payload as T;
};

const sortFramesByNumericName = <T extends { name?: string; url?: string }>(
  frames: T[] = [],
) =>
  [...frames].sort((left, right) =>
    (left.name || left.url || "").localeCompare(
      right.name || right.url || "",
      undefined,
      { numeric: true, sensitivity: "base" },
    ),
  );

const isSolidColorSplash = (splash: PortalSplash) =>
  /^color\b/i.test(splash.name.trim());

const productLineIcons: Record<string, SearchableImageOption["icon"]> = {
  "amino recover": <FaHeartbeat />,
  bcaa: <FaCapsules />,
  "bucked up": <FaBolt />,
  classic: <FaStar />,
  collagen: <FaSpa />,
  creatine: <GiBiceps />,
  "diet protein": <FaBalanceScale />,
  "energy drink": <FaBolt />,
  "fat burner": <FaFire />,
  gainer: <FaWeight />,
  isolate: <FaFilter />,
  isotonic: <FaWater />,
  "l carnitine": <FaRunning />,
  milkshake: <FaGlassWhiskey />,
  "multi protein": <FaLayerGroup />,
  "natural drink": <FaLeaf />,
  "pre training": <FaBolt />,
  protein: <FaDumbbell />,
  pump: <FaDumbbell />,
  recover: <FaRedoAlt />,
  soda: <FaGlassWhiskey />,
  "sport water": <FaTint />,
  "vegan protein": <FaSeedling />,
  water: <FaTint />,
  "whey protein": <FaDumbbell />,
};

export const getProductLineIcon = (name: string) =>
  productLineIcons[name.trim().toLocaleLowerCase()] || <FaFlask />;

export function NewProductLinePage({
  session,
  rootProductLines,
  templateProductLines = [],
  existingProductLines = [],
  splashes,
  productLine,
  initialBaseProductLineId,
  loadError,
}: NewProductLinePageProps) {
  const router = useRouter();
  const toast = useToast();
  const isEditing = Boolean(productLine?.id);
  const isStaffTemplate = Boolean(
    isEditing &&
      session.access === "product" &&
      productLine?.is_template === true,
  );
  const initialBaseLine = !isEditing
    ? rootProductLines.find(
        (line) => String(line.id) === initialBaseProductLineId,
      )
    : null;
  const [name, setName] = useState(
    capitalizeName(
      productLine?.base_product_line?.name ||
        productLine?.name ||
        initialBaseLine?.name,
    ),
  );
  const [baseProductLineId, setBaseProductLineId] = useState(
    isStaffTemplate && productLine?.id
      ? String(productLine.id)
      : productLine?.base_product_line?.id
      ? String(productLine.base_product_line.id)
      : initialBaseLine
        ? String(initialBaseLine.id)
        : "",
  );
  const [cupId, setCupId] = useState(
    productLine?.cups?.[0]?.id
      ? String(productLine.cups[0].id)
      : initialBaseLine?.cups?.[0]?.id
        ? String(initialBaseLine.cups[0].id)
        : "",
  );
  const [customSplashId, setCustomSplashId] = useState(
    productLine?.custom_splash?.id
      ? String(productLine.custom_splash.id)
      : initialBaseLine?.cups?.[0]?.default_splash?.id
        ? String(initialBaseLine.cups[0].default_splash.id)
        : initialBaseLine?.custom_splash?.id
          ? String(initialBaseLine.custom_splash.id)
          : "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canBeAddedToIds, setCanBeAddedToIds] = useState(
    (productLine?.can_be_added_to || []).map((line) => String(line.id)),
  );
  const [error, setError] = useState("");
  const [serverDuplicate, setServerDuplicate] =
    useState<PortalProductLine | null>(null);

  const baseOptionLines = useMemo(
    () =>
      isStaffTemplate && productLine
        ? Array.from(
            new Map(
              [productLine, ...rootProductLines].map((line) => [
                String(line.id),
                line,
              ]),
            ).values(),
          )
        : rootProductLines,
    [isStaffTemplate, productLine, rootProductLines],
  );
  const baseOptions = useMemo(
    () =>
      [...baseOptionLines]
        .sort(
          (left, right) =>
            Number(Boolean(right.isPopular)) -
              Number(Boolean(left.isPopular)) ||
            left.name.localeCompare(right.name, undefined, {
              sensitivity: "base",
            }),
        )
        .map((line) => ({
          id: String(line.id),
          name: capitalizeName(line.name),
          icon: getProductLineIcon(line.name),
          ...(line.isPopular
            ? { subtitle: "Popular", subtitleColor: "green.300" }
            : {}),
        })),
    [baseOptionLines],
  );
  const splashOptions = useMemo(
    () =>
      [...splashes]
        .sort(
          (left, right) =>
            Number(isSolidColorSplash(right)) -
              Number(isSolidColorSplash(left)) ||
            left.name.localeCompare(right.name, undefined, {
              sensitivity: "base",
            }),
        )
        .map((splash) => ({
          id: String(splash.id),
          name: capitalizeName(splash.name),
          color: splash.color || "transparent",
          ...(isSolidColorSplash(splash)
            ? { badge: "Solid color", badgeColorScheme: "green" }
            : {}),
        })),
    [splashes],
  );
  const selectedBaseLine = rootProductLines.find(
    (line) => String(line.id) === baseProductLineId,
  );
  const selectedExistingLine = useMemo(() => {
    if (isEditing || !selectedBaseLine) return null;
    const normalizedName = selectedBaseLine.name.trim().toLocaleLowerCase();
    return (
      existingProductLines.find(
        (line) =>
          String(line.base_product_line?.id) === String(selectedBaseLine.id),
      ) ||
      existingProductLines.find(
        (line) => line.name.trim().toLocaleLowerCase() === normalizedName,
      ) ||
      null
    );
  }, [existingProductLines, isEditing, selectedBaseLine]);
  const duplicateProductLine = selectedExistingLine || serverDuplicate;
  const availableCups = selectedBaseLine?.cups || productLine?.cups || [];
  const selectedCup = availableCups.find((cup) => String(cup.id) === cupId);
  const {
    data: customSplashResponse,
    error: customSplashError,
    isLoading: isCustomSplashLoading,
  } = useSWR<{ splash: PortalSplash }>(
    cupId && customSplashId
      ? `/api/portal/splashes/${customSplashId}`
      : null,
    fetcher,
  );
  const customSplashFrames = useMemo(
    () =>
      sortFramesByNumericName(customSplashResponse?.splash.images)
        .map((image) => getMediaUrl(image))
        .filter(Boolean) || [],
    [customSplashResponse],
  );
  const splashFrames = customSplashId ? customSplashFrames : [];
  const splashIsEmpty = customSplashId
    ? customSplashResponse?.splash.isEmpty
    : undefined;
  const canSubmit = isStaffTemplate
    ? !loadError
    : Boolean(
        name.trim().length >= 2 &&
          baseProductLineId &&
          cupId &&
          !duplicateProductLine &&
          !loadError,
      );
  const canBeAddedToOptions = templateProductLines
    .filter(
      (line) =>
        line.is_template === true && String(line.id) !== String(productLine?.id),
    )
    .map((line) => ({
      id: String(line.id),
      label: capitalizeName(line.name),
    }));
  const inheritedMixTargets = (
    selectedBaseLine?.can_be_added_to ||
    productLine?.base_product_line?.can_be_added_to ||
    []
  )
    .map((line) => capitalizeName(line.name))
    .join(", ");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError("");
    try {
      const saveProductLine = async (): Promise<string | false> => {
        const response = await fetch(
          isEditing
            ? `/api/portal/product-lines/${productLine?.id}`
            : "/api/portal/product-lines",
          {
            method: isEditing ? "PATCH" : "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              name: capitalizeName(name),
              baseProductLineId,
              cupId,
              customSplashId,
              ...(isStaffTemplate ? { canBeAddedToIds } : {}),
            }),
          },
        );
        const payload = await response.json().catch(() => null);

        if (
          !isEditing &&
          response.status === 409 &&
          payload?.error === "duplicate_name" &&
          payload?.existingProductLine?.id
        ) {
          setServerDuplicate(payload.existingProductLine);
          return false;
        }

        if (!response.ok) {
          throw new Error(
            payload?.message ||
              `Product line could not be ${isEditing ? "updated" : "created"}.`,
          );
        }

        const savedProductLineId = payload?.productLine?.id;
        if (!savedProductLineId) {
          throw new Error("The saved product line ID was not returned.");
        }
        return String(savedProductLineId);
      };

      const savedProductLineId = await saveProductLine();
      if (!savedProductLineId) return;

      toast({
        title: isEditing ? "Drink updated" : "Drink created",
        description:
          "This library change does not affect a machine until a container is assigned.",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      await router.push(
        isEditing
          ? "/product-lines"
          : `/product-lines/${savedProductLineId}/products/new`,
      );
    } catch (submissionError) {
      const message =
        submissionError instanceof Error
          ? submissionError.message
          : `Product line could not be ${isEditing ? "updated" : "created"}.`;
      setError(message);
      toast({
        title: "Product line save failed",
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
      title={isEditing ? "Edit product line" : "New product line"}
      description={`${isEditing ? "Update" : "Choose"} a product line and its default cup.`}
      clientName={session.client.company}
      access={session.access}
    >
      {loadError ? (
        <Alert status="error" borderRadius="xl" mb="6">
          <AlertIcon />
          {loadError}
        </Alert>
      ) : null}

      <Grid
        templateAreas={{
          base: '"form" "preview"',
          lg: '"form preview"',
        }}
        templateColumns={{ base: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }}
        gap={{ base: "6", lg: "8" }}
        alignItems="stretch"
      >
        <Box gridArea="form">
          <ProductLineForm
            baseOptions={baseOptions}
            baseProductLineId={baseProductLineId}
            isBaseSelectionDisabled={isStaffTemplate}
            canSubmit={canSubmit}
            canEditMixRules={isStaffTemplate}
            canBeAddedToIds={canBeAddedToIds}
            canBeAddedToOptions={canBeAddedToOptions}
            onCanBeAddedToChange={setCanBeAddedToIds}
            canBeAddedToHint={
              session.access === "client"
                ? inheritedMixTargets || "None"
                : undefined
            }
            customSplashId={customSplashId}
            duplicateSuggestion={
              duplicateProductLine ? (
                <Alert status="info" borderRadius="xl" alignItems="center">
                  <AlertIcon />
                  <Box flex="1" minW="0">
                    <Text fontWeight="700">
                      This product line already exists
                    </Text>
                    <Text fontSize="sm" color="bg.200">
                      Add a product to {capitalizeName(duplicateProductLine.name)}
                      instead of creating a duplicate line.
                    </Text>
                  </Box>
                  <HStack ml="3" flexShrink={0}>
                    <Button
                      as={Link}
                      href={`/product-lines/${duplicateProductLine.id}/products/new`}
                      size="sm"
                      variant="primary"
                    >
                      Add product
                    </Button>
                  </HStack>
                </Alert>
              ) : null
            }
            cupSelector={
              <CupSelector
                cups={availableCups}
                value={cupId}
                onChange={(value) => {
                  setCupId(value);
                  const cup = availableCups.find(
                    (option) => String(option.id) === value,
                  );
                  setCustomSplashId(
                    cup?.default_splash?.id
                      ? String(cup.default_splash.id)
                      : "",
                  );
                }}
              />
            }
            error={error}
            isSubmitting={isSubmitting}
            onBaseProductLineChange={(value) => {
              setServerDuplicate(null);
              setBaseProductLineId(value);
              const rootLine = rootProductLines.find(
                (line) => String(line.id) === value,
              );
              const firstCup = rootLine?.cups?.[0];
              setName(rootLine ? capitalizeName(rootLine.name) : "");
              setCupId(firstCup?.id ? String(firstCup.id) : "");
              setCustomSplashId(
                firstCup?.default_splash?.id
                  ? String(firstCup.default_splash.id)
                  : rootLine?.custom_splash?.id
                  ? String(rootLine.custom_splash.id)
                  : "",
              );
            }}
            onCustomSplashChange={setCustomSplashId}
            onSubmit={onSubmit}
            splashOptions={splashOptions}
            submitLabel={isEditing ? "Save changes" : "Create product line"}
          />
        </Box>

        <Box gridArea="preview">
          <CupPreview
            cup={selectedCup}
            isSplashLoading={Boolean(customSplashId && isCustomSplashLoading)}
            productLineName={name || selectedBaseLine?.name}
            splashError={Boolean(customSplashId && customSplashError)}
            splashFrames={splashFrames}
            splashIsEmpty={splashIsEmpty}
          />
        </Box>
      </Grid>
    </PortalShell>
  );
}
