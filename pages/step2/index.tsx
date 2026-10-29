import {
  Box,
  Button,
  Container,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Select,
  VStack,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { NextSeo } from "next-seo";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Header } from "../../components/home/Header";
import CustomTitle from "../../components/home/CutsomTitle";
import { loadRegistrationDraft, mergeRegistrationDraft } from "../../lib/portal/registration";
import { NICKNAME_HELP } from "../../lib/portal/nickname";
import { getIsoCurrencies } from "../../lib/portal/isoCurrencies";
import type { GetServerSideProps } from "next";
import { requestStrapiRestAsService } from "../../services/server/strapiClient";
import type { Currency } from "../../types/strapi";
import {
  getDefaultMachineTitle,
  MACHINE_TITLE_MAX_LENGTH,
} from "../../lib/portal/machineName";

type Step2PageProps = { currencies: Currency[] };

export default function Step2Page({ currencies }: Step2PageProps) {
  const router = useRouter();
  const pageBg = useColorModeValue("bg.50", "bg.900");
  const borderColor = useColorModeValue("blackAlpha.100", "whiteAlpha.100");
  const panelBg = useColorModeValue("bg.10", "bg.800");
  const muted = useColorModeValue("bg.600", "bg.300");
  const [nickname, setNickname] = useState("");
  const [country, setCountry] = useState("USA");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");
  const [machineTitle, setMachineTitle] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [currencyId, setCurrencyId] = useState("");

  useEffect(() => {
    const draft = loadRegistrationDraft();
    if (!draft?.serialNumber) {
      router.replace("/step1");
      return;
    }

    setNickname(draft.nickname || draft.company || "");
    setCountry(draft.country || "USA");
    setState(draft.state || "");
    setCity(draft.city || "");
    setNotes(draft.notes || "");
    setMachineTitle(
      draft.machineTitle ||
        (draft.machineId
          ? getDefaultMachineTitle(draft.machineId, draft.machineTypeName)
          : ""),
    );
    setSerialNumber(draft.serialNumber);
    const defaultCurrency =
      currencies.find((currency) => currency.code?.toUpperCase() === "USD") ||
      currencies[0];
    setCurrencyId(
      draft.currencyId ? String(draft.currencyId) : defaultCurrency ? String(defaultCurrency.id) : "",
    );
  }, [currencies, router]);

  const handleNext = () => {
    const draft = mergeRegistrationDraft({
      nickname,
      company: nickname,
      country,
      state,
      city,
      notes,
      machineTitle: machineTitle.trim(),
      currencyId,
      currencyCode: currencies.find((currency) => String(currency.id) === currencyId)?.code,
      currencySymbol: currencies.find((currency) => String(currency.id) === currencyId)?.symbol || undefined,
    });
    router.push(draft.existingAccount ? "/step4" : "/step3");
  };

  return (
    <>
      <NextSeo title="Step 2 | Registration" />
      <Box minH="100vh" bg={pageBg}>
        <Header borderColor={borderColor} />
        <Container maxW="5xl" py={{ base: "8", md: "12" }}>
          <VStack spacing="5" maxW="2xl" mb="8" align="stretch">
            <Text fontSize="sm" textTransform="uppercase" color="acid.300" fontWeight="700">
              Step 2
            </Text>
            <CustomTitle
              as="h1"
              title="Confirm the machine and location"
              subtitle="Choose a machine name and confirm its location."
              fontSize={{ base: "3xl", md: "4xl" }}
              textAlign="left"
              mt="0"
              mb="0"
              subtitleProps={{ mx: "0", color: muted }}
            />
          </VStack>

          <VStack spacing="6" align="stretch">
            <Box bg={panelBg} border="1px solid" borderColor={borderColor} borderRadius="2xl" p="6">
              <FormControl isRequired>
                <FormLabel>Machine name</FormLabel>
                <Input
                  value={machineTitle}
                  onChange={(event) => setMachineTitle(event.target.value)}
                  maxLength={MACHINE_TITLE_MAX_LENGTH}
                />
                <FormHelperText>You can change this name later in your client portal.</FormHelperText>
              </FormControl>
              <Text color={muted} mt="3">Serial number: {serialNumber}</Text>
            </Box>

            <Box bg={panelBg} border="1px solid" borderColor={borderColor} borderRadius="2xl" p="6">
              <VStack spacing="4" align="stretch">
                <FormControl isRequired>
                  <FormLabel>Nickname</FormLabel>
                  <Input value={nickname} isReadOnly />
                  <FormHelperText>{NICKNAME_HELP}</FormHelperText>
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Country</FormLabel>
                  <Input
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    placeholder="USA"
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>State / region</FormLabel>
                  <Input
                    value={state}
                    onChange={(event) => setState(event.target.value)}
                    placeholder="NY"
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>City</FormLabel>
                  <Input
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    placeholder="New York"
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Currency</FormLabel>
                  <Select
                    value={currencyId}
                    onChange={(event) => setCurrencyId(event.target.value)}
                    placeholder="Select currency"
                  >
                    {currencies.map((currency) => (
                      <option key={currency.id} value={currency.id}>
                        {currency.code}
                        {currency.name ? ` — ${currency.name}` : ""}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Notes for ops</FormLabel>
                  <Input
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Anything useful before the portal account is approved"
                  />
                </FormControl>
              </VStack>
            </Box>

            <Button
              alignSelf="flex-start"
              variant="primary"
              onClick={handleNext}
              isDisabled={!machineTitle.trim() || !nickname || !country || !state || !city || !currencyId}
            >
              Continue
            </Button>
          </VStack>
        </Container>
      </Box>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Step2PageProps> = async () => {
  const params = new URLSearchParams();
  params.set("filters[isActive][$ne]", "false");
  params.set("sort[0]", "code:ASC");
  params.set("pagination[pageSize]", "2000");
  const storedCurrencies = await requestStrapiRestAsService<Currency[]>(
    `/api/currencies?${params.toString()}`,
  ).catch(() => []);
  const storedByCode = new Map(
    storedCurrencies.map((currency) => [currency.code.toUpperCase(), currency]),
  );
  const isoCodes = new Set<string>();
  const currencies = getIsoCurrencies().map((currency) => {
    isoCodes.add(currency.code);
    return storedByCode.get(currency.code) || currency;
  });

  for (const currency of storedCurrencies) {
    if (!isoCodes.has(currency.code.toUpperCase())) currencies.push(currency);
  }

  currencies.sort((left, right) => left.code.localeCompare(right.code));
  return { props: { currencies } };
};
