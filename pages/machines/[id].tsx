import {
  Alert,
  AlertIcon,
  Box,
  SimpleGrid,
  Stack,
  VStack,
  Table,
  Tbody,
  Td,
  Text,
  Tr,
} from "@chakra-ui/react";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { MachineRegistrationEditor } from "../../components/portal/machines/MachineRegistrationEditor";
import { MachineDoorUnlock } from "../../components/portal/machines/MachineDoorUnlock";
import { MachineHealthStrip } from "../../components/portal/machines/MachineHealthStrip";
import { MachineKioskTexts } from "../../components/portal/machines/MachineKioskTexts";
import { MachineConsumptionSection } from "../../components/portal/machines/MachineConsumptionSection";
import { MachineProductLineGrouping } from "../../components/portal/machines/MachineProductLineGrouping";
import { MachineFreeMode } from "../../components/machines/MachineFreeMode";
import { NayaxSettingsSection } from "../../components/portal/NayaxSettingsSection";
import { PortalShell } from "../../components/portal/PortalShell";
import { requirePortalSession } from "../../lib/portal/auth";
import {
  getTelemetryMachineHome,
  getTelemetryMachinePrices,
  getTelemetryMachineStatus,
  getTelemetryMachineStorage,
  isTelemetryConfigured,
  resolveTelemetryMachine,
} from "../../services/server/telemetryClient";
import { requestStrapiRestAsService } from "../../services/server/strapiClient";
import type { PortalSession } from "../../types/portal";
import type { Currency, Language, Machine } from "../../types/strapi";
import { formatMoney } from "../../lib/portal/currency";
import { buildMachineHealthRow } from "../../lib/portal/machineHealth";

type MachineDetailPageProps = {
  session: PortalSession;
  machine: Machine;
  telemetryConfigured: boolean;
  telemetryConnected?: boolean;
  telemetryOrganizationId?: number | null;
  telemetryReason?: string | null;
  telemetryStatus?: any | null;
  telemetryHome?: any | null;
  telemetryStorage?: any | null;
  telemetryPrices?: any[] | null;
  currencies: Currency[];
  languages: Language[];
};

const displayValue = (value: unknown, fallback = "-"): string => {
  if (value === null || typeof value === "undefined" || value === "")
    return fallback;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => displayValue(item)).join(", ");
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const text =
      record.text ||
      record.label ||
      record.name ||
      record.title ||
      record.productName;
    const date = record.date || record.updatedAt || record.createdAt;

    if (text && date) return `${displayValue(text)} (${displayValue(date)})`;
    if (text) return displayValue(text);

    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }

  return fallback;
};

const rows = (machine: Machine) => [
  ["Title", displayValue(machine.title)],
  ["Serial number", displayValue(machine.serial_number)],
  ["Status", displayValue(machine.status)],
  ["Machine type", displayValue(machine.machine_type?.name)],
  ["Country", displayValue(machine.country)],
  ["State / region", displayValue(machine.state_region)],
  ["City", displayValue(machine.city)],
  ["Hostname", displayValue(machine.hostname)],
  ["AnyDesk ID", displayValue(machine.anydesk_id)],
  ["Tailscale IP", displayValue(machine.tailscale_ip)],
  ["Unity version", displayValue(machine.unity_version)],
  ["SSD version", displayValue(machine.ssd_version)],
  ["Bootstrap version", displayValue(machine.bootstrap_version)],
];

const telemetryPriceValue = (price: any) => {
  const candidate =
    typeof price === "number" || typeof price === "string"
      ? price
      : (price?.price ?? price?.amount ?? price?.value);
  if (
    candidate === null ||
    candidate === undefined ||
    candidate === "" ||
    !Number.isFinite(Number(candidate))
  ) {
    return null;
  }
  return Number(candidate);
};

export default function MachineDetailPage({
  session,
  machine,
  telemetryConfigured,
  telemetryConnected,
  telemetryOrganizationId,
  telemetryReason,
  telemetryStatus,
  telemetryHome,
  telemetryStorage,
  telemetryPrices,
  currencies,
  languages,
}: MachineDetailPageProps) {
  const router = useRouter();
  return (
    <PortalShell
      title={machine.title || "Machine detail"}
      description="Machine access is scoped to the signed-in client. Live telemetry appears here once the frontend server is configured for the manage.ishakerusa.com API."
      clientName={session.client.company}
    >
      <SimpleGrid columns={{ base: 1, xl: 2 }} spacing="6">
        <Stack
          gridColumn={{ xl: "1 / -1" }}
          direction={{ base: "column", md: "row" }}
          spacing="4"
          align={{ base: "stretch", md: "center" }}
        >
          <Box flex="1" minW="0" maxW={{ base: "100%", md: "500px" }}>
            <MachineHealthStrip
              machine={machine}
              health={buildMachineHealthRow(machine, {
                status: telemetryStatus,
                storage: telemetryStorage,
              })}
              onHealthChanged={() => void router.replace(router.asPath)}
            />
          </Box>
          <MachineDoorUnlock machine={machine} />
        </Stack>
        <Box gridColumn={{ xl: "1 / -1" }}>
          <MachineRegistrationEditor
            machine={machine}
            defaults={{
              country: session.client.country,
              state: session.client.state,
              city: session.client.city,
            }}
          />
        </Box>
        <Box gridColumn={{ xl: "1 / -1" }}>
          <MachineFreeMode machineId={machine.id} apiScope="portal" />
        </Box>
        <Box gridColumn={{ xl: "1 / -1" }}>
          <MachineProductLineGrouping machine={machine} />
        </Box>
        <Box gridColumn={{ xl: "1 / -1" }}>
          <MachineKioskTexts
            machine={machine}
            languages={languages}
            currencies={currencies}
          />
        </Box>
        <Box gridColumn={{ xl: "1 / -1" }}>
          <MachineConsumptionSection machine={machine} />
        </Box>
        <Box gridColumn={{ xl: "1 / -1" }}>
          <NayaxSettingsSection client={session.client} machine={machine} />
        </Box>
        <Box
          bg="bg.900"
          border="1px solid"
          borderColor="whiteAlpha.100"
          borderRadius="2xl"
          p="6"
        >
          <Text color="acid.300" fontWeight="800" mb="4">
            Machine metadata
          </Text>
          <Table variant="simple" colorScheme="whiteAlpha">
            <Tbody>
              {rows(machine).map(([label, value]) => (
                <Tr key={label}>
                  <Td color="bg.300" pl="0">
                    {label}
                  </Td>
                  <Td color="bg.50" pr="0">
                    {value}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>

        <Box
          bg="bg.900"
          border="1px solid"
          borderColor="whiteAlpha.100"
          borderRadius="2xl"
          p="6"
        >
          <VStack spacing="3" align="stretch">
            <Text color="acid.300" fontWeight="800">
              Telemetry connection
            </Text>
            {!telemetryConfigured ? (
              <>
                <Text color="orange.200">
                  Live telemetry is not configured on this frontend server.
                </Text>
                <Text color="bg.300">
                  Missing env vars: `TELEMETRY_API_BASE`,
                  `TELEMETRY_KEYCLOAK_TOKEN_URL`, `TELEMETRY_CLIENT_ID`,
                  `TELEMETRY_SERVICE_USERNAME`, `TELEMETRY_SERVICE_PASSWORD`.
                </Text>
              </>
            ) : telemetryReason ? (
              <>
                <Text color="green.300">
                  Telemetry API connection is working.
                </Text>
                {telemetryOrganizationId ? (
                  <Text color="bg.300">
                    Resolved organization id: {telemetryOrganizationId}
                  </Text>
                ) : null}
                <Text color="orange.200">
                  Telemetry machine could not be resolved.
                </Text>
                <Text color="bg.300">Reason: {telemetryReason}</Text>
                <Text color="bg.300">
                  Strapi serial number: {machine.serial_number || "-"}
                </Text>
              </>
            ) : (
              <>
                <Text color="green.300">
                  Telemetry API connection is working.
                </Text>
                {telemetryOrganizationId ? (
                  <Text color="bg.300">
                    Resolved organization id: {telemetryOrganizationId}
                  </Text>
                ) : null}
                <Text color="bg.300">
                  Status:{" "}
                  {displayValue(
                    telemetryStatus?.status || telemetryHome?.status,
                    "Connected",
                  )}
                </Text>
                {typeof telemetryHome?.applicationVersion !== "undefined" ? (
                  <Text color="bg.300">
                    App version:{" "}
                    {displayValue(telemetryHome.applicationVersion)}
                  </Text>
                ) : null}
                {typeof telemetryHome?.isActiveKiosk !== "undefined" ? (
                  <Text color="bg.300">
                    Kiosk active: {telemetryHome.isActiveKiosk ? "Yes" : "No"}
                  </Text>
                ) : null}
                {telemetryStorage ? (
                  <Text color="bg.300">
                    Storage payload received:{" "}
                    {Object.keys(telemetryStorage).length} fields
                  </Text>
                ) : null}
              </>
            )}
          </VStack>
        </Box>

        {telemetryPrices?.length ? (
          <Box
            bg="bg.900"
            border="1px solid"
            borderColor="whiteAlpha.100"
            borderRadius="2xl"
            p="6"
            gridColumn={{ xl: "1 / -1" }}
          >
            <Text color="acid.300" fontWeight="800" mb="4">
              Prices
            </Text>
            <Table variant="simple" colorScheme="whiteAlpha">
              <Tbody>
                {telemetryPrices.slice(0, 20).map((price, index) => (
                  <Tr key={index}>
                    <Td color="bg.300" pl="0">
                      {displayValue(
                        price?.name || price?.title || price?.productName,
                        `Item ${index + 1}`,
                      )}
                    </Td>
                    <Td color="bg.50" pr="0">
                      {telemetryPriceValue(price) === null
                        ? "-"
                        : formatMoney(
                            telemetryPriceValue(price)!,
                            machine.currency || session.client.currency,
                          )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        ) : null}

        {machine.fleet_status?.media_keys ? (
          <Alert
            status={
              machine.fleet_status.media_keys.missing?.length
                ? "error"
                : "success"
            }
            gridColumn={{ xl: "1 / -1" }}
            borderRadius="xl"
            alignItems="flex-start"
          >
            <AlertIcon mt="1" />
            <Box>
              <Text fontWeight="800">Machine artwork check</Text>
              <Text>
                Checked {machine.fleet_status.media_keys.checked ?? 0} media
                key(s).
              </Text>
              {machine.fleet_status.media_keys.missing?.length ? (
                <Text mt="1">
                  Missing: {machine.fleet_status.media_keys.missing.join(", ")}
                </Text>
              ) : (
                <Text mt="1">No missing artwork was reported.</Text>
              )}
            </Box>
          </Alert>
        ) : null}
      </SimpleGrid>
    </PortalShell>
  );
}

export const getServerSideProps: GetServerSideProps<
  MachineDetailPageProps
> = async (context) => {
  const result = await requirePortalSession(context);
  if ("redirect" in result) return { redirect: result.redirect };

  const machineId = Array.isArray(context.params?.id)
    ? context.params?.id[0]
    : context.params?.id;
  const machine = result.session.machines.find(
    (item) => String(item.id) === String(machineId),
  );

  if (!machine) {
    return { notFound: true };
  }

  const telemetryConfigured = isTelemetryConfigured();
  let currencies: Currency[] = [];
  let languages: Language[] = [];
  try {
    [currencies, languages] = await Promise.all([
      requestStrapiRestAsService<Currency[]>(
        "/api/currencies?filters[isActive][$eq]=true&sort[0]=code:ASC&pagination[pageSize]=2000",
      ),
      requestStrapiRestAsService<Language[]>(
        "/api/languages?filters[isActive][$eq]=true&sort[0]=name:ASC&pagination[pageSize]=2000",
      ),
    ]);
  } catch (error) {
    console.error("[machines/detail] currency loading failed:", error);
  }

  const commonProps = {
    session: result.session,
    machine,
    telemetryConfigured,
    currencies,
    languages,
  };

  if (!telemetryConfigured) {
    return {
      props: {
        ...commonProps,
        telemetryConnected: false,
      },
    };
  }

  try {
    const resolved = await resolveTelemetryMachine({
      client: result.session.client,
      serialNumber: machine.serial_number,
    });

    if (!resolved.machineId) {
      return {
        props: {
          ...commonProps,
          telemetryConnected: true,
          telemetryOrganizationId: resolved.organizationId,
          telemetryReason: resolved.reason,
        },
      };
    }

    const [telemetryStatus, telemetryHome, telemetryStorage, telemetryPrices] =
      await Promise.all([
        getTelemetryMachineStatus(resolved.machineId).catch(() => null),
        getTelemetryMachineHome(resolved.machineId).catch(() => null),
        getTelemetryMachineStorage(resolved.machineId).catch(() => null),
        getTelemetryMachinePrices(resolved.machineId).catch(() => null),
      ]);

    return {
      props: {
        ...commonProps,
        telemetryConnected: true,
        telemetryOrganizationId: resolved.organizationId,
        telemetryStatus,
        telemetryHome,
        telemetryStorage,
        telemetryPrices: Array.isArray(telemetryPrices)
          ? telemetryPrices
          : null,
        telemetryReason: null,
      },
    };
  } catch (error) {
    console.error("[machines/detail] telemetry load failed:", error);
    return {
      props: {
        ...commonProps,
        telemetryConnected: false,
        telemetryReason: "telemetry_request_failed",
      },
    };
  }
};
