import { Alert, AlertIcon, Box, Text, VStack } from "@chakra-ui/react";
import type { MachineHealthIndicator } from "../../../types/machineHealth";
import type { Machine } from "../../../types/strapi";
import { RemoteAccessContent } from "../machines/RemoteAccessDialog";

const statusExplanation = (indicator?: MachineHealthIndicator) => {
  switch (indicator?.label) {
    case "Stale":
      return {
        status: "warning" as const,
        title: "Why this status is Stale",
        description:
          "The portal has not received a fresh remote-access update from this machine in more than 10 minutes. Stale does not mean the machine is offline—it only means the live status cannot be confirmed yet. RustDesk may still connect.",
      };
    case "Starting":
      return {
        status: "info" as const,
        title: "The machine is starting",
        description:
          "The kiosk app recently restarted and has not completed its first status check. If another live source confirms the connection, this changes to Online automatically.",
      };
    case "Offline":
      return {
        status: "error" as const,
        title: "Remote access is Offline",
        description:
          "The latest checks could not reach the machine. Check its power and internet connection before trying RustDesk.",
      };
    case "App down":
    case "App error":
      return {
        status: "error" as const,
        title: indicator.label,
        description:
          "The machine is reporting a kiosk-app problem. Its internet connection may still be available, so RustDesk can still be tried below.",
      };
    case "Online":
      return {
        status: "success" as const,
        title: "Remote access is Online",
        description:
          "The portal has recently confirmed a connection to this machine.",
      };
    default:
      return {
        status: "info" as const,
        title: "Remote-access status is unavailable",
        description:
          "The portal does not have enough recent information to confirm this machine's connection. RustDesk may still connect.",
      };
  }
};

const formatUpdateTime = (at?: string | null) => {
  if (!at) return null;
  const timestamp = Date.parse(at);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toLocaleString();
};

export function WifiDialogContent({
  machine,
  indicator,
}: {
  machine: Machine;
  indicator?: MachineHealthIndicator;
}) {
  const explanation = statusExplanation(indicator);
  const updatedAt = formatUpdateTime(indicator?.at);

  return (
    <VStack spacing="5" align="stretch">
      <Alert status={explanation.status} alignItems="flex-start" borderRadius="md">
        <AlertIcon mt="0.5" />
        <Box>
          <Text fontWeight="800">{explanation.title}</Text>
          <Text mt="1" fontSize="sm">
            {explanation.description}
          </Text>
          {updatedAt ? (
            <Text mt="2" color="bg.300" fontSize="xs">
              Last status update: {updatedAt}
            </Text>
          ) : null}
        </Box>
      </Alert>

      <RemoteAccessContent machine={machine} />
    </VStack>
  );
}
