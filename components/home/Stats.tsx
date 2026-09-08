import {
  Badge,
  Box,
  Container,
  Flex,
  HStack,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Wrap,
  WrapItem,
  useColorModeValue,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import CustomTitle from "./CutsomTitle";

const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

type NamedRelation = { id: number | null; name: string | null } | null;

type RecentTransaction = {
  at: string;
  country: string;
  machine_type: string;
  serial_masked: string;
  amount: number;
  currency: string;
  product_line: NamedRelation;
  taste: NamedRelation;
  brand: NamedRelation;
  powder_g: number;
};

type FleetMachine = {
  serial_masked: string;
  machine_type: string;
  country: string;
  country_source: "machine" | "client" | "timezone";
  active_tastes: string[];
  active_tastes_source: "planogram" | "recent_sales";
  cups_total: number;
  free_cups: number;
  days_operating: number;
  first_sale_at: string | null;
  last_sale_at: string | null;
  currency: string;
  revenue_last_week: number;
  revenue_last_month: number;
  revenue_total: number;
  revenue_total_charged: number;
  revenue_total_usd_approx: number;
  powder_g_total: number;
};

type FleetStatsPayload = {
  generated_at: string;
  recent_transactions: RecentTransaction[];
  machines: FleetMachine[];
  totals: {
    machines_reporting: number;
    machines_listed: number;
    cups_total: number;
    free_cups_total: number;
    revenue_by_currency: Record<
      string,
      { cups: number; revenue: number; charged: number }
    >;
    revenue_usd_approx: number;
    unconverted_currencies: string[];
  };
  fx: {
    basis: string;
    approximate: boolean;
    note: string;
    rates_to_usd: Record<string, number>;
  };
};

type StatsProps = { showMachines?: boolean };

const COUNTRY_CODES: Record<string, string> = {
  argentina: "AR",
  australia: "AU",
  canada: "CA",
  france: "FR",
  germany: "DE",
  greece: "GR",
  italy: "IT",
  mexico: "MX",
  poland: "PL",
  spain: "ES",
  turkey: "TR",
  türkiye: "TR",
  uk: "GB",
  ukraine: "UA",
  "united kingdom": "GB",
  "united states": "US",
};

function countryFlag(country = "") {
  const normalized = country.trim();
  const code = (
    normalized.length === 2
      ? normalized
      : COUNTRY_CODES[normalized.toLocaleLowerCase()]
  )?.toUpperCase();
  if (!code || !/^[A-Z]{2}$/.test(code)) return "🌎";
  return String.fromCodePoint(
    ...[...code].map((letter) => 127397 + letter.charCodeAt(0)),
  );
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  } catch {
    return `${currency || ""} ${(Number(amount) || 0).toFixed(2)}`.trim();
  }
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(Number(value) || 0);
}

function formatPowder(grams: number) {
  const value = Number(grams) || 0;
  return value >= 1000 ? `${(value / 1000).toFixed(1)} kg` : `${value} g`;
}

function updatedLabel(value?: string) {
  if (!value) return "Update time unavailable";
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60_000),
  );
  if (!Number.isFinite(elapsedMinutes)) return "Update time unavailable";
  if (elapsedMinutes < 1) return "Updated just now";
  if (elapsedMinutes < 60) return `Updated ${elapsedMinutes} min ago`;
  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) return `Updated ${hours} hr ago`;
  return `Updated ${Math.floor(hours / 24)} days ago`;
}

function relationName(relation: NamedRelation) {
  return relation?.name?.trim() || "—";
}

function RecentSaleCard({ sale }: { sale: RecentTransaction }) {
  const cardBg = useColorModeValue("white", "bg.800");
  const detailBg = useColorModeValue("bg.50", "bg.900");
  const borderColor = useColorModeValue("blackAlpha.100", "whiteAlpha.100");
  const muted = useColorModeValue("bg.500", "bg.300");
  const isFree = Number(sale.amount) === 0;

  return (
    <Box
      bg={cardBg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="2xl"
      p={{ base: "4", md: "5" }}
      boxShadow="sm"
      transition="transform .2s ease, border-color .2s ease"
      _hover={{ transform: "translateY(-2px)", borderColor: "acid.500" }}
    >
      <Flex justify="space-between" align="start" gap="3">
        <HStack minW="0" spacing="2">
          <Text fontSize="2xl" lineHeight="1" aria-label={sale.country}>
            {countryFlag(sale.country)}
          </Text>
          <Box minW="0">
            <Text fontWeight="700" textTransform="capitalize" noOfLines={1}>
              {sale.machine_type || "iShaker"}
            </Text>
            <Text color={muted} fontSize="xs" noOfLines={1}>
              {sale.serial_masked || "—"} · {sale.country || "—"}
            </Text>
          </Box>
        </HStack>
        <Badge
          colorScheme={isFree ? "purple" : "green"}
          borderRadius="full"
          px="2.5"
          py="1"
        >
          {isFree ? "Free" : formatMoney(sale.amount, sale.currency)}
        </Badge>
      </Flex>

      <Box mt="5">
        <Text
          color={muted}
          fontSize="xs"
          textTransform="uppercase"
          letterSpacing="wide"
        >
          Product line
        </Text>
        <Text fontSize="lg" fontWeight="800" noOfLines={1}>
          {relationName(sale.product_line)}
        </Text>
      </Box>

      <SimpleGrid columns={3} spacing="2" mt="5">
        {[
          { label: "Brand", value: relationName(sale.brand) },
          { label: "Flavor", value: relationName(sale.taste) },
          { label: "Powder", value: formatPowder(sale.powder_g) },
        ].map((detail) => (
          <Box
            key={detail.label}
            bg={detailBg}
            borderRadius="xl"
            p="2.5"
            minW="0"
          >
            <Text color={muted} fontSize="10px" textTransform="uppercase">
              {detail.label}
            </Text>
            <Text mt="1" fontSize="xs" fontWeight="700" noOfLines={1}>
              {detail.value}
            </Text>
          </Box>
        ))}
      </SimpleGrid>

      <Text color={muted} fontSize="xs" mt="4">
        {sale.at ? new Date(sale.at).toLocaleString() : "—"}
      </Text>
    </Box>
  );
}

const countrySourceLabel: Record<FleetMachine["country_source"], string> = {
  machine: "Machine location",
  client: "Client location",
  timezone: "Estimated from timezone",
};

function MachineCard({ machine }: { machine: FleetMachine }) {
  const cardBg = useColorModeValue("white", "bg.800");
  const detailBg = useColorModeValue("bg.50", "bg.900");
  const borderColor = useColorModeValue("blackAlpha.100", "whiteAlpha.100");
  const muted = useColorModeValue("bg.500", "bg.300");

  return (
    <Box
      bg={cardBg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="2xl"
      p="5"
    >
      <Flex justify="space-between" align="start" gap="3">
        <HStack minW="0" align="start">
          <Text fontSize="2xl">{countryFlag(machine.country)}</Text>
          <Box minW="0">
            <Text fontWeight="800" textTransform="capitalize" noOfLines={1}>
              {machine.machine_type || "iShaker"}
            </Text>
            <Text color={muted} fontSize="xs">
              {machine.serial_masked || "—"}
            </Text>
          </Box>
        </HStack>
        <Badge colorScheme="green" borderRadius="full">
          {formatCount(machine.cups_total)} cups
        </Badge>
      </Flex>
      <Text color={muted} fontSize="xs" mt="3">
        {machine.country || "—"} ·{" "}
        {countrySourceLabel[machine.country_source] ||
          "Location source unavailable"}
      </Text>

      <SimpleGrid columns={2} spacing="2" mt="4">
        {[
          ["Free cups", formatCount(machine.free_cups)],
          ["Powder used", formatPowder(machine.powder_g_total)],
          ["Days of recorded sales", formatCount(machine.days_operating)],
          [
            "Last sale",
            machine.last_sale_at
              ? new Date(machine.last_sale_at).toLocaleDateString()
              : "—",
          ],
        ].map(([label, value]) => (
          <Box key={label} bg={detailBg} borderRadius="xl" p="3">
            <Text color={muted} fontSize="10px" textTransform="uppercase">
              {label}
            </Text>
            <Text fontWeight="800" mt="1">
              {value}
            </Text>
          </Box>
        ))}
      </SimpleGrid>

      <Box mt="4" pt="4" borderTop="1px solid" borderColor={borderColor}>
        <Text fontWeight="800">Drink value</Text>
        <Text color={muted} fontSize="xs" mb="2">
          Includes free cups at list price
        </Text>
        <SimpleGrid columns={3} spacing="2">
          {[
            ["7 days", machine.revenue_last_week],
            ["30 days", machine.revenue_last_month],
            ["Total", machine.revenue_total],
          ].map(([label, value]) => (
            <Box key={String(label)}>
              <Text color={muted} fontSize="10px" textTransform="uppercase">
                {label}
              </Text>
              <Text fontSize="sm" fontWeight="800">
                {formatMoney(Number(value), machine.currency)}
              </Text>
            </Box>
          ))}
        </SimpleGrid>
      </Box>

      <Box mt="4">
        <Text color={muted} fontSize="xs" mb="2">
          {machine.active_tastes_source === "planogram"
            ? "Active menu"
            : "Recently poured flavors"}
        </Text>
        {machine.active_tastes?.length ? (
          <Wrap spacing="1.5">
            {machine.active_tastes.map((taste) => (
              <WrapItem key={taste}>
                <Badge borderRadius="full" px="2" py="1" textTransform="none">
                  {taste}
                </Badge>
              </WrapItem>
            ))}
          </Wrap>
        ) : (
          <Text color={muted} fontSize="sm">
            No flavor data yet
          </Text>
        )}
      </Box>
    </Box>
  );
}

export function Stats({ showMachines = false }: StatsProps) {
  const [fleet, setFleet] = useState<FleetStatsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const muted = useColorModeValue("bg.500", "bg.300");
  const totalBg = useColorModeValue("bg.100", "bg.800");
  const reportingMachines = useMemo(
    () =>
      [...(fleet?.machines || [])]
        .filter((machine) => Number(machine.cups_total) > 0)
        .sort((left, right) => right.cups_total - left.cups_total),
    [fleet],
  );
  const telemetryCountryCount = useMemo(
    () =>
      new Set(
        (fleet?.machines || [])
          .map((machine) => machine.country)
          .filter(Boolean),
      ).size,
    [fleet],
  );

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;

    async function loadStats() {
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch("/api/public/fleet-stats", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Fleet stats request failed: ${response.status}`);
        }
        const payload = (await response.json()) as FleetStatsPayload;
        if (active) {
          setFleet(payload);
          setHasError(false);
        }
      } catch (error) {
        if (
          active &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setHasError(true);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadStats();
    const interval = window.setInterval(loadStats, REFRESH_INTERVAL_MS);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(interval);
    };
  }, []);

  const sales = fleet?.recent_transactions || [];
  const totals = fleet?.totals;

  return (
    <Container maxW="7xl" py={{ base: "10", md: "16" }}>
      <CustomTitle
        as={showMachines ? "h1" : "h2"}
        title={showMachines ? "Realtime fleet stats" : "Shakes happening now"}
        subtitle="Recent drinks and hourly fleet telemetry from iShaker machines around the world."
        mt="0"
        mb={{ base: "5", md: "7" }}
        fontSize={{ base: "3xl", md: "6xl" }}
      />

      <Flex justify="center" mb="7">
        <HStack spacing="2" color={muted} fontSize="sm">
          <Box boxSize="2" bg="acid.500" borderRadius="full" />
          <Text>Hourly data · {updatedLabel(fleet?.generated_at)}</Text>
        </HStack>
      </Flex>

      {totals ? (
        <SimpleGrid columns={{ base: 2, lg: 4 }} spacing="3" mb="8">
          {[
            [
              "Approx. drink value (USD)",
              formatMoney(totals.revenue_usd_approx, "USD"),
            ],
            ["Drinks made", formatCount(totals.cups_total)],
            [
              "Machines reporting",
              `${totals.machines_reporting} / ${totals.machines_listed}`,
            ],
            ["Telemetry countries", formatCount(telemetryCountryCount)],
          ].map(([label, value]) => (
            <Box
              key={label}
              bg={totalBg}
              borderRadius="2xl"
              p={{ base: "4", md: "5" }}
            >
              <Text
                color="acid.600"
                fontSize={{ base: "xl", md: "2xl" }}
                fontWeight="800"
              >
                {value}
              </Text>
              <Text color={muted} fontSize="xs">
                {label}
              </Text>
            </Box>
          ))}
          {totals.unconverted_currencies.length ? (
            <Text color="orange.300" fontSize="xs" gridColumn="1 / -1">
              Approximate USD total excludes:{" "}
              {totals.unconverted_currencies.join(", ")}.
            </Text>
          ) : null}
        </SimpleGrid>
      ) : null}

      <Text fontSize="2xl" fontWeight="800" mb="4">
        Recent transactions
      </Text>
      {isLoading ? (
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing="4">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} h="220px" borderRadius="2xl" />
          ))}
        </SimpleGrid>
      ) : sales.length ? (
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing="4">
          {sales.map((sale) => (
            <RecentSaleCard
              key={`${sale.at}-${sale.serial_masked}`}
              sale={sale}
            />
          ))}
        </SimpleGrid>
      ) : (
        <Stack align="center" py="10" color={muted}>
          <Text fontWeight="700">
            {hasError
              ? "Fleet stats are reconnecting…"
              : "No recent transactions yet."}
          </Text>
          <Text fontSize="sm">
            This page checks for a new hourly snapshot automatically.
          </Text>
        </Stack>
      )}

      {showMachines && fleet ? (
        <Box mt={{ base: "12", md: "16" }}>
          <Text fontSize={{ base: "2xl", md: "3xl" }} fontWeight="800">
            Machines with recorded drinks
          </Text>
          <Text color={muted} mt="1" mb="6">
            Showing {reportingMachines.length} of{" "}
            {totals?.machines_listed || fleet.machines.length} listed machines.
            Machines with no sales data yet are omitted.
          </Text>
          <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing="4">
            {reportingMachines.map((machine) => (
              <MachineCard key={machine.serial_masked} machine={machine} />
            ))}
          </SimpleGrid>
        </Box>
      ) : null}
    </Container>
  );
}
