import {
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { type FormEvent, useRef, useState } from "react";
import { FiEdit2 } from "react-icons/fi";
import { fetchJsonWithTimeout } from "../../../lib/http/fetchJsonWithTimeout";
import { MACHINE_TITLE_MAX_LENGTH } from "../../../lib/portal/machineName";
import type { Machine } from "../../../types/strapi";

type MachineNameEditorProps = {
  machine: Pick<Machine, "id" | "title">;
  onSaved: (title: string) => void;
};

const saveErrorMessage = "Machine name could not be updated. Please try again.";

export function MachineNameEditor({ machine, onSaved }: MachineNameEditorProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const open = () => {
    setTitle(machine.title || "");
    setError("");
    onOpen();
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    const nextTitle = title.trim();
    if (!nextTitle || nextTitle.length > MACHINE_TITLE_MAX_LENGTH) {
      setError(`Enter a machine name between 1 and ${MACHINE_TITLE_MAX_LENGTH} characters.`);
      return;
    }

    setError("");
    setIsSaving(true);
    try {
      const { response, payload } = await fetchJsonWithTimeout(`/api/portal/machines/${machine.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: nextTitle }),
      });
      if (!response.ok || typeof payload?.machine?.title !== "string") {
        throw new Error(payload?.message || saveErrorMessage);
      }

      onSaved(payload.machine.title);
      onClose();
      toast({ title: "Machine name saved", status: "success" });
    } catch (error) {
      setError(error instanceof Error && !(error instanceof TypeError) ? error.message : saveErrorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <IconButton
        aria-label={`Edit name for ${machine.title || `machine ${machine.id}`}`}
        title="Edit machine name"
        icon={<FiEdit2 />}
        variant="ghost"
        size="sm"
        color="bg.300"
        flexShrink={0}
        onClick={open}
      />
      <Modal
        isOpen={isOpen}
        onClose={isSaving ? () => undefined : onClose}
        initialFocusRef={inputRef}
        closeOnOverlayClick={!isSaving}
        closeOnEsc={!isSaving}
        isCentered
      >
        <ModalOverlay />
        <ModalContent as="form" onSubmit={save} bg="bg.900" color="bg.50" mx="4">
          <ModalHeader>Edit machine name</ModalHeader>
          <ModalCloseButton isDisabled={isSaving} />
          <ModalBody>
            <FormControl isRequired isInvalid={Boolean(error)}>
              <FormLabel>Machine name</FormLabel>
              <Input
                ref={inputRef}
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setError("");
                }}
                onFocus={(event) => event.target.select()}
                maxLength={MACHINE_TITLE_MAX_LENGTH}
                isDisabled={isSaving}
              />
              <FormErrorMessage>{error}</FormErrorMessage>
            </FormControl>
          </ModalBody>
          <ModalFooter gap="3">
            <Button variant="ghost" onClick={onClose} isDisabled={isSaving}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSaving}
              loadingText="Saving"
              isDisabled={!title.trim() || title.trim() === (machine.title || "").trim()}
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
