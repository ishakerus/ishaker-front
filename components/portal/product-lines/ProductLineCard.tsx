import {
  Box,
  Button,
  HStack,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Portal,
  SimpleGrid,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import {
  FiEdit2,
  FiMoreVertical,
  FiPlus,
  FiPower,
  FiTrash2,
} from "react-icons/fi";
import { capitalizeName } from "../../../lib/formatName";
import type { PortalProductLine } from "../../../types/portal";
import { DeleteProductLineDialog } from "./DeleteProductLineDialog";
import { getProductLineIcon } from "./NewProductLinePage";
import { ProductCard } from "./ProductCard";
import { Box3D } from "../../../styles/theme/custom";
import { IoMdAdd } from "react-icons/io";
import { useCustomDialog } from "../../shared/CustomDialog";

type ProductLineCardProps = {
  productLine: PortalProductLine;
  onAddProduct: () => void;
};

export function ProductLineCard({
  productLine,
  onAddProduct,
}: ProductLineCardProps) {
  const router = useRouter();
  const { showAlert } = useCustomDialog();
  const deleteDialog = useDisclosure();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isActive, setIsActive] = useState(productLine.isActive !== false);
  const [isUpdatingActive, setIsUpdatingActive] = useState(false);
  const productLineName = capitalizeName(productLine.name);
  const productCount = productLine.products?.length || 0;
  const brandCount = new Set(
    (productLine.products || [])
      .map((product) => product.brand?.id)
      .filter(Boolean)
      .map(String),
  ).size;

  const updateActiveState = async (nextIsActive: boolean) => {
    const previousIsActive = isActive;
    setIsActive(nextIsActive);
    setIsUpdatingActive(true);
    try {
      const response = await fetch(
        `/api/portal/product-lines/${productLine.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: nextIsActive }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload?.message || "Product line status could not be updated.",
        );
      }
    } catch (error) {
      setIsActive(previousIsActive);
      await showAlert({
        title: "Update failed",
        message:
          error instanceof Error
            ? error.message
            : "Product line status could not be updated.",
        tone: "danger",
      });
    } finally {
      setIsUpdatingActive(false);
    }
  };

  const deleteProductLine = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/portal/product-lines/${productLine.id}`,
        {
          method: "DELETE",
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload?.message || "Product line could not be deleted.",
        );
      }
      deleteDialog.onClose();
      router.reload();
    } catch (error) {
      await showAlert({
        title: "Delete failed",
        message:
          error instanceof Error
            ? error.message
            : "Product line could not be deleted.",
        tone: "danger",
      });
      setIsDeleting(false);
    }
  };
  const isFull = productCount > 0 && productCount % 3 === 0;
  return (
    <>
      <Box3D
        overflow="hidden"
        variant="contrast"
        my="4"
        opacity={isActive ? 1 : 0.8}
        position="relative"
        transition="opacity 0.2s ease"
      >
        <HStack
          minH="48px"
          px={{ base: "4", md: "5" }}
          justify="space-between"
          borderBottom="1px solid"
          borderColor="rgba(255,255,255,0.09)"
        >
          <HStack spacing="3">
            <Box
              display="grid"
              placeItems="center"
              boxSize="34px"
              flexShrink="0"
              borderRadius="md"
              bg="whiteAlpha.100"
              color={isActive ? "acid.300" : "whiteAlpha.400"}
              fontSize="lg"
            >
              {getProductLineIcon(productLine.name)}
            </Box>
            <Text
              color="white"
              fontWeight="700"
              fontSize="md"
            >{`${productLineName} (${productCount})`}</Text>
            {productCount ? (
              <Text color="whiteAlpha.500" fontSize="xs">
                {brandCount} {brandCount === 1 ? "brand" : "brands"}
              </Text>
            ) : null}
          </HStack>
          <HStack spacing="4">
            <Menu placement="bottom-end">
              <MenuButton
                as={IconButton}
                aria-label={`Actions for ${productLineName}`}
                icon={<FiMoreVertical />}
                variant="ghost"
                size="sm"
                color="whiteAlpha.800"
              />
              <Portal>
                <MenuList
                  bg="#171b1c"
                  borderColor="whiteAlpha.200"
                  minW="190px"
                >
                  <MenuItem
                    as={Link}
                    href={`/product-lines/${productLine.id}/edit`}
                    icon={<FiEdit2 />}
                    bg="transparent"
                    _hover={{ bg: "whiteAlpha.100" }}
                  >
                    Edit product line
                  </MenuItem>
                  <MenuItem
                    icon={<FiPower />}
                    bg="transparent"
                    _hover={{ bg: "whiteAlpha.100" }}
                    isDisabled={isUpdatingActive}
                    onClick={() => void updateActiveState(!isActive)}
                  >
                    {isActive ? "Set inactive" : "Set active"}
                  </MenuItem>
                  <MenuItem
                    icon={<FiTrash2 />}
                    bg="transparent"
                    color="red.300"
                    _hover={{ bg: "whiteAlpha.100" }}
                    onClick={deleteDialog.onOpen}
                  >
                    Delete product line
                  </MenuItem>
                </MenuList>
              </Portal>
            </Menu>
          </HStack>
        </HStack>
        <Box p={{ base: "3", md: "4" }}>
          {productLine.products?.length ? (
            <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing="4">
              {productLine.products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  productLineId={productLine.id}
                  defaultCup={productLine.cups?.[0]}
                />
              ))}
              {!isFull && (
                <Box3D
                  w="100%"
                  display={{ base: "none", xl: "flex" }}
                  justifyContent="center"
                  alignItems="center"
                  p="20"
                >
                  <Box
                    minH="100px"
                    as="button"
                    type="button"
                    aria-label="Add product"
                    borderWidth="2px"
                    borderStyle="dashed"
                    borderColor="bg.500"
                    borderRadius="xl"
                    w="full"
                    h="full"
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    onClick={onAddProduct}
                    _hover={{
                      bg: "rgba(101,223,92,.07)",
                      borderColor: "#65df5c",
                      cursor: "pointer",
                    }}
                    color="#65df5c"
                  >
                    <IoMdAdd size="1.5rem" />
                  </Box>
                </Box3D>
              )}
            </SimpleGrid>
          ) : null}
          <Button
            display={{
              base: "flex",
              xl: isFull || productCount === 0 ? "flex" : "none",
            }}
            onClick={onAddProduct}
            variant="ghost"
            w="full"
            h="52px"
            mt={productCount ? "4" : "0"}
            border="2px dashed"
            borderColor="whiteAlpha.500"
            borderRadius="xl"
            color="#65df5c"
            fontSize="sm"
            fontWeight="700"
            leftIcon={<FiPlus />}
            _hover={{ bg: "rgba(101,223,92,.07)", borderColor: "#65df5c" }}
          >
            Add product
          </Button>
        </Box>
      </Box3D>
      <DeleteProductLineDialog
        isDeleting={isDeleting}
        isOpen={deleteDialog.isOpen}
        onClose={deleteDialog.onClose}
        onConfirm={deleteProductLine}
        productLineName={productLineName}
      />
    </>
  );
}
