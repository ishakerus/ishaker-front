import {
  Alert,
  AlertIcon,
  Box,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useState } from "react";
import type { Machine } from "../../../types/strapi";
import { MachineSettingToggleHeader } from "../../machines/MachineSettingToggleHeader";

export function MachineProductLineGrouping({ machine }: { machine: Machine }) {
  const toast = useToast();
  const [enabled, setEnabled] = useState(machine.wrap_productline === true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const update = async (nextEnabled: boolean) => {
    const previousEnabled = enabled;
    setEnabled(nextEnabled);
    setIsSaving(true);
    setError("");

    try {
      const response = await fetch(
        `/api/portal/machines/${encodeURIComponent(machine.id)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ wrap_productline: nextEnabled }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload?.message || "Product-line grouping could not be updated.",
        );
      }

      setEnabled(payload?.machine?.wrap_productline === true);
      toast({
        title: `Product-line grouping turned ${nextEnabled ? "on" : "off"}`,
        status: "success",
      });
    } catch (updateError) {
      setEnabled(previousEnabled);
      const message =
        updateError instanceof Error
          ? updateError.message
          : "Product-line grouping could not be updated.";
      setError(message);
      toast({ title: "Update failed", description: message, status: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box
      bg="bg.900"
      border="1px solid"
      borderColor="whiteAlpha.100"
      borderRadius="2xl"
      p={{ base: "5", md: "6" }}
    >
      <VStack align="stretch" spacing="4">
        <MachineSettingToggleHeader
          title="Group products by product line"
          switchLabel="Group products by product line"
          switchId="wrap-productline"
          isChecked={enabled}
          isDisabled={isSaving}
          onChange={(isChecked) => void update(isChecked)}
          articleHref="/articles/group-products-by-product-line"
          articleLabel="Learn about grouping products by product line"
        />
        <Text color="bg.300" fontSize="sm">
          On the machine&apos;s first screen, each cup represents a product line
          instead of a single product. For example, Whey Protein can appear as
          one cup containing Banana and Coconut products, even when they are
          from different brands.
        </Text>
        {error ? (
          <Alert status="error" borderRadius="lg">
            <AlertIcon />
            {error}
          </Alert>
        ) : null}
        <Text color="bg.300" fontSize="sm">
          Changes apply to the kiosk within 5 minutes. No restart needed.
        </Text>
      </VStack>
    </Box>
  );
}
