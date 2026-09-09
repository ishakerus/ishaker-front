import { Box, HStack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { Box3D } from "../../styles/theme/custom";

type MachineInfoTileProps = {
  title: string;
  value: ReactNode;
  color: string;
  icon: ReactNode;
  ariaLabel?: string;
  cursor?: "pointer" | "copy";
  href?: string;
  isDisabled?: boolean;
  onClick?: () => void;
};

export function MachineInfoTile({
  title,
  value,
  color,
  icon,
  ariaLabel,
  cursor = "pointer",
  href,
  isDisabled = false,
  onClick,
}: MachineInfoTileProps) {
  const interactive = Boolean(href || onClick) && !isDisabled;

  return (
    <Box3D
      variant="contrast"
      as={href ? "a" : onClick ? "button" : "div"}
      {...(href ? { href } : {})}
      {...(onClick ? { type: "button", onClick, disabled: isDisabled } : {})}
      p="3"
      minW="0"
      textAlign="left"
      cursor={isDisabled ? "not-allowed" : interactive ? cursor : "default"}
      opacity={isDisabled ? 0.55 : 1}
      aria-label={ariaLabel}
      _hover={
        interactive ? { bg: "whiteAlpha.100", textDecoration: "none" } : {}
      }
      _focusVisible={
        interactive ? { outline: "2px solid", outlineColor: "acid.300" } : {}
      }
    >
      <HStack color="bg.500" fontSize="xs" mb="1" justify="space-between">
        <Text>{title}</Text>
        <Box aria-hidden>{icon}</Box>
      </HStack>
      {typeof value === "string" ? (
        <Text color={color} fontFamily="mono" fontSize="sm" noOfLines={1}>
          {value}
        </Text>
      ) : (
        <Box color={color} minW="0">
          {value}
        </Box>
      )}
    </Box3D>
  );
}
