import {
  Alert,
  AlertIcon,
  Box,
  FormControl,
  FormLabel,
  HStack,
  IconButton,
  Input,
  SimpleGrid,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { FormEvent, useState } from "react";
import { FiSave } from "react-icons/fi";
import type { Machine } from "../../../types/strapi";

type MachineRegistrationEditorProps = {
  machine: Machine;
  defaults: {
    country?: string;
    state?: string;
    city?: string;
  };
};

export function MachineRegistrationEditor({
  machine,
  defaults,
}: MachineRegistrationEditorProps) {
  const router = useRouter();
  const toast = useToast();
  const [country, setCountry] = useState(machine.country || defaults.country || "USA");
  const [state, setState] = useState(machine.state_region || defaults.state || "");
  const [city, setCity] = useState(machine.city || defaults.city || "");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    const response = await fetch(`/api/portal/machines/${machine.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        country,
        state,
        city,
      }),
    });
    const payload = await response.json().catch(() => null);
    setIsSaving(false);

    if (!response.ok) {
      setError(payload?.message || "Machine data could not be updated.");
      toast({
        title: "Save failed",
        description: payload?.message || "Machine data could not be updated.",
        status: "error",
      });
      return;
    }

    toast({ title: "Machine data saved", status: "success" });
    await router.replace(router.asPath);
  };

  return (
    <Box
      as="form"
      onSubmit={save}
      bg="bg.900"
      border="1px solid"
      borderColor="whiteAlpha.100"
      borderRadius="2xl"
      p="6"
    >
      <VStack spacing="4" align="stretch">
        <HStack justify="space-between" align="center">
          <Box color="acid.300" fontWeight="800">
            Machine settings
          </Box>
          <IconButton
            type="submit"
            aria-label="Save machine settings"
            icon={<FiSave />}
            variant="primary"
            isLoading={isSaving}
            isDisabled={!country.trim()}
          />
        </HStack>
        <FormControl isRequired>
          <FormLabel>Country</FormLabel>
          <Input value={country} onChange={(event) => setCountry(event.target.value)} />
        </FormControl>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing="4">
          <FormControl>
            <FormLabel>State / region</FormLabel>
            <Input value={state} onChange={(event) => setState(event.target.value)} />
          </FormControl>
          <FormControl>
            <FormLabel>City</FormLabel>
            <Input value={city} onChange={(event) => setCity(event.target.value)} />
          </FormControl>
        </SimpleGrid>
        {error ? (
          <Alert status="error" borderRadius="lg">
            <AlertIcon />
            {error}
          </Alert>
        ) : null}
        <Text color="bg.300" fontSize="sm">
          Applies to the kiosk within 5 minutes. No restart needed.
        </Text>
      </VStack>
    </Box>
  );
}
