import { Badge, Box, HStack, Text, VStack, Wrap, WrapItem } from "@chakra-ui/react";
import { getMachineMixes } from "../../../lib/portal/mix";
import type { PortalMachineCell } from "../../../types/portal";

export function MachineMixesSection({ cells }: { cells: PortalMachineCell[] }) {
  const { mixes, warnings } = getMachineMixes(cells);

  if (!mixes.length && !warnings.length) return null;

  return (
    <Box
      bg="whiteAlpha.50"
      border="1px solid"
      borderColor="whiteAlpha.100"
      borderRadius="xl"
      p="4"
    >
      <Text color="acid.300" fontWeight="800" mb="1">
        Mixes on this machine
      </Text>
      <Text color="bg.400" fontSize="sm" mb="3">
        Both products must be in active containers for the mix to appear on the kiosk.
      </Text>
      {mixes.length ? (
        <VStack align="stretch" spacing="2" mb={warnings.length ? "3" : "0"}>
          {mixes.map((mix) => (
            <HStack
              key={`${mix.addon.id}-${mix.base.id}`}
              bg="bg.900"
              borderRadius="md"
              px="3"
              py="2"
              spacing="2"
              fontSize="sm"
            >
              <Text color="bg.300">Container {mix.basePosition}</Text>
              <Text fontWeight="700">{mix.base.name}</Text>
              <Text color="acid.300">←</Text>
              <Text color="bg.300">Container {mix.addonPosition}</Text>
              <Text fontWeight="700">{mix.addon.name}</Text>
            </HStack>
          ))}
        </VStack>
      ) : null}
      {warnings.length ? (
        <Wrap spacing="2">
          {warnings.map((warning) => (
            <WrapItem key={warning.key} maxW="full">
              <Badge
                colorScheme="orange"
                variant="subtle"
                whiteSpace="normal"
                px="2"
                py="1"
                lineHeight="short"
              >
                {warning.message}
              </Badge>
            </WrapItem>
          ))}
        </Wrap>
      ) : null}
    </Box>
  );
}
