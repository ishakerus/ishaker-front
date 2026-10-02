import {
  Badge,
  Box,
  Divider,
  Flex,
  HStack,
  IconButton,
  Image,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { type KeyboardEvent, type MouseEvent, useState } from "react";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import { capitalizeName } from "../../../lib/formatName";
import { getSmallestMediaUrl } from "../../../lib/portal/media";
import type { PortalCup, PortalProduct } from "../../../types/portal";
import { DeleteProductDialog } from "./DeleteProductDialog";
import { Box3D } from "../../../styles/theme/custom";
import { useCustomDialog } from "../../shared/CustomDialog";

type ProductCardProps = {
  product: PortalProduct;
  productLineId: string | number;
  defaultCup?: PortalCup;
};

export function ProductCard({
  product,
  productLineId,
  defaultCup,
}: ProductCardProps) {
  const router = useRouter();
  const { showAlert } = useCustomDialog();
  const deleteDialog = useDisclosure();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isActive, setIsActive] = useState(product.isActive !== false);
  const [isUpdatingActive, setIsUpdatingActive] = useState(false);
  const main = product.custom_main || product.taste?.main;
  const mainImage = getSmallestMediaUrl(main);
  const productName = capitalizeName(product.name);
  const brandName = capitalizeName(product.brand?.name);
  const brandImage = getSmallestMediaUrl(product.brand?.logo);
  const displayCup = product.cup || defaultCup;
  const cupImage = getSmallestMediaUrl(displayCup?.image);
  const splash =
    product.custom_splash ||
    product.taste?.default_splash ||
    displayCup?.default_splash;
  const finalSplashImage = getSmallestMediaUrl(
    [...(splash?.images || [])]
      .sort((left, right) =>
        (left.name || left.url || "").localeCompare(
          right.name || right.url || "",
          undefined,
          { numeric: true, sensitivity: "base" },
        ),
      )
      .at(-1),
  );
  const mixTargetNames = (product.can_be_added_to || []).map((target) =>
    capitalizeName(target.name),
  );

  const updateActiveState = async (nextIsActive: boolean) => {
    const previousIsActive = isActive;
    setIsActive(nextIsActive);
    setIsUpdatingActive(true);
    try {
      const response = await fetch(
        `/api/portal/product-lines/${productLineId}/products/${product.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: nextIsActive }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload?.message || "Product status could not be updated.",
        );
      }
    } catch (error) {
      setIsActive(previousIsActive);
      await showAlert({
        title: "Update failed",
        message:
          error instanceof Error
            ? error.message
            : "Product status could not be updated.",
        tone: "danger",
      });
    } finally {
      setIsUpdatingActive(false);
    }
  };

  const deleteProduct = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/portal/product-lines/${productLineId}/products/${product.id}`,
        { method: "DELETE" },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || "Product could not be deleted.");
      }
      deleteDialog.onClose();
      router.reload();
    } catch (error) {
      await showAlert({
        title: "Delete failed",
        message:
          error instanceof Error
            ? error.message
            : "Product could not be deleted.",
        tone: "danger",
      });
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Box3D
        position="relative"
        minW="0"
        minH="230px"
        p="4"
        cursor="pointer"
        opacity={isActive ? 1 : 0.8}
        role="link"
        tabIndex={0}
        w="full"
        transition="background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease, opacity 0.2s ease"
        onClick={(event: MouseEvent<HTMLDivElement>) => {
          event.stopPropagation();
          void router.push(
            `/product-lines/${productLineId}/products/new?productId=${product.id}`,
          );
        }}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          if (
            event.currentTarget === event.target &&
            (event.key === "Enter" || event.key === " ")
          ) {
            event.preventDefault();
            event.stopPropagation();
            void router.push(
              `/product-lines/${productLineId}/products/new?productId=${product.id}`,
            );
          }
        }}
      >
        <Flex h="200px" my="3" w="full" align="stretch" gap="3">
          <Flex direction="column" flex="1 1 0" minW="0" h="200px">
            <Flex
              position="relative"
              h="100px"
              align="center"
              justify="center"
              borderBottom="1px solid"
              borderColor="whiteAlpha.100"
              borderTopRadius="xl"
              p="2"
            >
              <Text
                position="absolute"
                top="2"
                left="2"
                color="whiteAlpha.400"
                fontSize="8px"
                letterSpacing=".08em"
              >
                BRAND
              </Text>
              {brandImage ? (
                <Image
                  src={brandImage}
                  alt={`${brandName} logo`}
                  maxW="full"
                  maxH="72px"
                  objectFit="contain"
                />
              ) : (
                <Text color="whiteAlpha.400" fontSize="xs">
                  No brand logo
                </Text>
              )}
            </Flex>
            <Flex
              position="relative"
              h="100px"
              align="center"
              justify="center"
              borderBottomRadius="xl"
              p="2"
            >
              <Text
                position="absolute"
                top="2"
                left="2"
                color="whiteAlpha.400"
                fontSize="8px"
                letterSpacing=".08em"
              >
                TASTE
              </Text>
              {mainImage ? (
                <Image
                  src={mainImage}
                  alt={`${productName} taste`}
                  maxW="full"
                  maxH="78px"
                  objectFit="contain"
                />
              ) : (
                <Text color="whiteAlpha.400" fontSize="xs">
                  No taste image
                </Text>
              )}
            </Flex>
          </Flex>
          <Divider orientation="vertical" />
          <Box
            aria-label={`${productName} cup with final splash frame`}
            role="img"
            flex="1 1 0"
            minW="0"
            h="200px"
            borderRadius="xl"
            position="relative"
            display="flex"
            alignItems="center"
            justifyContent="center"
            p="3"
          >
            <Text
              position="absolute"
              zIndex="4"
              top="2"
              left="2"
              color="whiteAlpha.400"
              fontSize="8px"
              letterSpacing=".08em"
            >
              CUP
            </Text>
            <Box
              position="relative"
              h="full"
              w="auto"
              maxW="full"
              sx={{ aspectRatio: "3 / 4" }}
            >
              {finalSplashImage ? (
                <Image
                  src={finalSplashImage}
                  alt=""
                  aria-hidden="true"
                  position="absolute"
                  zIndex="3"
                  left="0"
                  bottom="62.5%"
                  w="full"
                  h="75%"
                  objectFit="contain"
                  pointerEvents="none"
                />
              ) : null}
              {cupImage ? (
                <Image
                  src={cupImage}
                  alt={displayCup?.name || `${productName} cup`}
                  position="absolute"
                  zIndex="2"
                  left="0"
                  bottom="0"
                  w="full"
                  h="75%"
                  objectFit="contain"
                  filter="drop-shadow(0 14px 18px rgba(0,0,0,.35))"
                />
              ) : (
                <Flex h="full" align="center" justify="center">
                  <Text color="whiteAlpha.400" fontSize="xs">
                    No cup
                  </Text>
                </Flex>
              )}
            </Box>
          </Box>
        </Flex>
        <HStack justify="space-between" align="flex-start" gap="3">
          <Box minW="0">
            <HStack spacing="2">
              <Text color="white" fontSize="md" fontWeight="750" noOfLines={1}>
                {`${productName} | ${brandName || "No brand"}`}
              </Text>
              {product.is_dependent ? (
                <Badge colorScheme="purple" flexShrink={0}>
                  Add-on
                </Badge>
              ) : null}
            </HStack>
            {mixTargetNames.length ? (
              <Text color="bg.300" fontSize="sm" mt="1" noOfLines={1}>
                Goes into: {mixTargetNames.slice(0, 3).join(", ")}
                {mixTargetNames.length > 3
                  ? ` +${mixTargetNames.length - 3}`
                  : ""}
              </Text>
            ) : null}
          </Box>
          <Box onClick={(event) => event.stopPropagation()}>
            <IconButton
              aria-label={`Edit ${productName}`}
              icon={<FiEdit2 />}
              variant="ghost"
              size="sm"
              color="whiteAlpha.700"
              onClick={() =>
                void router.push(
                  `/product-lines/${productLineId}/products/new?productId=${product.id}`,
                )
              }
            />
            <IconButton
              aria-label={`Delete ${productName}`}
              icon={<FiTrash2 />}
              variant="ghost"
              size="sm"
              color="whiteAlpha.700"
              isLoading={isDeleting}
              _hover={{ color: "red.300", bg: "whiteAlpha.100" }}
              onClick={deleteDialog.onOpen}
            />
          </Box>
        </HStack>
      </Box3D>
      <DeleteProductDialog
        isDeleting={isDeleting}
        isOpen={deleteDialog.isOpen}
        onClose={deleteDialog.onClose}
        onConfirm={deleteProduct}
        productName={productName}
      />
    </>
  );
}
