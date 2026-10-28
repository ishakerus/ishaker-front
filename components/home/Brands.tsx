import {
  Box,
  Button,
  Collapse,
  Container,
  SimpleGrid,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FaChevronDown } from "react-icons/fa";
import { getStrapiBaseUrl } from "../../services/fetchers";
import CustomTitle from "./CutsomTitle";

const STRAPI_URL = getStrapiBaseUrl();
const BRAND_SOURCE_URL = `${STRAPI_URL}/api/brands?pagination[page]=1&pagination[pageSize]=2000&sort[0]=updatedAt:desc&populate[logo][fields][0]=url&populate[logo][fields][1]=formats&fields[0]=name`;
const VISIBLE_BRAND_LIMIT = 40;

type StrapiMedia = {
  attributes?: {
    formats?: {
      thumbnail?: {
        url?: string | null;
      };
      small?: {
        url?: string | null;
      };
    } | null;
    url?: string | null;
  };
};

type Brand = {
  id: number;
  attributes?: {
    logo?: {
      data?: StrapiMedia | null;
    };
    name?: string | null;
  };
};

type BrandsResponse = {
  data?: Brand[];
};

type BrandLogo = {
  id: number;
  image: string;
  name: string;
};

function normalizeMediaUrl(url?: string | null) {
  if (!url) {
    return null;
  }

  return url.startsWith("http") ? url : `${STRAPI_URL}${url}`;
}

function getSmallestLogoUrl(media?: StrapiMedia | null) {
  return normalizeMediaUrl(
    media?.attributes?.formats?.thumbnail?.url ??
      media?.attributes?.formats?.small?.url ??
      media?.attributes?.url,
  );
}

function getBrandLogos(response: BrandsResponse) {
  return (
    response.data
      ?.map((brand) => {
        const image = getSmallestLogoUrl(brand.attributes?.logo?.data);
        const name = brand.attributes?.name?.trim();

        if (!image || !name) {
          return null;
        }

        return {
          id: brand.id,
          image,
          name,
        };
      })
      .filter((brand): brand is BrandLogo => Boolean(brand)) ?? []
  );
}

function BrandTile({ brand }: { brand: BrandLogo }) {
  return (
    <Box
      key={brand.id}
      as="figure"
      m="0"
      textAlign="center"
      role="group"
      w="full"
      minW="0"
      display="flex"
      flexDirection="column"
      alignItems="center"
    >
      <Box
        w="full"
        h={{ base: "42px", md: "76px" }}
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Box
          as="img"
          src={brand.image}
          alt={`${brand.name} logo`}
          loading="lazy"
          decoding="async"
          display="block"
          mx="auto"
          maxW="100%"
          maxH="100%"
          objectFit="contain"
          objectPosition="center center"
          filter="grayscale(1)"
          opacity="0.72"
          transition="filter 0.1s ease, opacity 0.1s ease"
          _groupHover={{
            filter: "grayscale(0)",
            opacity: 1,
          }}
        />
      </Box>
      <Text
        as="figcaption"
        mt={{ base: "1.5", md: "2" }}
        color="bg.400"
        fontSize={{ base: "10px", md: "sm" }}
        fontWeight="500"
        lineHeight="1.25"
        noOfLines={2}
      >
        {brand.name}
      </Text>
    </Box>
  );
}

function BrandGrid({ brands, mt = "0" }: { brands: BrandLogo[]; mt?: string }) {
  return (
    <SimpleGrid
      columns={{ base: 5, md: 8 }}
      spacing={{ base: "3", md: "5" }}
      alignItems="start"
      justifyItems="center"
      mt={mt}
    >
      {brands.map((brand) => (
        <BrandTile key={brand.id} brand={brand} />
      ))}
    </SimpleGrid>
  );
}

export function Brands() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const didRequestBrands = useRef(false);
  const shaderBg = useColorModeValue("bg.50", "bg.900");
  const [brandLogos, setBrandLogos] = useState<BrandLogo[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const visibleBrandLogos = useMemo(() => brandLogos, [brandLogos]);
  const initialBrandLogos = visibleBrandLogos.slice(0, VISIBLE_BRAND_LIMIT);
  const collapsedBrandLogos = visibleBrandLogos.slice(VISIBLE_BRAND_LIMIT);

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsActive(entry.isIntersecting);
      },
      {
        root: null,
        rootMargin: "160px 0px",
        threshold: 0.05,
      },
    );

    observer.observe(root);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isActive || didRequestBrands.current) {
      return undefined;
    }

    didRequestBrands.current = true;

    async function loadBrands() {
      try {
        const response = await fetch(BRAND_SOURCE_URL);

        if (!response.ok) {
          throw new Error(`Brand request failed with ${response.status}`);
        }

        const brandsResponse = (await response.json()) as BrandsResponse;
        setBrandLogos(getBrandLogos(brandsResponse));
      } catch (error) {
        console.error("[brands] Failed to load brand data:", error);
      }
    }

    loadBrands();

    return undefined;
  }, [isActive]);

  return (
    <Container ref={rootRef} maxW="7xl" py={{ base: "8", md: "12" }}>
      <CustomTitle
        as="h2"
        title="Brands we are working with"
        mt="0"
        mb={{ base: "8", md: "12" }}
        fontSize={{ base: "3xl", md: "6xl" }}
      />

      {initialBrandLogos.length ? (
        <>
          <BrandGrid brands={initialBrandLogos} />

          {collapsedBrandLogos.length ? (
            <>
              {!isExpanded ? (
                <Box
                  aria-hidden="true"
                  h={{ base: "150px", md: "250px" }}
                  mt={{ base: "-150px", md: "-250px" }}
                  position="relative"
                  zIndex="1"
                  bgGradient={`linear(to-b, transparent 0%, ${shaderBg} 100%)`}
                  pointerEvents="none"
                />
              ) : null}

              <Collapse in={isExpanded} animateOpacity>
                {isExpanded ? (
                  <BrandGrid brands={collapsedBrandLogos} mt="5" />
                ) : null}
              </Collapse>

              <Box mt={{ base: "6", md: "8" }} textAlign="center">
                <Button
                  variant="contrast"
                  size={{ base: "sm", md: "md" }}
                  rightIcon={
                    <Box
                      as={FaChevronDown}
                      transition="transform 0.15s ease"
                      transform={isExpanded ? "rotate(180deg)" : "rotate(0deg)"}
                    />
                  }
                  onClick={() => setIsExpanded((current) => !current)}
                >
                  {isExpanded ? "Show less" : "Show more"}
                </Button>
              </Box>
            </>
          ) : null}
        </>
      ) : null}
    </Container>
  );
}
