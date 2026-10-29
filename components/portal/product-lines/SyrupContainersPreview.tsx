import { SimpleGrid } from "@chakra-ui/react";
import { getSmallestMediaUrl } from "../../../lib/portal/media";
import { getSharedSyrupCapacity } from "../../../lib/portal/syrupVolume";
import type { PortalMachineCell } from "../../../types/portal";
import { SyrupBag } from "./SyrupBag";

export function SyrupContainersPreview({
  powderCount,
  syrupCount,
  cells,
  onAmountChange,
  capacityLitres,
}: {
  powderCount: number;
  syrupCount: number;
  cells: PortalMachineCell[];
  capacityLitres?: number;
  onAmountChange: (position: number, amountLitres: number) => void;
}) {
  const sharedCapacity =
    capacityLitres ?? getSharedSyrupCapacity(cells, powderCount);
  return (
    <SimpleGrid
      columns={Math.min(3, syrupCount)}
      spacing="4"
      alignItems="start"
      justifyItems="center"
    >
      {Array.from({ length: syrupCount }, (_, index) => {
        const position = powderCount + index + 1;
        const cell = cells.find((candidate) => candidate.position === position);
        return (
          <SyrupBag
            key={position}
            position={position}
            amountLitres={Number(cell?.amount_kg) || 0}
            capacityLitres={sharedCapacity}
            color={
              cell?.product?.custom_circle?.color ||
              cell?.product?.taste?.default_circle?.color
            }
            productName={cell?.product?.name}
            productImageUrl={getSmallestMediaUrl(
              cell?.product?.custom_main || cell?.product?.taste?.main,
            )}
            isDisabled={!cell?.product}
            onAmountChange={(amount) => onAmountChange(position, amount)}
          />
        );
      })}
    </SimpleGrid>
  );
}
