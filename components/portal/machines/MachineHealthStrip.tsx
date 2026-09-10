import {
  Badge,
  Box,
  HStack,
  Icon,
  SimpleGrid,
  Skeleton,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { IconType } from "react-icons";
import { Fragment, useState } from "react";
import { BiSolidInfoCircle } from "react-icons/bi";
import { CiCoffeeCup } from "react-icons/ci";
import { FaBoxOpen, FaChartLine, FaLock, FaTint, FaWifi } from "react-icons/fa";
import Link from "next/link";
import { formatMoney } from "../../../lib/portal/currency";
import type {
  HealthState,
  MachineHealthIndicator,
  MachineHealthRow,
} from "../../../types/machineHealth";
import type { Currency, Machine } from "../../../types/strapi";
import {
  MachineHealthDialog,
  type HealthDialogKind,
} from "../health/MachineHealthDialog";

type MachineHealthStripProps = {
  machine: Machine;
  health?: MachineHealthRow;
  salesToday?: {
    revenue: number;
    cups: number;
    currency?: Currency | null;
  };
  isSalesLoading?: boolean;
  isLoading?: boolean;
  onHealthChanged?: () => void;
};

const stateColor: Record<HealthState, string> = {
  ok: "green",
  warning: "yellow",
  low: "orange",
  error: "red",
  unknown: "gray",
};

const stateBackground: Record<HealthState, { base: string; hover: string }> = {
  ok: { base: "rgba(34, 197, 94, 0.14)", hover: "rgba(34, 197, 94, 0.22)" },
  warning: {
    base: "rgba(234, 179, 8, 0.14)",
    hover: "rgba(234, 179, 8, 0.22)",
  },
  low: { base: "rgba(249, 115, 22, 0.14)", hover: "rgba(249, 115, 22, 0.22)" },
  error: { base: "rgba(239, 68, 68, 0.14)", hover: "rgba(239, 68, 68, 0.22)" },
  unknown: {
    base: "rgba(148, 163, 184, 0.10)",
    hover: "rgba(148, 163, 184, 0.18)",
  },
};

const lastOnlineLabel = (at?: string | null) => {
  if (!at) return "Last online unavailable";
  const timestamp = Date.parse(at);
  if (Number.isNaN(timestamp)) return "Last online unavailable";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Last online just now";
  if (minutes < 60) return `Last online ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Last online ${hours}h ago`;
  const days = Math.round(hours / 24);
  return `Last online ${days}d ago`;
};

const HealthItem = ({
  title,
  icon,
  indicator,
  showLastOnline = false,
  onClick,
  powderLevels,
  levelPercent,
}: {
  title: string;
  icon: IconType;
  indicator: MachineHealthIndicator;
  showLastOnline?: boolean;
  onClick: () => void;
  powderLevels?: Array<number | null>;
  levelPercent?: number;
}) => {
  const color = stateColor[indicator.state];
  const background = stateBackground[indicator.state];
  const lastOnline = lastOnlineLabel(indicator.lastOnlineAt);

  return (
    <VStack
      as="button"
      type="button"
      align="start"
      onClick={onClick}
      aria-label={`Open ${title} details`}
      spacing="1"
      minW="0"
      py="2"
      px="1"
      borderRadius="lg"
      bg={background.base}
      cursor="pointer"
      textAlign="left"
      transition="background 140ms ease, transform 140ms ease"
      _hover={{ bg: background.hover, transform: "translateY(-1px)" }}
      _focusVisible={{ boxShadow: "outline" }}
    >
      <HStack spacing="1.5" minW="0" w="100%">
        <Box
          display="grid"
          placeItems="center"
          boxSize="7"
          px="1"
          flex="0 0 auto"
          borderRadius="full"
          bg={`${color}.800`}
          color={`${color}.200`}
          boxShadow={`0 0 0 1px var(--chakra-colors-${color}-700)`}
        >
          <Icon as={icon} boxSize="3.5" />
        </Box>
        <Box w="100%">
          <HStack
            w="100%"
            spacing="1"
            justifyContent="space-between"
            color={`${color}.300`}
          >
            <Text color="bg.400" fontSize="9px" lineHeight="1" noOfLines={1}>
              {title}
            </Text>
            <BiSolidInfoCircle size="1rem" />
          </HStack>
          {powderLevels?.length ? (
            <HStack
              spacing="2px"
              h="12px"
              align="end"
              aria-label={`Powder levels: ${powderLevels
                .map((level) =>
                  level === null ? "empty" : `${Math.round(level)}%`,
                )
                .join(", ")}`}
            >
              {powderLevels.map((level, index) => {
                const normalized =
                  level === null ? 0 : Math.max(0, Math.min(100, level));
                const fillColor =
                  normalized < 10
                    ? "red.400"
                    : normalized < 20
                      ? "orange.400"
                      : normalized < 40
                        ? "yellow.400"
                        : "green.400";
                const fillHeight =
                  normalized < 10
                    ? "1px"
                    : normalized < 20
                      ? "3px"
                      : `${Math.max(1, Math.round(normalized / 10))}px`;

                return (
                  <Box
                    key={index}
                    position="relative"
                    w="6px"
                    h="10px"
                    overflow="hidden"
                    borderRadius="1px"
                    bg="bg.500"
                  >
                    {level !== null && normalized > 0 ? (
                      <Box
                        position="absolute"
                        insetX="0"
                        bottom="0"
                        h={fillHeight}
                        bg={fillColor}
                      />
                    ) : null}
                  </Box>
                );
              })}
            </HStack>
          ) : levelPercent !== undefined ? (
            <HStack
              spacing="1.5"
              h="12px"
              aria-label={`${title} level: ${Math.round(levelPercent)}%`}
            >
              <Box
                position="relative"
                w="6px"
                h="10px"
                flex="0 0 auto"
                overflow="hidden"
                borderRadius="1px"
                bg="bg.500"
              >
                {levelPercent > 0 ? (
                  <Box
                    position="absolute"
                    insetX="0"
                    bottom="0"
                    h={`${Math.max(1, Math.round(levelPercent / 10))}px`}
                    bg={`${color}.400`}
                  />
                ) : null}
              </Box>
              <Text color="bg.50" fontSize="xs" fontWeight="700" noOfLines={1}>
                {indicator.label}
              </Text>
            </HStack>
          ) : (
            <Text color="bg.50" fontSize="xs" fontWeight="700" noOfLines={1}>
              {indicator.label}
            </Text>
          )}
        </Box>
      </HStack>

      {indicator.source !== "ops" && indicator.source !== "own" ? (
        <Badge colorScheme={color} fontSize="8px" lineHeight="14px">
          {indicator.source}
        </Badge>
      ) : null}
    </VStack>
  );
};

const noData: MachineHealthIndicator = {
  state: "unknown",
  label: "No data",
  source: "none",
};

const TodaySalesItem = ({
  machineId,
  sales,
  isLoading,
}: {
  machineId: string | number;
  sales?: MachineHealthStripProps["salesToday"];
  isLoading: boolean;
}) => {
  const today = new Date();
  const date = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  if (isLoading) return <Skeleton h="58px" borderRadius="lg" />;

  return (
    <HStack
      as={Link}
      href={`/sales?machineId=${machineId}&from=${date}&to=${date}`}
      aria-label={`Open today's sales: ${sales?.cups ?? 0} cups sold`}
      spacing="1.5"
      minW="0"
      py="2"
      px="1"
      borderRadius="lg"
      bg="rgba(34, 197, 94, 0.14)"
      cursor="pointer"
      textAlign="left"
      transition="background 140ms ease, transform 140ms ease"
      _hover={{ bg: "rgba(34, 197, 94, 0.22)", transform: "translateY(-1px)" }}
      _focusVisible={{ boxShadow: "outline" }}
    >
      <Box
        display="grid"
        placeItems="center"
        boxSize="7"
        px="1"
        flex="0 0 auto"
        borderRadius="full"
        bg="green.800"
        color="green.200"
        boxShadow="0 0 0 1px var(--chakra-colors-green-700)"
      >
        <Icon as={FaChartLine} boxSize="3.5" />
      </Box>
      <Box minW="0">
        <Text color="bg.400" fontSize="9px" lineHeight="1" noOfLines={1}>
          Sales today
        </Text>
        <HStack spacing="1.5" mt="1" minW="0">
          <Text color="bg.50" fontSize="xs" fontWeight="700" noOfLines={1}>
            {sales ? formatMoney(sales.revenue, sales.currency) : "—"}
          </Text>
          <Text color="green.300" fontSize="10px" aria-hidden="true">
            •
          </Text>
          <Text color="bg.50" fontSize="xs" fontWeight="700" noOfLines={1}>
            {sales ? sales.cups : "—"} cups
          </Text>
        </HStack>
      </Box>
    </HStack>
  );
};

export function MachineHealthStrip({
  machine,
  health,
  salesToday,
  isSalesLoading = false,
  isLoading = false,
  onHealthChanged = () => undefined,
}: MachineHealthStripProps) {
  const [dialog, setDialog] = useState<HealthDialogKind | null>(null);
  if (isLoading) {
    return (
      <SimpleGrid columns={3} spacing="2" aria-label="Loading machine health">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} h="58px" borderRadius="lg" />
        ))}
      </SimpleGrid>
    );
  }

  const waterType = health?.waterType ?? machine.water_type;
  const rawWaterAmount =
    health?.waterAmountLiters ?? machine.water_amount_liters;
  const waterAmount = Number(rawWaterAmount);
  const hasWaterAmount =
    rawWaterAmount !== null &&
    rawWaterAmount !== undefined &&
    rawWaterAmount !== "" &&
    Number.isFinite(waterAmount);
  const waterLevelPercent =
    waterType === "bottle" && hasWaterAmount
      ? Math.max(0, Math.min(100, (waterAmount / 19) * 100))
      : undefined;
  const waterIndicator = health?.water || noData;

  const items = [
    {
      title: "Remote access",
      dialog: "wifi" as const,
      icon: FaWifi,
      indicator: health?.online || noData,
      showLastOnline: true,
    },
    {
      title: "Water",
      dialog: "water" as const,
      icon: FaTint,
      indicator:
        waterLevelPercent !== undefined
          ? {
              ...waterIndicator,
              label: `${waterAmount.toFixed(1)} L / 19 L`,
            }
          : waterIndicator,
      levelPercent: waterLevelPercent,
    },
    {
      title: "Powders",
      dialog: "powders" as const,
      icon: FaBoxOpen,
      indicator: health?.powders || noData,
      powderLevels: health?.powderLevels,
    },
    {
      title: "Empty Cups",
      dialog: "cups" as const,
      icon: CiCoffeeCup,
      indicator: health?.cups || noData,
    },
    {
      title: "Door Lock",
      dialog: "lock" as const,
      icon: FaLock,
      indicator:
        machine.has_door_lock === true
          ? ({ state: "ok", label: "QR code", source: "ops" } as const)
          : machine.has_door_lock === false
            ? ({
                state: "unknown",
                label: "Not installed",
                source: "ops",
              } as const)
            : noData,
    },
  ];

  return (
    <>
      <SimpleGrid
        columns={{ base: 2, sm: 3 }}
        spacing="2"
        aria-label="Machine health"
      >
        {items.map((item, index) => (
          <Fragment key={item.title}>
            {index === 1 ? (
              <TodaySalesItem
                machineId={machine.id}
                sales={salesToday}
                isLoading={isSalesLoading}
              />
            ) : null}
            <HealthItem {...item} onClick={() => setDialog(item.dialog)} />
          </Fragment>
        ))}
      </SimpleGrid>
      <MachineHealthDialog
        kind={dialog}
        onlineStatus={health?.online}
        machine={{
          ...machine,
          water_type: health?.waterType ?? machine.water_type,
          water_amount_liters:
            health?.waterAmountLiters ?? machine.water_amount_liters,
          cups_amount: health?.cupsAmount ?? machine.cups_amount,
        }}
        onClose={() => setDialog(null)}
        onSaved={onHealthChanged}
      />
    </>
  );
}
