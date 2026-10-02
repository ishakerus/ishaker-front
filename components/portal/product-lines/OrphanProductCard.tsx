import {
  Box,
  Button,
  HStack,
  Image,
  Select,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useState } from "react";
import { capitalizeName } from "../../../lib/formatName";
import { getSmallestMediaUrl } from "../../../lib/portal/media";
import type { PortalProduct, PortalProductLine } from "../../../types/portal";
import { useCustomDialog } from "../../shared/CustomDialog";

export function OrphanProductCard({
  product,
  productLines,
}: {
  product: PortalProduct;
  productLines: PortalProductLine[];
}) {
  const router = useRouter();
  const { showAlert, showConfirm } = useCustomDialog();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const [productLineId, setProductLineId] = useState("");
  const image = getSmallestMediaUrl(product.custom_main || product.taste?.main);

  const deleteProduct = async () => {
    const confirmed = await showConfirm({
      title: "Delete orphan product?",
      message: `Delete orphan product “${product.name}”? This action cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!confirmed) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/portal/products/${product.id}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || "Product could not be deleted.");
      }
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

  const attachProduct = async () => {
    if (!productLineId) return;
    setIsAttaching(true);
    try {
      const response = await fetch(`/api/portal/products/${product.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productLineId }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || "Product could not be attached.");
      }
      router.reload();
    } catch (error) {
      await showAlert({
        title: "Attach failed",
        message:
          error instanceof Error
            ? error.message
            : "Product could not be attached.",
        tone: "danger",
      });
      setIsAttaching(false);
    }
  };

  return (
    <Box bg="bg.800" borderRadius="xl" border="1px solid" borderColor="orange.700" p="4">
      <HStack spacing="4">
        <Box boxSize="80px" flex="0 0 auto">
          {image ? (
            <Image src={image} alt="" h="full" w="full" objectFit="contain" />
          ) : null}
        </Box>
        <VStack align="stretch" spacing="1" flex="1" minW="0">
          <Text fontWeight="700" noOfLines={2}>
            {capitalizeName(product.name)}
          </Text>
          <Text color="bg.300" fontSize="sm">
            ID {product.id} · {capitalizeName(product.brand?.name) || "No brand"}
          </Text>
          <HStack>
            <Select
              size="sm"
              value={productLineId}
              placeholder="Attach to product line"
              onChange={(event) => setProductLineId(event.target.value)}
            >
              {productLines.map((productLine) => (
                <option key={productLine.id} value={productLine.id}>
                  {capitalizeName(productLine.name)}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              isDisabled={!productLineId}
              isLoading={isAttaching}
              onClick={() => void attachProduct()}
            >
              Attach
            </Button>
          </HStack>
          <Button
            colorScheme="red"
            variant="outline"
            size="sm"
            alignSelf="start"
            isLoading={isDeleting}
            onClick={() => void deleteProduct()}
          >
            Delete orphan
          </Button>
        </VStack>
      </HStack>
    </Box>
  );
}
