import { EnglishFileInput } from "../components/shared/EnglishFileInput";
import {
  Alert,
  AlertIcon,
  AspectRatio,
  Box,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Image,
  Input,
  Link,
  SimpleGrid,
  VStack,
  Text,
} from "@chakra-ui/react";
import NextLink from "next/link";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  SPLASH_FADE_MS,
  useSplashAnimation,
} from "../components/home/Splash";
import { BrandCreateForm } from "../components/portal/catalog/BrandCreateForm";
import { CatalogCollections } from "../components/portal/catalog/CatalogCollections";
import { addCatalogVisibilityFilters, validateCatalogFile } from "../lib/portal/catalogAssets";
import { PortalShell } from "../components/portal/PortalShell";
import { SearchableImageSelect } from "../components/portal/product-lines/SearchableImageSelect";
import { TasteMainPreview } from "../components/portal/product-lines/new-product/TasteMainPreview";
import { requestVisibleCatalogAssets } from "../lib/portal/catalogOwnership";
import { loadCatalogCollections } from "../lib/portal/loadCatalogCollections";
import { requirePortalSession } from "../lib/portal/auth";
import {
  generateSplashInBrowser,
  type GeneratedSplashFrame,
} from "../lib/portal/generateSplash";
import { requestWithSplashOwnershipFallback } from "../lib/portal/splashOwnership";
import { getSmallestMediaUrl } from "../lib/portal/media";
import {
  mediaKeyFromFilename,
  normalizeMediaFilename,
} from "../lib/portal/mediaFilename";
import { requestStrapiRestAsService } from "../services/server/strapiClient";
import type {
  PortalBrand,
  PortalCircle,
  PortalSession,
  PortalSplash,
  PortalTaste,
} from "../types/portal";

type CatalogPageProps = {
  session: PortalSession;
  tastes: PortalTaste[];
  brands: PortalBrand[];
  circles: PortalCircle[];
  splashes: PortalSplash[];
  loadErrors: string[];
};

type EncodedFile = { name: string; type: string; data: string };

const sortMediaByName = <T extends { name?: string; url?: string }>(
  images: T[] = [],
) =>
  [...images].sort((left, right) =>
    (left.name || left.url || "").localeCompare(
      right.name || right.url || "",
      undefined,
      { numeric: true, sensitivity: "base" },
    ),
  );

const MediaKeyPreview = ({ file }: { file: File | null }) =>
  file ? (
    <FormHelperText color="acid.300">
      Stored as <strong>{normalizeMediaFilename(file.name)}</strong>; machine
      key: <strong>{mediaKeyFromFilename(file.name)}</strong>
    </FormHelperText>
  ) : null;

const encodeFile = (file: File): Promise<EncodedFile> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve({
        name: file.name,
        type: file.type,
        data: result.split(",")[1] || "",
      });
    };
    reader.readAsDataURL(file);
  });

export default function CatalogPage({
  session,
  tastes = [],
  brands = [],
  circles = [],
  splashes = [],
  loadErrors = [],
}: CatalogPageProps) {
  const [name, setName] = useState("");
  const [main, setMain] = useState<File | null>(null);
  const [mainPreviewUrl, setMainPreviewUrl] = useState("");
  const [circleId, setCircleId] = useState("");
  const [splashId, setSplashId] = useState("");
  const [elements, setElements] = useState<File[]>([]);
  const [generatedFrames, setGeneratedFrames] = useState<
    GeneratedSplashFrame[]
  >([]);
  const [generatedPreview, setGeneratedPreview] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const router = useRouter();
  const mainSelection = useRef(0);
  const ingredientSelection = useRef(0);
  useEffect(() => {
    if (!main) {
      setMainPreviewUrl("");
      return;
    }

    const url = URL.createObjectURL(main);
    setMainPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [main]);

  const generatedFrameUrls = useMemo(
    () =>
      generatedFrames.map(
        (frame) => `data:${frame.type};base64,${frame.data}`,
      ),
    [generatedFrames],
  );
  const { activeFrame: generatedActiveFrame, isFading: isPreviewFading } =
    useSplashAnimation(
      generatedFrameUrls.length ? [generatedFrameUrls] : [],
      generatedFrameUrls.length > 0,
    );

  const clearGeneratedSplash = () => {
    setGeneratedFrames([]);
    setGeneratedPreview("");
  };

  const generateSplash = async () => {
    if (name.trim().length < 2 || !splashId || elements.length !== 5) return;

    setIsGenerating(true);
    setMessage("");
    setIsError(false);
    clearGeneratedSplash();
    try {
      const splash = splashes.find((item) => String(item.id) === splashId);
      if (!splash) throw new Error("Select an existing color splash.");
      const frames = await generateSplashInBrowser({
        name,
        splash,
        elements,
      });
      setGeneratedFrames(frames);
      setGeneratedPreview(
        `data:image/png;base64,${frames[frames.length - 1]?.data || ""}`,
      );
      setMessage("Custom splash generated. Check the preview, then create your taste.");
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "Splash generation failed.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!main || !circleId || !splashId || generatedFrames.length !== 20) return;

    // Grab the form node before the first await: React nulls
    // event.currentTarget once the handler returns.
    const form = event.currentTarget;

    setIsSubmitting(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch("/api/portal/tastes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          main: await encodeFile(main),
          circleId,
          splashId,
          generatedFrames,
        }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload?.message || "Submission failed.");

      setMessage(
        "Custom taste created. It is available in your catalog and product editor now.",
      );
      setName("");
      setMain(null);
      setCircleId("");
      setSplashId("");
      setElements([]);
      clearGeneratedSplash();
      form.reset();
      // Refresh the catalog after creation. A failed refresh must not
      // turn a successful creation into an error message.
      await router
        .replace(router.asPath, undefined, { scroll: false })
        .catch(() => undefined);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PortalShell
      title="Taste and brand catalog"
      description="Create and manage your tastes and brands, or browse shared catalog items."
      clientName={session.client.company}
    >
      {loadErrors.length ? (
        <Alert status="warning" borderRadius="xl" my="4">
          <AlertIcon />
          Could not load {loadErrors.join(", ")}. Please try again later. Other available catalog options are shown below.
        </Alert>
      ) : null}
      <Box
        as="form"
        onSubmit={submit}
        bg="bg.900"
        border="1px solid"
        borderColor="whiteAlpha.100"
        borderRadius="2xl"
        p={{ base: "5", md: "7" }}
        maxW="1200px"
        my="4"
      >
        <VStack spacing="5" align="stretch">
          <Box>
            <Text color="bg.50" fontSize="2xl" fontWeight="800">
              Add a custom taste
            </Text>
            <Link as={NextLink} href="/articles/create-taste" color="acid.300">How to create a taste</Link>
          </Box>

          <SimpleGrid columns={{ base: 1, lg: 2 }} spacing="8" alignItems="start">
            <VStack spacing="5" align="stretch">
              <FormControl isRequired isDisabled={isGenerating || isSubmitting}>
                <FormLabel>Taste name</FormLabel>
                <Input
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    clearGeneratedSplash();
                  }}
                  minLength={2}
                  maxLength={80}
                  bg="bg.800"
                />
              </FormControl>

              <FormControl isRequired isDisabled={isGenerating || isSubmitting}>
                <FormLabel>Main image</FormLabel>
                <EnglishFileInput
                  selectedFiles={main ? [main] : []}
                  accept=".png,image/png"
                  onChange={async (event) => {
                    const input = event.currentTarget;
                    const file = input.files?.[0];
                    const version = ++mainSelection.current;
                    setMain(null);
                    setMessage("");
                    if (!file) return;
                    try {
                      await validateCatalogFile(file, "main", "Main image");
                      if (version === mainSelection.current) setMain(file);
                    } catch (error) {
                      if (version !== mainSelection.current) return;
                      input.value = "";
                      setIsError(true);
                      setMessage(error instanceof Error ? error.message : "Invalid main image.");
                    }
                  }}
                />
                <FormHelperText>PNG only, exactly 350 × 350 px, maximum 5 MB. Use a transparent background.</FormHelperText>
                <MediaKeyPreview file={main} />
              </FormControl>

              <FormControl isRequired isDisabled={isGenerating || isSubmitting}>
                <FormLabel>Circle image</FormLabel>
                <SearchableImageSelect
                  ariaLabel="Select a circle image"
                  emptyLabel="No circle images are available."
                  options={circles.map((circle) => ({
                    id: String(circle.id),
                    name: circle.name || `Circle ${circle.id}`,
                    imageUrl: getSmallestMediaUrl(circle.images?.[0]),
                    color: circle.color || undefined,
                  }))}
                  placeholder="Select an existing circle image"
                  value={circleId}
                  onChange={setCircleId}
                />
                <FormHelperText>
                  Choose from circle images already available in iShaker.
                </FormHelperText>
              </FormControl>

              <FormControl isRequired isDisabled={isGenerating || isSubmitting}>
                <FormLabel>Base color splash</FormLabel>
                <SearchableImageSelect
                  ariaLabel="Select a base color splash"
                  emptyLabel='No splashes beginning with "color " are available.'
                  options={splashes.map((splash) => {
                    const frames = sortMediaByName(splash.images);
                    return {
                      id: String(splash.id),
                      name: splash.name,
                      imageUrl: getSmallestMediaUrl(frames[frames.length - 1]),
                      color: splash.color || undefined,
                    };
                  })}
                  placeholder="Select an existing color splash"
                  value={splashId}
                  onChange={(value) => {
                    setSplashId(value);
                    clearGeneratedSplash();
                  }}
                />
                <FormHelperText>
                  The selected root splash is combined with the five images
                  below. Selectors show its last animation frame.
                </FormHelperText>
              </FormControl>

              <FormControl isRequired isDisabled={isGenerating || isSubmitting}>
                <FormLabel>Ingredient images</FormLabel>
                <EnglishFileInput
                  selectedFiles={elements}
                  multiple
                  accept=".png,image/png"
                  onChange={async (event) => {
                    const input = event.currentTarget;
                    const files = Array.from(input.files || []);
                    const version = ++ingredientSelection.current;
                    setElements([]);
                    clearGeneratedSplash();
                    setMessage("");
                    if (!files.length) return;
                    try {
                      if (files.length !== 5) throw new Error("Choose exactly 5 ingredient images.");
                      await Promise.all(files.map((file, index) => validateCatalogFile(file, "ingredient", `Ingredient image ${index + 1}`)));
                      if (version === ingredientSelection.current) setElements(files);
                    } catch (error) {
                      if (version !== ingredientSelection.current) return;
                      input.value = "";
                      setIsError(true);
                      setMessage(error instanceof Error ? error.message : "Invalid ingredient images.");
                    }
                  }}
                />
                <FormHelperText>
                  Choose exactly 5 PNG images, each 500 × 500 px and no larger than 5 MB. Use transparent backgrounds.
                </FormHelperText>
              </FormControl>

              <Button
                type="button"
                variant="default"
                alignSelf="flex-start"
                isLoading={isGenerating}
                loadingText="Generating"
                isDisabled={
                  name.trim().length < 2 || !splashId || elements.length !== 5
                }
                onClick={generateSplash}
              >
                Generate splash
              </Button>

              {message ? (
                <Alert status={isError ? "error" : "success"} borderRadius="xl">
                  <AlertIcon />
                  {message}
                </Alert>
              ) : null}

              <Button
                type="submit"
                variant="primary"
                alignSelf="flex-start"
                isLoading={isSubmitting}
                isDisabled={
                  !name ||
                  !main ||
                  !circleId ||
                  !splashId ||
                  generatedFrames.length !== 20
                }
              >
                Create taste
              </Button>
            </VStack>

            <VStack
              spacing="5"
              align="stretch"
              position={{ lg: "sticky" }}
              top={{ lg: "5" }}
            >
              <Box
                bg="bg.800"
                border="1px solid"
                borderColor="whiteAlpha.100"
                borderRadius="2xl"
                p={{ base: "4", md: "6" }}
              >
                <Text color="bg.50" fontSize="lg" fontWeight="800" mb="3">
                  Resulting splash
                </Text>
                <AspectRatio ratio={619 / 617} bg="blackAlpha.300" borderRadius="xl">
                  {generatedPreview ? (
                    <Image
                      src={generatedActiveFrame || generatedPreview}
                      alt="Generated custom splash preview"
                      objectFit="contain"
                      p="3"
                      opacity={isPreviewFading ? 0 : 1}
                      transition={`opacity ${SPLASH_FADE_MS / 1000}s ease`}
                    />
                  ) : (
                    <Box display="flex" alignItems="center" justifyContent="center" p="8">
                      <Text color="bg.300" textAlign="center">
                        Select a color splash and five ingredient images, then
                        generate to preview the result.
                      </Text>
                    </Box>
                  )}
                </AspectRatio>
                <Text color="bg.300" fontSize="sm" mt="3">
                  This preview plays the generated 20-frame animation and holds
                  briefly on its final frame.
                </Text>
              </Box>
              <TasteMainPreview
                compact
                circle={circles.find((circle) => String(circle.id) === circleId)}
                mainImageUrl={mainPreviewUrl}
              />
            </VStack>
          </SimpleGrid>
        </VStack>
      </Box>
      <BrandCreateForm />
      <CatalogCollections tastes={tastes} brands={brands} clientId={session.client.id} />
    </PortalShell>
  );
}

export const getServerSideProps: GetServerSideProps<CatalogPageProps> = async (
  context,
) => {
  const result = await requirePortalSession(context);
  if ("redirect" in result) return { redirect: result.redirect };

  const tasteParams = new URLSearchParams();
  tasteParams.set("populate[main][fields][0]", "url");
  tasteParams.set("populate[main][fields][1]", "formats");
  tasteParams.set(
    "populate[default_circle][populate][images][fields][0]",
    "url",
  );
  tasteParams.set("populate[author][fields][0]", "company");
  tasteParams.set("sort[0]", "name:ASC");
  tasteParams.set("pagination[pageSize]", "2000");

  const brandParams = new URLSearchParams({
    "populate[logo][fields][0]": "url",
    "populate[logo][fields][1]": "formats",
    "populate[author][fields][0]": "company",
    "sort[0]": "name:ASC",
    "pagination[pageSize]": "2000",
  });
  // Only shared/root assets and this cabinet's own assets belong in its catalog.
  for (const params of [tasteParams, brandParams]) {
    addCatalogVisibilityFilters(params, result.session.client.id);
  }

  const circleParams = new URLSearchParams();
  circleParams.set("fields[0]", "name");
  circleParams.set("fields[1]", "color");
  circleParams.set("populate[images][fields][0]", "url");
  circleParams.set("populate[images][fields][1]", "formats");
  circleParams.set("sort[0]", "name:ASC");
  circleParams.set("pagination[pageSize]", "2000");

  const splashParams = new URLSearchParams();
  splashParams.set("filters[name][$startsWithi]", "color ");
  splashParams.set("filters[author][username][$eq]", "root");
  splashParams.set("fields[0]", "name");
  splashParams.set("fields[1]", "color");
  splashParams.set("populate[images][fields][0]", "url");
  splashParams.set("populate[images][fields][1]", "formats");
  splashParams.set("populate[images][fields][2]", "name");
  splashParams.set("sort[0]", "name:ASC");
  splashParams.set("pagination[pageSize]", "2000");
  const loadSplashes = (params: URLSearchParams) =>
    requestStrapiRestAsService<PortalSplash[]>(
      `/api/splashes?${params.toString()}`,
    );

  const collections = await loadCatalogCollections({
    tastes: () => requestVisibleCatalogAssets(tasteParams, result.session.client.id,
      (query) => requestStrapiRestAsService<PortalTaste[]>(`/api/tastes?${query}`),
    ),
    brands: () => requestVisibleCatalogAssets(brandParams, result.session.client.id,
      (query) => requestStrapiRestAsService<PortalBrand[]>(`/api/brands?${query}`),
    ),
    circles: () => requestStrapiRestAsService<PortalCircle[]>(
      `/api/circles?${circleParams.toString()}`,
    ),
    splashes: () => requestWithSplashOwnershipFallback(
      splashParams,
      loadSplashes,
      () => console.warn(
        "[catalog] splash ownership filtering is unsupported; using the compatible query.",
      ),
    ),
  }, (name, error) => {
    console.error(`[catalog] ${name} loading failed:`, error);
  });

  return { props: { session: result.session, ...collections } };
};
