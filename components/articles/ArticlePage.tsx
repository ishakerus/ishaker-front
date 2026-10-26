import {
  AspectRatio,
  Badge,
  Box,
  Container,
  Flex,
  Heading,
  Image,
  SimpleGrid,
  VStack,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { Header } from "../home/Header";
import { getStrapiBaseUrl } from "../../services/fetchers";
import type { Article, ArticleMachineType, StrapiImage } from "../../types/article";
import { ArticleMarkdown } from "./ArticleMarkdown";

const imageValue = (image?: StrapiImage | null) => image?.data?.attributes || image?.data || image?.attributes || image;

const machinePreviewUrl = (image?: StrapiImage | null) => {
  const value = imageValue(image);
  const url = value?.formats?.small?.url || value?.formats?.thumbnail?.url || value?.formats?.medium?.url || value?.url;
  if (!url) return null;
  return /^(https?:)?\/\//i.test(url) ? url : `${getStrapiBaseUrl()}${url.startsWith("/") ? "" : "/"}${url}`;
};

const fallbackMachinePreview = (name?: string | null) => {
  const normalized = name?.toLowerCase() || "";
  if (normalized.includes("touch")) return "/shaker-touch.png";
  if (normalized.includes("shaker s") || normalized === "s") return "/shaker-s.png";
  return null;
};

function MachineTypeCard({ machineType }: { machineType: ArticleMachineType }) {
  const preview = machinePreviewUrl(machineType.preview) || fallbackMachinePreview(machineType.name);

  return (
    <Flex
      align="center"
      gap="4"
      p="3"
      bg="blackAlpha.300"
      border="1px solid"
      borderColor="whiteAlpha.100"
      borderRadius="xl"
      minW="0"
    >
      <AspectRatio ratio={1} w="72px" flex="0 0 72px" bg="whiteAlpha.50" borderRadius="lg" overflow="hidden">
        {preview ? (
          <Image src={preview} alt={machineType.name || "Compatible machine"} objectFit="contain" p="1" />
        ) : (
          <Flex align="center" justify="center" color="acid.300" fontSize="2xl" fontWeight="900">iS</Flex>
        )}
      </AspectRatio>
      <Box minW="0">
        <Text color="bg.400" fontSize="xs" fontWeight="800" textTransform="uppercase" letterSpacing="0.12em">
          Machine type
        </Text>
        <Text color="bg.50" fontWeight="800" textTransform="capitalize" noOfLines={2}>{machineType.name || "iShaker"}</Text>
      </Box>
    </Flex>
  );
}

export function ArticlePage({ article }: { article: Article }) {
  const pageBg = useColorModeValue("bg.50", "bg.1000");
  const panelBg = useColorModeValue("white", "bg.900");
  const borderColor = useColorModeValue("blackAlpha.100", "whiteAlpha.100");
  const machines = article.machine_types || [];

  return (
    <Box minH="100vh" bg={pageBg} position="relative" overflow="hidden">
      <Box position="absolute" top="80px" left="-180px" w="520px" h="520px" bg="acid.400" opacity="0.06" filter="blur(110px)" borderRadius="full" pointerEvents="none" />
      <Box position="absolute" top="360px" right="-220px" w="560px" h="560px" bg="violet.500" opacity="0.08" filter="blur(130px)" borderRadius="full" pointerEvents="none" />

      <Header borderColor={borderColor} />

      <Box as="main" position="relative">
        <Container maxW="6xl" pt={{ base: "12", md: "20" }} pb={{ base: "16", md: "28" }}>
          <SimpleGrid columns={{ base: 1, lg: machines.length ? 2 : 1 }} spacing={{ base: "10", lg: "16" }} alignItems="center" mb={{ base: "12", md: "16" }}>
            <VStack
              spacing="6"
              maxW={machines.length ? "760px" : "900px"}
              align="stretch"
            >
              <Badge alignSelf="flex-start" px="3" py="1.5" borderRadius="full" bg="acid.300" color="bg.1000" fontSize="xs" letterSpacing="0.13em">
                iShaker support
              </Badge>
              <Heading as="h1" color="bg.50" fontSize={{ base: "3xl", sm: "4xl", md: "5xl", xl: "6xl" }} lineHeight="1.05" letterSpacing="-0.035em" m="0">
                {article.header || article.code}
              </Heading>
              {article.subheader ? (
                <Text color="bg.300" fontSize={{ base: "lg", md: "xl" }} lineHeight="1.65" maxW="720px">
                  {article.subheader}
                </Text>
              ) : null}
            </VStack>

            {machines.length ? (
              <Box bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.100" borderRadius="2xl" p={{ base: "4", md: "5" }} backdropFilter="blur(12px)">
                <Text color="acid.300" fontSize="xs" fontWeight="900" textTransform="uppercase" letterSpacing="0.15em" mb="4">
                  This guide applies to
                </Text>
                <VStack spacing="3" align="stretch">
                  {machines.map((machineType) => <MachineTypeCard key={machineType.id} machineType={machineType} />)}
                </VStack>
              </Box>
            ) : null}
          </SimpleGrid>

          <Box
            as="article"
            w="full"
            bg={panelBg}
            border="1px solid"
            borderColor={borderColor}
            borderRadius={{ base: "2xl", md: "3xl" }}
            px={{ base: "5", sm: "7", md: "14" }}
            py={{ base: "8", md: "14" }}
            boxShadow="0 30px 100px rgba(0, 0, 0, 0.25)"
          >
            {article.article ? (
              <ArticleMarkdown markdown={article.article} />
            ) : (
              <Text color="bg.300">This article does not have any content yet.</Text>
            )}
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
