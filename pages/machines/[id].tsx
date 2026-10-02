import {
  Alert,
  AlertIcon,
  Box,
  SimpleGrid,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Tr,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import {
  PortalPageContent,
  PortalPageFailure,
  PortalPageLoading,
} from "../../components/portal/PortalPageState";
import { MachineRegistrationEditor } from "../../components/portal/machines/MachineRegistrationEditor";
import { MachineDoorUnlock } from "../../components/portal/machines/MachineDoorUnlock";
import { MachineHealthStrip } from "../../components/portal/machines/MachineHealthStrip";
import { MachineKioskTexts } from "../../components/portal/machines/MachineKioskTexts";
import { MachineConsumptionSection } from "../../components/portal/machines/MachineConsumptionSection";
import { MachineProductLineGrouping } from "../../components/portal/machines/MachineProductLineGrouping";
import { MachineFreeMode } from "../../components/machines/MachineFreeMode";
import { NayaxSettingsSection } from "../../components/portal/NayaxSettingsSection";
import { PortalShell } from "../../components/portal/PortalShell";
import { usePortalPage } from "../../lib/portal/usePortalPage";
import type { PortalMachineCell, PortalSession } from "../../types/portal";
import type { Currency, Language, Machine } from "../../types/strapi";
import {
  applyStoredPowderLevels,
  buildMachineHealthRow,
} from "../../lib/portal/machineHealth";

type MachineDetailPageProps = {
  session: PortalSession;
  machine: Machine;
  cells: PortalMachineCell[] | null;
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

function MachineDetailPage({
  session,
  machine,
  cells,
  currencies,
  languages,
  onRefresh,
}: MachineDetailPageProps & { onRefresh: () => void }) {
  const baseHealth = buildMachineHealthRow(machine);
  const health = cells
    ? applyStoredPowderLevels(baseHealth, machine, cells)
    : baseHealth;
  return (
    <PortalShell
      title={machine.title || "Machine detail"}
      description="Machine access and status are sourced from the signed-in client's Strapi records."
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
              health={health}
              initialCells={cells || undefined}
              onHealthChanged={onRefresh}
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
            onSaved={onRefresh}
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
          <MachineConsumptionSection
            machine={machine}
            initialCells={cells || undefined}
          />
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

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] || "" : value || "";

export default function MachineDetailRoute() {
  const router = useRouter();
  const machineId = first(router.query.id);
  const { data, error, mutate } = usePortalPage<MachineDetailPageProps>(
    router.isReady && machineId
      ? `/api/portal/machines/${encodeURIComponent(machineId)}/bootstrap`
      : null,
    { refreshInterval: 120_000 },
  );

  if (error) {
    return (
      <PortalPageFailure
        label="Machine details"
        error={error}
        retry={() => void mutate()}
        notFoundLabel="Machine not found"
        backHref="/machines"
        backLabel="Back to machines"
      />
    );
  }
  if (!data || String(data.machine.id) !== String(machineId)) {
    return <PortalPageLoading label="Machine details" />;
  }

  return (
    <PortalPageContent session={data.session}>
      <MachineDetailPage
        {...data}
        onRefresh={() => void mutate()}
      />
    </PortalPageContent>
  );
}
