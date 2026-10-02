import {
  Alert,
  AlertIcon,
  Button,
  HStack,
  Skeleton,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getMachineContainerCount } from "../../../lib/portal/containerSlots";
import type { PortalMachineCell } from "../../../types/portal";
import type { Machine } from "../../../types/strapi";
import { ContainersPreview } from "../product-lines/ContainersPreview";

export function PowdersDialogContent({
  machine,
  initialCells,
  onSaved,
  onClose,
}: {
  machine: Machine;
  initialCells?: PortalMachineCell[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [cells, setCells] = useState<PortalMachineCell[]>(initialCells || []);
  const [initialAmounts, setInitialAmounts] = useState<Record<string, number>>(
    () =>
      Object.fromEntries(
        (initialCells || []).map((cell) => [
          String(cell.id),
          Number(cell.amount_kg) || 0,
        ]),
      ),
  );
  const [loading, setLoading] = useState(initialCells === undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const containerCount = getMachineContainerCount(machine.machine_type);

  useEffect(() => {
    if (initialCells !== undefined) {
      setCells(initialCells);
      setInitialAmounts(
        Object.fromEntries(
          initialCells.map((cell) => [
            String(cell.id),
            Number(cell.amount_kg) || 0,
          ]),
        ),
      );
      setError("");
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError("");
    void fetch(`/api/portal/machines/${machine.id}/cells`)
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok)
          throw new Error(
            payload?.message || "Containers could not be loaded.",
          );
        if (active) {
          const loadedCells: PortalMachineCell[] = Array.isArray(payload)
            ? payload
            : payload?.cells || [];
          setCells(loadedCells);
          setInitialAmounts(
            Object.fromEntries(
              loadedCells.map((cell) => [
                String(cell.id),
                Number(cell.amount_kg) || 0,
              ]),
            ),
          );
        }
      })
      .catch((reason) => active && setError((reason as Error).message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [initialCells, machine.id]);

  const visibleCells = useMemo(
    () => cells.filter((cell) => cell.product),
    [cells],
  );
  const hasChanges = visibleCells.some(
    (cell) => (Number(cell.amount_kg) || 0) !== initialAmounts[String(cell.id)],
  );
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/portal/machines/${machine.id}/cells`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assignments: cells.map((cell) => ({
            cellId: Number(cell.id),
            position: cell.position,
            productId: cell.product ? Number(cell.product.id) : null,
            isActive: cell.isActive,
            cellCategory: cell.cell_category || "powder",
            amountKg: Number(cell.amount_kg) || 0,
          })),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          payload?.message || "Powder amounts could not be saved.",
        );
      setCells(Array.isArray(payload) ? payload : payload?.cells || []);
      toast({
        title: "Powder amounts saved",
        status: "success",
        duration: 2500,
      });
      onSaved();
      onClose();
    } catch (reason) {
      const message = (reason as Error).message;
      setError(message);
      toast({
        title: "Could not save powder amounts",
        description: message,
        status: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton h="260px" borderRadius="lg" />;
  if (containerCount === null)
    return (
      <Alert status="error">
        <AlertIcon />
        This machine type has no container count.
      </Alert>
    );

  return (
    <VStack spacing="5" align="stretch">
      <Text color="bg.300">
        Drag each loaded container to its current powder level.
      </Text>
      {error ? (
        <Alert status="error">
          <AlertIcon />
          {error}
        </Alert>
      ) : null}
      {visibleCells.length ? (
        <ContainersPreview
          containerCount={containerCount}
          cells={cells}
          onAmountChange={(position, amountKg) =>
            setCells((current) =>
              current.map((cell) =>
                cell.position === position
                  ? { ...cell, amount_kg: amountKg }
                  : cell,
              ),
            )
          }
        />
      ) : (
        <Text color="bg.400">
          No products are assigned to this machine yet.
        </Text>
      )}
      <HStack spacing="3" align="stretch">
        <Button
          variant="primary"
          onClick={() => void save()}
          isLoading={saving}
          isDisabled={!visibleCells.length || !hasChanges}
        >
          Save powder
        </Button>
        <Button
          as={Link}
          href={`/product-lines/machines/${machine.id}`}
          variant="contrast"
        >
          Edit products
        </Button>
      </HStack>
    </VStack>
  );
}
