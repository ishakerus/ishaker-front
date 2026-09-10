import {
  Button,
  HStack,
  NumberInput,
  NumberInputField,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useState } from "react";
import type { Machine } from "../../../types/strapi";

export function CupsDialogContent({
  machine,
  onSaved,
}: {
  machine: Machine;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [amount, setAmount] = useState(Number(machine.cups_amount) || 0);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch(
        `/api/portal/machines/${machine.id}/inventory`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cupsAmount: amount }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(payload?.message || "Cup amount could not be saved.");
      toast({ title: "Cup amount saved", status: "success", duration: 2500 });
      onSaved();
    } catch (error) {
      toast({
        title: "Could not save cup amount",
        description: (error as Error).message,
        status: "error",
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <VStack spacing="5" align="stretch">
      <Text color="bg.300">
        Enter the number of cups currently loaded in the machine.
      </Text>
      <HStack spacing="3" align="stretch">
        <NumberInput
          min={0}
          max={10000}
          precision={0}
          value={amount}
          flex="1"
          minW="0"
          onChange={(_, value) =>
            setAmount(Number.isFinite(value) ? value : 0)
          }
        >
          <NumberInputField
            aria-label="Number of cups"
            bg="bg.800"
            h="full"
          />
        </NumberInput>
        <Button
          variant="primary"
          onClick={() => void save()}
          isLoading={saving}
          flex="0 0 auto"
        >
          Save cups
        </Button>
      </HStack>
    </VStack>
  );
}
