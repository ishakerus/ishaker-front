import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Input,
  InputGroup,
  InputRightElement,
  Link,
  SimpleGrid,
  VStack,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import Image from "next/image";
import { useRouter } from "next/router";
import { ChangeEvent, useEffect, useState } from "react";
import { FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  clearMachineLookup,
  fetchMachineBySerial,
} from "../../redux/strapiSlice";
import {
  loadRegistrationDraft,
  mergeRegistrationDraft,
} from "../../lib/portal/registration";
import CustomTitle from "../home/CutsomTitle";
import Loader from "../shared/Loader";
import { WHATSAPP_SUPPORT_URL } from "../../lib/portal/support";
import { getMachineSerialBase } from "../../lib/portal/machineSerial";
import { getDefaultMachineTitle } from "../../lib/portal/machineName";

const SERIAL_DEBOUNCE_MS = 3000;

type ExistingAccount = {
  clientId: string | number;
  nickname: string;
  country?: string;
  state?: string;
  city?: string;
};

export function SerialNumberSection({
  existingAccount,
}: {
  existingAccount?: ExistingAccount | null;
}) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const {
    selectedMachine,
    selectedClient,
    serialLookupStatus,
    serialLookupError,
  } = useAppSelector((state) => state.strapi);

  const [serial, setSerial] = useState("");
  const [isDebouncing, setIsDebouncing] = useState(false);

  const panelBg = useColorModeValue("bg.10", "bg.800");
  const borderColor = useColorModeValue("blackAlpha.100", "whiteAlpha.100");
  const muted = useColorModeValue("bg.600", "bg.300");
  const headingColor = useColorModeValue("bg.1000", "bg.50");
  const successColor = useColorModeValue("green.600", "green.300");
  const errorColor = useColorModeValue("red.600", "red.300");

  const trimmedSerial = serial.trim();
  const isSearching = isDebouncing || serialLookupStatus === "loading";
  const assignedClientId = selectedMachine?.client?.id;
  const isOwnedByExistingAccount =
    Boolean(existingAccount) &&
    Boolean(assignedClientId) &&
    String(assignedClientId) === String(existingAccount?.clientId);
  const canClaimMachine = existingAccount
    ? !assignedClientId || isOwnedByExistingAccount
    : !assignedClientId;
  const canContinue =
    serialLookupStatus === "found" &&
    Boolean(selectedMachine) &&
    canClaimMachine;

  useEffect(() => {
    if (existingAccount) {
      mergeRegistrationDraft({
        nickname: existingAccount.nickname,
        company: existingAccount.nickname,
        clientId: existingAccount.clientId,
        country: existingAccount.country || "USA",
        state: existingAccount.state || "",
        city: existingAccount.city || "",
        existingAccount: true,
      });
      return;
    }

    if (!loadRegistrationDraft()?.nickname) {
      void router.replace("/get-started");
    }
  }, [existingAccount, router]);

  useEffect(() => {
    if (!trimmedSerial) {
      setIsDebouncing(false);
      dispatch(clearMachineLookup());
      return;
    }

    setIsDebouncing(true);
    const timeout = window.setTimeout(() => {
      setIsDebouncing(false);
      dispatch(fetchMachineBySerial(trimmedSerial));
    }, SERIAL_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [dispatch, trimmedSerial]);

  const handleSerialChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSerial(event.target.value.replace(/\D/g, ""));
    dispatch(clearMachineLookup());
  };

  const handleNext = () => {
    if (!canContinue || !selectedMachine) return;
    const draft = loadRegistrationDraft();
    const defaultTitle = getDefaultMachineTitle(
      selectedMachine.id,
      selectedMachine.machine_type?.name,
    );
    mergeRegistrationDraft({
      machineId: selectedMachine.id,
      serialNumber: getMachineSerialBase(
        selectedMachine?.serial_number || trimmedSerial,
      ),
      machineTitle:
        String(draft?.machineId) === String(selectedMachine.id)
          ? draft?.machineTitle || defaultTitle
          : defaultTitle,
      machineTypeName: selectedMachine?.machine_type?.name,
      ...(existingAccount
        ? {
            clientId: existingAccount.clientId,
            company: existingAccount.nickname,
            nickname: existingAccount.nickname,
            existingAccount: true,
          }
        : {}),
    });
    router.push("/step2");
  };

  return (
    <Container maxW="7xl" py={{ base: "10", md: "16" }}>
      <SimpleGrid
        columns={{ base: 1, lg: 2 }}
        spacing={{ base: "8", lg: "12" }}
        alignItems="center"
      >
        <VStack spacing="5" maxW="xl" align="stretch">
          <Text
            fontSize="sm"
            letterSpacing="0.08em"
            textTransform="uppercase"
            color="acid.300"
            fontWeight="700"
          >
            Step 1
          </Text>
          <CustomTitle
            as="h1"
            title="Add your machine serial number"
            subtitle="The number can be found on the back of the machine door"
            fontSize={{ base: "3xl", md: "4xl" }}
            textAlign="left"
            mt="0"
            mb="0"
            subtitleProps={{
              mx: "0",
              fontSize: { base: "md", md: "lg" },
              lineHeight: "1.8",
              color: muted,
              fontWeight: "normal",
            }}
          />

          <Box
            bg={panelBg}
            border="1px solid"
            borderColor={borderColor}
            borderRadius="2xl"
            p={{ base: "5", md: "6" }}
          >
            <FormControl>
              <FormLabel color={headingColor} fontWeight="600">
                Serial number
              </FormLabel>
              <InputGroup size="lg">
                <Input
                  value={serial}
                  onChange={handleSerialChange}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Enter numbers only"
                  bg="whiteAlpha.50"
                  borderColor={borderColor}
                  pr="12"
                  _hover={{ borderColor: "acid.300" }}
                  _focusVisible={{
                    borderColor: "acid.300",
                    boxShadow: "0 0 0 1px var(--chakra-colors-acid-300)",
                  }}
                />
                {isSearching ? (
                  <InputRightElement>
                    <Loader size="sm" />
                  </InputRightElement>
                ) : canContinue ? (
                  <InputRightElement color={successColor}>
                    <FaCheckCircle aria-label="Machine found" />
                  </InputRightElement>
                ) : serialLookupStatus === "notFound" ||
                  serialLookupStatus === "failed" ? (
                  <InputRightElement color={errorColor}>
                    <FaTimesCircle aria-label="Machine not found" />
                  </InputRightElement>
                ) : null}
              </InputGroup>
            </FormControl>
            <Button
              mt="5"
              size="lg"
              w="full"
              variant="primary"
              isDisabled={!canContinue}
              onClick={handleNext}
            >
              Next
            </Button>
            {selectedMachine ? (
              <VStack spacing="1" mt="4" align="stretch">
                <Text color={headingColor} fontWeight="700">
                  {getDefaultMachineTitle(
                    selectedMachine.id,
                    selectedMachine.machine_type?.name,
                  )}
                </Text>
                <Text color={muted} fontSize="sm">
                  Serial: {selectedMachine.serial_number}
                </Text>
                {selectedClient?.company ? (
                  <Text color={muted} fontSize="sm">
                    This machine is already registered to: {selectedClient.company}
                  </Text>
                ) : null}
                {!canClaimMachine ? (
                  <Text color={errorColor} fontSize="sm" fontWeight="700">
                    {existingAccount
                      ? "This machine belongs to a different account."
                      : "Sign in to the existing account to manage this machine."}
                  </Text>
                ) : null}
              </VStack>
            ) : null}
            {serialLookupError === "serial_number_issue" ? (
              <Text color={errorColor} fontSize="sm" fontWeight="700" mt="4">
                This machine has a serial number issue. Please{" "}
                <Link
                  href={WHATSAPP_SUPPORT_URL}
                  isExternal
                  textDecoration="underline"
                >
                  contact support on WhatsApp
                </Link>
                .
              </Text>
            ) : null}
          </Box>
        </VStack>

        <Box
          position="relative"
          minH={{ base: "320px", md: "520px" }}
          borderRadius="2xl"
          overflow="hidden"
          border="1px solid"
          borderColor={borderColor}
          boxShadow="0 26px 80px rgba(0,0,0,0.35)"
        >
          <Image
            src="/backdoor.png"
            alt="Back of the machine door with serial number location"
            fill
            priority
            sizes="(max-width: 992px) 100vw, 50vw"
            style={{ objectFit: "cover" }}
          />
        </Box>
      </SimpleGrid>
    </Container>
  );
}
