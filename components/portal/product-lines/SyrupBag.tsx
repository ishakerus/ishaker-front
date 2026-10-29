import { Box, Image, Text, Tooltip, VStack } from "@chakra-ui/react";
import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { resolvePowderColor } from "./PowderContainer";

export function SyrupBag({
  position,
  amountLitres,
  capacityLitres,
  color,
  productName,
  productImageUrl,
  isDisabled,
  onAmountChange,
}: {
  position: number;
  amountLitres: number;
  capacityLitres: number;
  color?: string | null;
  productName?: string;
  productImageUrl?: string;
  isDisabled?: boolean;
  onAmountChange: (litres: number) => void;
}) {
  const [dragAmount, setDragAmount] = useState<number | null>(null);
  const amount = Math.min(
    capacityLitres,
    Math.max(0, dragAmount ?? amountLitres),
  );
  const commit = (next: number) => onAmountChange(Number(next.toFixed(6)));
  const fromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return (
      Math.max(
        0,
        Math.min(1, (bounds.bottom - event.clientY) / bounds.height),
      ) * capacityLitres
    );
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let next: number;
    if (["ArrowUp", "ArrowRight"].includes(event.key))
      next = Math.min(capacityLitres, amount + capacityLitres / 100);
    else if (["ArrowDown", "ArrowLeft"].includes(event.key))
      next = Math.max(0, amount - capacityLitres / 100);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = capacityLitres;
    else return;
    event.preventDefault();
    commit(next);
  };

  return (
    <VStack w="full" spacing="2" justify="flex-end" h="full">
      <Tooltip
        label={
          isDisabled
            ? "Empty syrup slot"
            : `${productName} · ${Math.round(amount * 1000)} ml`
        }
        hasArrow
      >
        <Box
          position="relative"
          w="200px"
          maxW="full"
          aspectRatio="385 / 637"
          flexShrink={0}
          opacity={isDisabled ? 0.45 : 1}
        >
          {/* The coloured rectangle has intrinsic dimensions 300 × 550. */}
          <Box
            position="absolute"
            left="11%"
            top="6%"
            w="77.922%"
            h="86.342%"
            bg="whiteAlpha.100"
            overflow="hidden"
          >
            <Box
              position="absolute"
              bottom="0"
              w="full"
              h={`${isDisabled ? 0 : (amount / capacityLitres) * 100}%`}
              bg={resolvePowderColor(color)}
            />
          </Box>
          <Image
            src="/syrop_bag.png"
            alt=""
            aria-hidden
            position="absolute"
            inset="0"
            w="full"
            h="full"
            pointerEvents="none"
            draggable={false}
          />
          <Text
            position="absolute"
            top="17%"
            w="full"
            textAlign="center"
            fontWeight="800"
            color="gray.800"
            pointerEvents="none"
          >
            {position}
          </Text>
          {productImageUrl ? (
            <Image
              src={productImageUrl}
              alt=""
              position="absolute"
              left="25%"
              top="26%"
              w="50%"
              h="30%"
              objectFit="contain"
              pointerEvents="none"
              draggable={false}
            />
          ) : null}
          <Box
            position="absolute"
            left="11%"
            top="6%"
            w="77.922%"
            h="86.342%"
            role="slider"
            tabIndex={isDisabled ? -1 : 0}
            aria-disabled={isDisabled}
            aria-label={`Syrup volume in container ${position}`}
            aria-valuemin={0}
            aria-valuemax={capacityLitres * 1000}
            aria-valuenow={Math.round(amount * 1000)}
            aria-valuetext={`${Math.round(amount * 1000)} millilitres`}
            cursor={isDisabled ? "not-allowed" : "ns-resize"}
            sx={{ touchAction: "none" }}
            _focusVisible={{ outline: "2px solid", outlineColor: "blue.300" }}
            onPointerDown={(event) => {
              if (isDisabled) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragAmount(fromPointer(event));
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                setDragAmount(fromPointer(event));
            }}
            onPointerUp={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId))
                return;
              commit(fromPointer(event));
              setDragAmount(null);
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={(event) => {
              setDragAmount(null);
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onKeyDown={isDisabled ? undefined : onKeyDown}
          />
        </Box>
      </Tooltip>
      <Text fontSize="sm" fontWeight="700">
        {Number(amount.toFixed(3))} / {Number(capacityLitres.toFixed(3))} L
      </Text>
      <Text color="bg.300" fontSize="xs" textAlign="center" noOfLines={2}>
        {productName || "Empty"}
      </Text>
    </VStack>
  );
}
