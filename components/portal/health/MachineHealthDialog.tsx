import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
} from "@chakra-ui/react";
import type { MachineHealthIndicator } from "../../../types/machineHealth";
import type { Machine } from "../../../types/strapi";
import { CupsDialogContent } from "./CupsDialogContent";
import { DoorLockDialogContent } from "./DoorLockDialogContent";
import { NayaxDialogContent } from "./NayaxDialogContent";
import { PowdersDialogContent } from "./PowdersDialogContent";
import { WaterDialogContent } from "./WaterDialogContent";
import { WifiDialogContent } from "./WifiDialogContent";

export type HealthDialogKind =
  | "wifi"
  | "nayax"
  | "water"
  | "powders"
  | "cups"
  | "lock";

const titles: Record<HealthDialogKind, string> = {
  wifi: "Access your machine remotely",
  nayax: "Nayax payments",
  water: "Water supply",
  powders: "Powder containers",
  cups: "Cup inventory",
  lock: "Machine door lock",
};

export function MachineHealthDialog({
  kind,
  machine,
  onlineStatus,
  onClose,
  onSaved,
}: {
  kind: HealthDialogKind | null;
  machine: Machine;
  onlineStatus?: MachineHealthIndicator;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Modal
      isOpen={Boolean(kind)}
      onClose={onClose}
      isCentered
      size={kind === "powders" ? "2xl" : "lg"}
    >
      <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(4px)" />
      <ModalContent color="bg.50" bg="bg.1000">
        <ModalHeader pr="12">
          {kind ? titles[kind] : "Machine health"}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb="6">
          {kind === "wifi" ? (
            <WifiDialogContent machine={machine} indicator={onlineStatus} />
          ) : null}
          {kind === "nayax" ? <NayaxDialogContent /> : null}
          {kind === "water" ? (
            <WaterDialogContent machine={machine} onSaved={onSaved} />
          ) : null}
          {kind === "powders" ? (
            <PowdersDialogContent
              machine={machine}
              onSaved={onSaved}
              onClose={onClose}
            />
          ) : null}
          {kind === "cups" ? (
            <CupsDialogContent machine={machine} onSaved={onSaved} />
          ) : null}
          {kind === "lock" ? <DoorLockDialogContent machine={machine} /> : null}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
