import { Box, SimpleGrid, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { getSmallestMediaUrl } from "../../../lib/portal/media";
import { getContainerMaxAmountKg } from "../../../lib/portal/containerSlots";
import type { PortalMachineCell } from "../../../types/portal";
import {
  CONTAINER_WIDTH,
  MAX_POWDER_HEIGHT,
  PowderContainer,
} from "./PowderContainer";

export type ContainersPreviewProps = {
  containerCount: number;
  cells: PortalMachineCell[];
  onAmountChange: (position: number, amountKg: number) => void;
};

const productColor = (cell?: PortalMachineCell) => {
  return (
    cell?.product?.custom_circle?.color?.trim() ||
    cell?.product?.taste?.default_circle?.color?.trim()
  );
};

export function ContainersPreview({
  containerCount,
  cells,
  onAmountChange,
}: ContainersPreviewProps) {
  const maxWeightKg = getContainerMaxAmountKg(containerCount);
  const cellsByPosition = useMemo(
    () => new Map(cells.map((cell) => [cell.position, cell])),
    [cells],
  );
  const [powderHeights, setPowderHeights] = useState<number[]>([]);

  useEffect(() => {
    setPowderHeights(
      Array.from({ length: containerCount }, (_, index) => {
        const amountKg = Math.min(
          maxWeightKg,
          Math.max(0, Number(cellsByPosition.get(index + 1)?.amount_kg) || 0),
        );
        return (amountKg / maxWeightKg) * MAX_POWDER_HEIGHT;
      }),
    );
  }, [cellsByPosition, containerCount, maxWeightKg]);

  const setPowderHeight = (index: number, height: number) => {
    setPowderHeights((current) => {
      const next = [...current];
      next[index] = height;
      return next;
    });
  };

  return (
    <Box>
      <Box w="full" pb="2">
        <SimpleGrid
          columns={{ base: 4, md: containerCount }}
          spacing={{ base: "2", md: "3" }}
          alignItems="start"
          justifyItems="center"
          w="full"
        >
          {Array.from({ length: containerCount }, (_, index) => {
            const position = index + 1;
            const cell = cellsByPosition.get(position);
            const hasProduct = Boolean(cell?.product);

            return (
              <Box key={position} w="full" maxW={`${CONTAINER_WIDTH}px`}>
                <PowderContainer
                  color={productColor(cell)}
                  height={powderHeights[index] ?? 0}
                  maxWeightKg={maxWeightKg}
                  containerNumber={position}
                  productName={cell?.product?.name}
                  productImageUrl={getSmallestMediaUrl(
                    cell?.product?.custom_main || cell?.product?.taste?.main,
                  )}
                  cupImageUrl={getSmallestMediaUrl(
                    cell?.product?.cup?.image ||
                      cell?.product?.product_line?.cups?.[0]?.image,
                  )}
                  cupCount={cell?.product ? 1 : 0}
                  isDisabled={!hasProduct}
                  onHeightChange={(height) => setPowderHeight(index, height)}
                  onHeightChangeEnd={(height) =>
                    onAmountChange(
                      position,
                      Number(
                        ((height / MAX_POWDER_HEIGHT) * maxWeightKg).toFixed(2),
                      ),
                    )
                  }
                />
              </Box>
            );
          })}
        </SimpleGrid>
      </Box>
    </Box>
  );
}
