import { Box, Button, Flex, HStack, SimpleGrid, Text } from "@chakra-ui/react";
import Link from "next/link";
import { getMachinePatchVersion } from "../../lib/admin/machinePatch";
import type { Machine } from "../../types/strapi";
import { MachineField } from "./MachineField";
import { MachineTypeIcon } from "./MachineTypeIcon";
import { displayValue } from "./utils";
import { ReadinessBadge } from "./ReadinessBadge";
import { Box3D } from "../../styles/theme/custom";

type MachineCardProps = {
  machine: Machine;
  readinessNow: number;
};

export function MachineCard({ machine, readinessNow }: MachineCardProps) {
  const machineType = machine.machine_type?.name || machine.type;
  const patchVersion = getMachinePatchVersion(machine);

  return (
    <Box3D
      border="1px solid"
      borderColor="whiteAlpha.100"
      borderRadius="8px"
      p={4}
      bg="bg.800"
    >
      <Flex justify="space-between" gap={3} align="flex-start" mb={4}>
        <HStack minW={0} align="center">
          <Flex
            w="36px"
            h="36px"
            borderRadius="8px"
            bg="acid.300"
            color="bg.1000"
            align="center"
            justify="center"
            flexShrink={0}
          >
            <MachineTypeIcon type={machineType} />
          </Flex>
          <Box minW={0}>
            <Text fontWeight="800" color="bg.50" noOfLines={1}>
              {displayValue(machine.title)}
            </Text>
            <Text color="bg.300" fontSize="sm">
              {displayValue(machineType)}
            </Text>
          </Box>
        </HStack>
      </Flex>

      <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
        <MachineField
          label="AnyDesk"
          value={machine.anydesk_id}
          href={
            machine.anydesk_id ? `anydesk:${machine.anydesk_id}` : undefined
          }
        />
        <MachineField label="Serial" value={machine.serial_number} />
        <MachineField label="Tailscale IP" value={machine.tailscale_ip} />
        <MachineField label="Patch version" value={patchVersion} />
        <MachineField
          label="Machine type"
          value={machineType}
          icon={<MachineTypeIcon type={machineType} />}
        />
      </SimpleGrid>

      <Box mt="4" pt="4" borderTop="1px solid" borderColor="whiteAlpha.100">
        <ReadinessBadge readiness={machine.readiness} now={readinessNow} />
        <Button
          as={Link}
          href={`/admin/machines/${machine.id}`}
          size="sm"
          variant="outline"
          borderColor="whiteAlpha.200"
          mt="3"
        >
          Open readiness details
        </Button>
      </Box>
    </Box3D>
  );
}
