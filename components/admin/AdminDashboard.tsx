import {
  Badge,
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Link as ChakraLink,
  Select,
  SimpleGrid,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { NextSeo } from "next-seo";
import Link from "next/link";
import { useMemo, useState } from "react";
import { getMachinePatchVersion } from "../../lib/admin/machinePatch";
import { isReadinessVerdict } from "../../lib/admin/readiness";
import { buildMachineHealthRow } from "../../lib/portal/machineHealth";
import type {
  Client,
  Machine,
  MachineReadinessVerdict,
} from "../../types/strapi";
import { AdminHeader } from "./AdminHeader";
import { Metric } from "./Metric";
import { capitalize } from "../../services/helper";

export type AdminDashboardProps = {
  clients: Client[];
  machines: Machine[];
  cabinetClientIds: number[];
  loadError?: string;
  readinessReferenceTime: number;
};

const summaryMeta: Array<{
  verdict: MachineReadinessVerdict;
  label: string;
  color: string;
}> = [
  { verdict: "SHIP", label: "Ready to ship", color: "green" },
  { verdict: "REVIEW", label: "Review", color: "yellow" },
  { verdict: "DO_NOT_SHIP", label: "Do not ship", color: "red" },
];

type FailureOccurrence = {
  machineId: string | number;
  machineName: string;
  clientName: string;
  detail: string;
};

const machineName = (machine: Machine) =>
  machine.serial_number || machine.title || `Machine #${machine.id}`;

const isDashboardMachineType = (machine: Machine) =>
  ["shakers", "shakertouch"].includes(
    String(machine.machine_type?.name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ""),
  );

const groupFailureOccurrences = (occurrences: FailureOccurrence[]) => {
  const groups = new Map<string, FailureOccurrence[]>();
  occurrences.forEach((occurrence) => {
    groups.set(occurrence.detail, [
      ...(groups.get(occurrence.detail) || []),
      occurrence,
    ]);
  });
  return Array.from(groups.entries());
};

export function AdminDashboard({
  clients,
  machines,
  cabinetClientIds,
  loadError,
  readinessReferenceTime,
}: AdminDashboardProps) {
  const cabinetClients = useMemo(
    () => new Set(cabinetClientIds),
    [cabinetClientIds],
  );
  const toast = useToast();
  const [openingMachine, setOpeningMachine] = useState<string | null>(null);
  const openCabinet = async (machine: Machine) => {
    setOpeningMachine(String(machine.id));
    try {
      const response = await fetch(
        `/api/admin/machines/${machine.id}/cabinet`,
        { method: "POST" },
      );
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          payload.message || "Unable to open the client cabinet.",
        );
      window.location.href = payload.redirect;
    } catch (error) {
      toast({
        title: (error as Error).message,
        status: "error",
        duration: 6000,
        isClosable: true,
      });
      setOpeningMachine(null);
    }
  };
  const [search, setSearch] = useState("");
  const [verdictFilter, setVerdictFilter] = useState("");
  const [failedCheckFilter, setFailedCheckFilter] = useState("");
  const visibleMachines = useMemo(
    () => machines.filter(isDashboardMachineType),
    [machines],
  );
  const readinessSummary = useMemo(() => {
    const verdictCounts: Record<MachineReadinessVerdict, number> = {
      SHIP: 0,
      REVIEW: 0,
      DO_NOT_SHIP: 0,
    };
    const failureOccurrences = new Map<string, FailureOccurrence[]>();

    visibleMachines.forEach((machine) => {
      if (isReadinessVerdict(machine.readiness?.verdict)) {
        verdictCounts[machine.readiness.verdict] += 1;
      }
      const failures = Array.isArray(machine.readiness?.failed)
        ? machine.readiness.failed
        : [];
      new Set(failures).forEach((checkId) => {
        const occurrences = failureOccurrences.get(checkId) || [];
        occurrences.push({
          machineId: machine.id,
          machineName: machineName(machine),
          clientName: machine.client?.company || "Unassigned",
          detail:
            machine.readiness?.detail?.[checkId] ||
            "No remediation detail was included in this report.",
        });
        failureOccurrences.set(checkId, occurrences);
      });
    });

    return {
      verdictCounts,
      unchecked: visibleMachines.filter(
        (machine) => !isReadinessVerdict(machine.readiness?.verdict),
      ).length,
      frequentFailures: Array.from(failureOccurrences.entries()).sort(
        ([leftId, leftOccurrences], [rightId, rightOccurrences]) =>
          rightOccurrences.length - leftOccurrences.length ||
          leftId.localeCompare(rightId),
      ),
    };
  }, [visibleMachines]);

  const filteredMachines = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return visibleMachines.filter((machine) => {
      if (verdictFilter && machine.readiness?.verdict !== verdictFilter) {
        return false;
      }
      if (
        failedCheckFilter &&
        !machine.readiness?.failed?.includes(failedCheckFilter)
      ) {
        return false;
      }
      if (!normalizedSearch) return true;

      return [
        machine.id,
        machine.title,
        machine.nickname,
        machine.serial_number,
        machine.anydesk_id,
        machine.client?.company,
        getMachinePatchVersion(machine),
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(normalizedSearch),
      );
    });
  }, [failedCheckFilter, search, verdictFilter, visibleMachines]);

  return (
    <>
      <NextSeo title="Admin Fleet" noindex nofollow />
      <Box minH="100vh" bg="bg.1000" color="bg.100">
        <AdminHeader title="Machine fleet" />

        <Box
          maxW="1600px"
          mx="auto"
          px={{ base: 3, md: 6 }}
          py={{ base: 5, md: 6 }}
        >
          <SimpleGrid columns={{ base: 1, sm: 3 }} spacing="3" mb="4">
            <Metric label="Clients" value={clients.length} />
            <Metric label="All machines" value={visibleMachines.length} />
            <Metric label="Not checked" value={readinessSummary.unchecked} />
          </SimpleGrid>

          <Box
            bg="bg.900"
            border="1px solid"
            borderColor="whiteAlpha.100"
            borderRadius="8px"
            p={{ base: 3, md: 4 }}
            mb="4"
          >
            <SimpleGrid columns={{ base: 1, sm: 3 }} spacing="3" mb="4">
              {summaryMeta.map(({ verdict, label, color }) => (
                <HStack
                  key={verdict}
                  bg="whiteAlpha.50"
                  borderLeft="3px solid"
                  borderColor={`${color}.400`}
                  borderRadius="6px"
                  px="3"
                  py="2"
                >
                  <Text color={`${color}.200`} fontSize="xl" fontWeight="900">
                    {readinessSummary.verdictCounts[verdict]}
                  </Text>
                  <Text color="bg.300" fontSize="sm" fontWeight="700">
                    {label}
                  </Text>
                </HStack>
              ))}
            </SimpleGrid>

            <Box mb="4">
              <Text color="bg.300" fontSize="xs" fontWeight="800" mb="2">
                MOST FREQUENT FAILED CHECKS
              </Text>
              {readinessSummary.frequentFailures.length ? (
                <HStack spacing="2" flexWrap="wrap">
                  {readinessSummary.frequentFailures
                    .slice(0, 5)
                    .map(([checkId, occurrences]) => (
                      <Tooltip
                        key={checkId}
                        hasArrow
                        placement="top"
                        maxW="560px"
                        p="4"
                        openDelay={100}
                        label={
                          <Box>
                            <Text
                              color="red.200"
                              fontFamily="mono"
                              fontWeight="900"
                              mb="2"
                            >
                              {checkId}
                            </Text>
                            <VStack align="stretch" spacing="3">
                              {groupFailureOccurrences(occurrences).map(
                                ([detail, affectedMachines]) => (
                                  <Box key={detail}>
                                    <Text fontWeight="900">
                                      {affectedMachines
                                        .map(
                                          (occurrence) =>
                                            `${occurrence.machineName} · ${occurrence.clientName}`,
                                        )
                                        .join(", ")}
                                    </Text>
                                    <Text whiteSpace="pre-wrap">{detail}</Text>
                                  </Box>
                                ),
                              )}
                            </VStack>
                          </Box>
                        }
                      >
                        <Badge
                          colorScheme="red"
                          textTransform="none"
                          fontFamily="mono"
                          px="2"
                          py="1"
                          cursor="help"
                        >
                          {checkId} · {occurrences.length}{" "}
                          {occurrences.length === 1 ? "machine" : "machines"}
                        </Badge>
                      </Tooltip>
                    ))}
                </HStack>
              ) : (
                <Text color="bg.500" fontSize="sm">
                  No failed checks have been reported.
                </Text>
              )}
            </Box>

            <SimpleGrid columns={{ base: 1, md: 3 }} spacing="3">
              <FormControl>
                <FormLabel color="bg.400" fontSize="xs" mb="1">
                  Search machines
                </FormLabel>
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name, ID, serial, client, patch…"
                  bg="bg.800"
                  size="sm"
                />
              </FormControl>
            </SimpleGrid>
          </Box>

          {loadError ? (
            <Box
              bg="rgba(154, 52, 18, 0.18)"
              border="1px solid"
              borderColor="orange.700"
              borderRadius="8px"
              p="4"
              mb="4"
            >
              <Text color="orange.200" fontWeight="800">
                Data loading failed
              </Text>
              <Text color="orange.200">{loadError}</Text>
            </Box>
          ) : null}

          <Box
            bg="bg.900"
            border="1px solid"
            borderColor="whiteAlpha.100"
            borderRadius="8px"
            overflow="hidden"
          >
            <HStack
              justify="space-between"
              px="4"
              py="3"
              borderBottom="1px solid"
              borderColor="whiteAlpha.100"
            >
              <Text color="bg.50" fontWeight="900">
                Machines
              </Text>
              <Text color="bg.400" fontSize="sm">
                Showing {filteredMachines.length} of {visibleMachines.length}
              </Text>
            </HStack>

            <TableContainer>
              <Table size="sm" variant="simple">
                <Thead bg="whiteAlpha.50">
                  <Tr>
                    <Th>Nickname</Th>
                    <Th>Client</Th>
                    <Th>Serial</Th>
                    <Th>AnyDesk</Th>
                    <Th>Patch</Th>
                    <Th textAlign="right">Action</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredMachines.map((machine) => {
                    const patchVersion = getMachinePatchVersion(machine);
                    const isOffline =
                      buildMachineHealthRow(
                        machine,
                        null,
                        readinessReferenceTime,
                      ).online.state === "error";
                    return (
                      <Tr
                        key={machine.id}
                        bg={isOffline ? "blackAlpha.300" : undefined}
                        _hover={{
                          bg: isOffline ? "blackAlpha.400" : "whiteAlpha.50",
                        }}
                      >
                        <Td color="bg.100" fontWeight="700" py="2.5">
                          {capitalize(machine.nickname || "—")}
                        </Td>
                        <Td color="bg.300" py="2.5">
                          {machine.client?.company || "Unassigned"}
                        </Td>
                        <Td color="bg.200" fontFamily="mono" py="2.5">
                          {machine.serial_number || "—"}
                        </Td>
                        <Td py="2.5">
                          {machine.anydesk_id ? (
                            <ChakraLink
                              href={`anydesk:${machine.anydesk_id}`}
                              color={isOffline ? "red.300" : "acid.300"}
                              fontFamily="mono"
                              fontWeight="700"
                            >
                              {machine.anydesk_id}
                            </ChakraLink>
                          ) : (
                            <Text color="bg.500">—</Text>
                          )}
                        </Td>
                        <Td py="2.5">
                          {patchVersion ? (
                            <Badge colorScheme="purple">{patchVersion}</Badge>
                          ) : (
                            <Text color="bg.500" fontSize="sm">
                              Not reported
                            </Text>
                          )}
                        </Td>
                        <Td py="2.5" textAlign="right">
                          <HStack justify="flex-end">
                            <Button
                              size="xs"
                              variant="outline"
                              borderColor="acid.500"
                              color="acid.300"
                              onClick={() => openCabinet(machine)}
                              isDisabled={
                                !machine.client?.id ||
                                !cabinetClients.has(
                                  Number(machine.client.id),
                                ) ||
                                openingMachine !== null
                              }
                              isLoading={openingMachine === String(machine.id)}
                              title={
                                !machine.client?.id
                                  ? "No client assigned"
                                  : cabinetClients.has(
                                        Number(machine.client.id),
                                      )
                                    ? "Open client cabinet as support"
                                    : "This client has no active cabinet login"
                              }
                            >
                              Cabinet
                            </Button>
                            <Button
                              as={Link}
                              href={`/admin/machines/${machine.id}`}
                              size="xs"
                              variant="outline"
                              borderColor="whiteAlpha.200"
                            >
                              Details
                            </Button>
                          </HStack>
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </TableContainer>

            {!filteredMachines.length ? (
              <Text color="bg.300" textAlign="center" p="6">
                No machines match the selected filters.
              </Text>
            ) : null}
          </Box>
        </Box>
      </Box>
    </>
  );
}
