import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useToast,
} from "@chakra-ui/react";
import { NextSeo } from "next-seo";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FiCopy, FiInfo, FiLogIn, FiMonitor, FiSearch } from "react-icons/fi";
import { getMachinePatchVersion } from "../../lib/admin/machinePatch";
import { buildMachineHealthRow } from "../../lib/portal/machineHealth";
import { capitalize } from "../../services/helper";
import type { Machine, Patch } from "../../types/strapi";
import { AdminHeader } from "./AdminHeader";
import { MachineInfoTile } from "./MachineInfoTile";
import { MachineTypeIcon } from "./MachineTypeIcon";
import { PatchDescription } from "./PatchDescription";
import { Box3D } from "../../styles/theme/custom";

export type AdminDashboardProps = {
  machines: Machine[];
  patches: Patch[];
  cabinetClientIds: number[];
  loadError?: string;
  readinessReferenceTime: number;
};

const isDashboardMachineType = (machine: Machine) =>
  ["shakers", "shakertouch"].includes(
    String(machine.machine_type?.name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ""),
  );

const getMachineName = (machine: Machine) =>
  capitalize(
    machine.nickname ||
      machine.title ||
      machine.serial_number ||
      `Machine #${machine.id}`,
  );

const getPatchNumber = (value?: string | null) => {
  const match = value?.match(/\d+(?!.*\d)/);
  return match ? Number(match[0]) : null;
};

const getMachinePatchNumber = (machine: Machine) => {
  const reportedPatchId = machine.fleet_status?.patch_id;
  if (
    (typeof reportedPatchId === "string" && reportedPatchId.trim()) ||
    typeof reportedPatchId === "number"
  ) {
    return String(reportedPatchId);
  }
  if (machine.patch?.id !== null && machine.patch?.id !== undefined) {
    return String(machine.patch.id);
  }

  const fallbackNumber = getPatchNumber(getMachinePatchVersion(machine));
  return fallbackNumber === null ? null : String(fallbackNumber);
};

const copyText = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Older mobile browsers can expose the API but reject it; use the
      // synchronous fallback while this click still counts as a user gesture.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard is unavailable");
};

function PatchVersion({
  current,
  latest,
}: {
  current: string | null;
  latest: string | null;
}) {
  const currentNumber = getPatchNumber(current);
  const latestNumber = getPatchNumber(latest);
  const difference =
    currentNumber !== null && latestNumber !== null
      ? latestNumber - currentNumber
      : null;
  const currentColor =
    difference === null
      ? "bg.500"
      : difference >= 10
        ? "red.300"
        : difference >= 6
          ? "orange.300"
          : difference >= 3
            ? "yellow.300"
            : "green.300";

  if (!latest) {
    return (
      <Text
        color={current ? "bg.100" : "bg.500"}
        fontFamily="mono"
        fontSize="sm"
      >
        {current || "Not reported"}
      </Text>
    );
  }

  return (
    <HStack spacing="1" fontFamily="mono" fontSize="sm">
      <Text color={currentColor} fontWeight="900">
        {current || "—"}
      </Text>
      <Text color="bg.500">/</Text>
      <Text color="bg.300">{latest}</Text>
    </HStack>
  );
}

type MachineCardProps = {
  machine: Machine;
  canOpenCabinet: boolean;
  isOpening: boolean;
  disableCabinet: boolean;
  latestPatchVersion: string | null;
  readinessReferenceTime: number;
  onCopySerial: (serial: string) => void;
  onOpenCabinet: (machine: Machine) => void;
  onShowPatch: (machine: Machine) => void;
};

function MachineCard({
  machine,
  canOpenCabinet,
  isOpening,
  disableCabinet,
  latestPatchVersion,
  readinessReferenceTime,
  onCopySerial,
  onOpenCabinet,
  onShowPatch,
}: MachineCardProps) {
  const patchVersion = getMachinePatchNumber(machine);
  const health = buildMachineHealthRow(
    machine,
    null,
    readinessReferenceTime,
  ).online;
  const statusColor =
    health.state === "ok"
      ? "green"
      : health.state === "error"
        ? "red"
        : health.state === "warning"
          ? "yellow"
          : "gray";

  return (
    <Box3D w="full" variant="no_contrast" borderRadius="16px" overflow="hidden">
      <Flex p="4" pb="3" align="flex-start" justify="space-between" gap="3">
        <HStack minW="0" spacing="3" align="center">
          <Flex
            boxSize="42px"
            borderRadius="12px"
            bg="rgba(118, 248, 95, 0.12)"
            color="acid.300"
            align="center"
            justify="center"
            flexShrink="0"
            fontSize="xl"
          >
            <MachineTypeIcon
              type={machine.machine_type?.name || machine.type}
            />
          </Flex>
          <Box minW="0">
            <Text color="bg.50" fontWeight="900" fontSize="lg" noOfLines={1}>
              {getMachineName(machine)}
            </Text>
            <Text color="bg.400" fontSize="sm" noOfLines={1}>
              {machine.machine_type?.name || machine.type || "Unknown type"}
            </Text>
          </Box>
        </HStack>
        <HStack spacing="1" flexShrink="0">
          <Badge
            colorScheme={statusColor}
            variant="subtle"
            borderRadius="full"
            px="2.5"
            py="1"
            textTransform="none"
          >
            {health.label}
          </Badge>
          <IconButton
            as={Link}
            href={`/admin/machines/${machine.id}`}
            aria-label={`Open details for ${getMachineName(machine)}`}
            title="Details"
            icon={<FiInfo />}
            variant="ghost"
            size="sm"
            borderRadius="full"
          />
        </HStack>
      </Flex>

      <Grid templateColumns="repeat(2, minmax(0, 1fr))" gap="2" px="4" pb="4">
        <MachineInfoTile
          title="Serial"
          value={machine.serial_number || "—"}
          color="bg.100"
          icon={<FiCopy />}
          cursor="copy"
          ariaLabel={`Copy serial ${machine.serial_number}`}
          onClick={() => onCopySerial(machine.serial_number)}
        />
        <MachineInfoTile
          title="Patch"
          value={
            <PatchVersion current={patchVersion} latest={latestPatchVersion} />
          }
          color="bg.100"
          icon={<FiInfo />}
          ariaLabel={`View patch ${patchVersion || "information"}`}
          onClick={() => onShowPatch(machine)}
        />
        <MachineInfoTile
          title="AnyDesk"
          value={machine.anydesk_id || "Not set"}
          color={
            !machine.anydesk_id
              ? "bg.500"
              : health.state === "error"
                ? "red.300"
                : "green.200"
          }
          icon={<FiMonitor />}
          ariaLabel={
            machine.anydesk_id
              ? `Open AnyDesk ${machine.anydesk_id}`
              : "AnyDesk is not set"
          }
          href={
            machine.anydesk_id ? `anydesk:${machine.anydesk_id}` : undefined
          }
        />
        <MachineInfoTile
          title="Admin panel"
          value={
            canOpenCabinet
              ? isOpening
                ? "Opening..."
                : machine.client?.company || "Unassigned"
              : "Not registered"
          }
          color={canOpenCabinet ? "green.200" : "bg.500"}
          icon={<FiLogIn />}
          ariaLabel={
            canOpenCabinet
              ? `Enter admin panel for ${getMachineName(machine)}`
              : `Admin panel is not registered for ${getMachineName(machine)}`
          }
          onClick={canOpenCabinet ? () => onOpenCabinet(machine) : undefined}
          isDisabled={canOpenCabinet && disableCabinet}
        />
      </Grid>
    </Box3D>
  );
}

export function AdminDashboard({
  machines,
  patches,
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
  const [search, setSearch] = useState("");
  const [selectedPatch, setSelectedPatch] = useState<{
    version: string | null;
    patch: Patch | null;
  } | null>(null);
  const latestPatchVersion = useMemo(() => {
    const latestPatch = patches.reduce<Patch | null>(
      (latest, patch) =>
        !latest || Number(patch.id) > Number(latest.id) ? patch : latest,
      null,
    );
    return latestPatch ? String(latestPatch.id) : null;
  }, [patches]);
  const patchesById = useMemo(
    () => new Map(patches.map((patch) => [String(patch.id), patch])),
    [patches],
  );

  const copySerial = async (serial: string) => {
    if (!serial) return;
    try {
      await copyText(serial);
      toast({
        title: "Serial copied",
        description: serial,
        status: "success",
        duration: 2200,
        isClosable: true,
      });
    } catch {
      toast({
        title: "Could not copy serial",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const showPatch = (machine: Machine) => {
    const version = getMachinePatchNumber(machine);
    setSelectedPatch({
      version,
      patch: version ? patchesById.get(version) || null : null,
    });
  };

  const openCabinet = async (machine: Machine) => {
    setOpeningMachine(String(machine.id));
    try {
      const response = await fetch(
        `/api/admin/machines/${machine.id}/cabinet`,
        { method: "POST" },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload.message || "Unable to open the client cabinet.",
        );
      }
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

  const visibleMachines = useMemo(
    () => machines.filter(isDashboardMachineType),
    [machines],
  );
  const filteredMachines = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const matchingMachines = normalizedSearch
      ? visibleMachines.filter((machine) =>
          [
            machine.id,
            machine.title,
            machine.nickname,
            machine.serial_number,
            machine.anydesk_id,
            machine.client?.company,
            getMachinePatchVersion(machine),
            getMachinePatchNumber(machine),
          ].some((value) =>
            String(value || "")
              .toLowerCase()
              .includes(normalizedSearch),
          ),
        )
      : visibleMachines;

    return [...matchingMachines].sort((left, right) => {
      const leftHasCabinet = Boolean(
        left.client?.id && cabinetClients.has(Number(left.client.id)),
      );
      const rightHasCabinet = Boolean(
        right.client?.id && cabinetClients.has(Number(right.client.id)),
      );
      return Number(rightHasCabinet) - Number(leftHasCabinet);
    });
  }, [cabinetClients, search, visibleMachines]);

  return (
    <>
      <NextSeo title="Admin Fleet" noindex nofollow />
      <Box minH="100vh" bg="bg.1000" color="bg.100">
        <AdminHeader title="Machine fleet" />

        <Box
          maxW="1600px"
          mx="auto"
          px={{ base: 3, md: 6 }}
          py={{ base: 4, md: 6 }}
        >
          <Flex
            mb="4"
            gap="3"
            align={{ base: "stretch", sm: "center" }}
            direction={{ base: "column", sm: "row" }}
            justify="space-between"
          >
            <InputGroup maxW={{ base: "full", sm: "420px" }} size="md">
              <InputLeftElement pointerEvents="none" color="bg.400">
                <FiSearch />
              </InputLeftElement>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search machines"
                aria-label="Search machines"
                bg="bg.900"
                borderColor="whiteAlpha.200"
                borderRadius="12px"
                _placeholder={{ color: "bg.500" }}
                _focusVisible={{ borderColor: "acid.300", boxShadow: "none" }}
              />
            </InputGroup>
            <Text color="bg.400" fontSize="sm" flexShrink="0">
              {filteredMachines.length} of {visibleMachines.length} machines
            </Text>
          </Flex>

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

          <Grid
            templateColumns={{
              base: "1fr",
              md: "repeat(2, minmax(0, 1fr))",
              lg: "repeat(4, minmax(0, 1fr))",
            }}
            gap={{ base: "4", md: "5" }}
          >
            {filteredMachines.map((machine) => {
              const canOpenCabinet = Boolean(
                machine.client?.id &&
                cabinetClients.has(Number(machine.client.id)),
              );
              return (
                <MachineCard
                  key={machine.id}
                  machine={machine}
                  canOpenCabinet={canOpenCabinet}
                  disableCabinet={openingMachine !== null}
                  latestPatchVersion={latestPatchVersion}
                  isOpening={openingMachine === String(machine.id)}
                  readinessReferenceTime={readinessReferenceTime}
                  onCopySerial={copySerial}
                  onOpenCabinet={openCabinet}
                  onShowPatch={showPatch}
                />
              );
            })}
          </Grid>

          {!filteredMachines.length ? (
            <Flex
              minH="220px"
              align="center"
              justify="center"
              direction="column"
              color="bg.400"
              textAlign="center"
              gap="2"
            >
              <FiMonitor size="28px" />
              <Text>No machines match your search.</Text>
            </Flex>
          ) : null}
        </Box>

        <Modal
          isOpen={selectedPatch !== null}
          onClose={() => setSelectedPatch(null)}
          isCentered
          scrollBehavior="inside"
          size="lg"
        >
          <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(4px)" />
          <ModalContent
            bg="bg.900"
            border="1px solid"
            borderColor="whiteAlpha.200"
            mx="3"
            borderRadius="16px"
          >
            <ModalHeader color="bg.50">
              Patch {selectedPatch?.version || "not reported"}
            </ModalHeader>
            <ModalCloseButton color="bg.300" />
            <ModalBody pb="6">
              {selectedPatch?.patch ? (
                <>
                  <Badge
                    colorScheme={
                      selectedPatch.patch.isStable ? "green" : "orange"
                    }
                    borderRadius="full"
                    px="2.5"
                    py="1"
                    mb="4"
                    textTransform="none"
                  >
                    {selectedPatch.patch.isStable ? "Stable" : "Unstable"}
                  </Badge>
                  <PatchDescription
                    description={selectedPatch.patch.fix_summary}
                  />
                </>
              ) : (
                <Text color="bg.400">
                  No matching patch description was found.
                </Text>
              )}
            </ModalBody>
            <ModalFooter borderTop="1px solid" borderColor="whiteAlpha.100">
              <Button
                as={Link}
                href="/admin/patches"
                variant="primary"
                w={{ base: "full", sm: "auto" }}
                onClick={() => setSelectedPatch(null)}
              >
                See all patches
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Box>
    </>
  );
}
