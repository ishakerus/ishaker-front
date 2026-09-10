import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormLabel,
  HStack,
  Input,
  InputGroup,
  InputRightElement,
  Select,
  SimpleGrid,
  VStack,
  Text,
  Wrap,
  WrapItem,
  Grid,
  IconButton,
} from "@chakra-ui/react";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useState } from "react";
import { FiTrash2 } from "react-icons/fi";
import { PortalShell } from "../components/portal/PortalShell";
import { requirePortalSession } from "../lib/portal/auth";
import { requestStrapiRestAsService } from "../services/server/strapiClient";
import type { PortalSession, PromoCode } from "../types/portal";
import { formatMoney, getCurrencySymbol } from "../lib/portal/currency";
import { hasPromoCodeScopeConflict } from "../lib/portal/promoScope";
import {
  formatPromoCountdown,
  getPromoEndTime,
  getPromoStartTime,
  isPromoExpired,
  PromoEndShortcut,
  PromoStartShortcut,
  toDateTimeLocalValue,
} from "../lib/portal/promoDates";
import { Box3D } from "../styles/theme/custom";

const START_SHORTCUTS: Array<{ label: string; value: PromoStartShortcut }> = [
  { label: "now", value: "now" },
  { label: "next noon", value: "next-noon" },
  { label: "next midnight", value: "next-midnight" },
  { label: "after 1h", value: "after-1h" },
];

const END_SHORTCUTS: Array<{ label: string; value: PromoEndShortcut }> = [
  { label: "10 min", value: "10m" },
  { label: "6h", value: "6h" },
  { label: "24h", value: "24h" },
  { label: "3 days", value: "3d" },
  { label: "one week", value: "1w" },
  { label: "one month", value: "1mo" },
];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const padTime = (value: number) => String(value).padStart(2, "0");

const formatPromoDate = (value: string, useLocalTime = false) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  const day = useLocalTime ? date.getDate() : date.getUTCDate();
  const month = useLocalTime ? date.getMonth() : date.getUTCMonth();
  const year = useLocalTime ? date.getFullYear() : date.getUTCFullYear();
  const hours = useLocalTime ? date.getHours() : date.getUTCHours();
  const minutes = useLocalTime ? date.getMinutes() : date.getUTCMinutes();
  return `${day} ${MONTH_NAMES[month]} ${year} ${padTime(hours)}:${padTime(minutes)}`;
};

const getErrorMessage = (payload: any) => {
  if (typeof payload?.message === "string" && payload.message)
    return payload.message;
  if (typeof payload?.details === "string" && payload.details)
    return payload.details;

  if (payload?.details && typeof payload.details === "object") {
    try {
      return JSON.stringify(payload.details);
    } catch {
      return "Promo code could not be created.";
    }
  }

  return "Promo code could not be created.";
};

type PromosPageProps = {
  session: PortalSession;
  promos: PromoCode[];
  serverNow: number;
  loadError?: string;
};

export default function PromosPage({
  session,
  promos,
  serverNow,
  loadError,
}: PromosPageProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [machineId, setMachineId] = useState("");
  const [discountType, setDiscountType] = useState<"PERCENT" | "FIXED">(
    "PERCENT",
  );
  const [amount, setAmount] = useState("");
  const [qty, setQty] = useState("100");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState("");
  const [currentTime, setCurrentTime] = useState(serverNow);
  const [useLocalDates, setUseLocalDates] = useState(false);
  const globalCurrency =
    session.client.currency || session.machines[0]?.currency || null;
  const currencySymbol = getCurrencySymbol(globalCurrency);

  useEffect(() => {
    setUseLocalDates(true);
    setCurrentTime(Date.now());
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const updateStartAt = (value: string) => {
    setStartAt(value);
    if (endAt && new Date(endAt).getTime() <= new Date(value).getTime())
      setEndAt("");
  };

  const applyStartShortcut = (shortcut: PromoStartShortcut) => {
    updateStartAt(toDateTimeLocalValue(getPromoStartTime(shortcut)));
  };

  const applyEndShortcut = (shortcut: PromoEndShortcut) => {
    const date = getPromoEndTime(startAt, shortcut);
    if (date) setEndAt(toDateTimeLocalValue(date));
  };

  const revokePromo = async (promo: PromoCode) => {
    if (
      !window.confirm(
        `Revoke promo code “${promo.code}”? It will no longer be accepted by machines.`,
      )
    ) {
      return;
    }

    const id = String(promo.id);
    setRevokeError("");
    setRevokingId(id);
    try {
      const response = await fetch(
        `/api/portal/promos/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || "Promo code could not be revoked.");
      }
      await router.replace(router.asPath);
    } catch (revokeFailure) {
      setRevokeError(
        revokeFailure instanceof Error
          ? revokeFailure.message
          : "Promo code could not be revoked.",
      );
    } finally {
      setRevokingId(null);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (hasPromoCodeScopeConflict(promos, code, machineId || null)) {
      setError(
        machineId
          ? "This promo code already exists on the selected machine."
          : "This promo code overlaps an existing promo on one or more machines.",
      );
      return;
    }

    const confirmed = window.confirm(
      "Create this promo code in the live client portal? Clients will be able to use it immediately once activated downstream.",
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    const response = await fetch("/api/portal/promos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        code,
        machineId: machineId || null,
        discountType,
        amount: Number(amount),
        qty: Number(qty),
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        notes,
      }),
    });
    setIsSubmitting(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(getErrorMessage(payload));
      return;
    }

    router.replace(router.asPath);
  };

  return (
    <PortalShell
      title="Promos"
      description="Use promo codes to give discounts to your clients. "
      clientName={session.client.company}
    >
      <SimpleGrid columns={{ base: 1, xl: 2 }} spacing="6">
        <Box
          bg="bg.900"
          border="1px solid"
          borderColor="whiteAlpha.100"
          borderRadius="2xl"
          p={{ base: "4", md: "6" }}
        >
          <VStack spacing="4" align="stretch">
            <Text color="acid.300" fontWeight="800">
              Existing promo codes
            </Text>
            {loadError ? <Text color="orange.200">{loadError}</Text> : null}
            {revokeError ? <Text color="red.300">{revokeError}</Text> : null}
            {promos.length ? (
              <VStack
                spacing="4"
                align="stretch"
                maxH="1000px"
                overflowY="auto"
                pr={{ base: "0", md: "2" }}
              >
                {promos.map((promo) => (
                  <Box3D
                    variant="no_contrast"
                    p={{ base: "3", sm: "4" }}
                    minW="0"
                    key={promo.id}
                  >
                    <Grid
                      gridTemplateColumns={{
                        base: "minmax(0, 1fr)",
                        sm: "minmax(0, 1fr) auto",
                      }}
                      gap={{ base: "3", sm: "4" }}
                      alignItems="start"
                    >
                      <Box minW="0">
                        <HStack
                          spacing="2"
                          align="flex-start"
                          flexWrap="wrap"
                        >
                          <Text
                            color="bg.50"
                            fontWeight="800"
                            fontSize={{ base: "lg", sm: "2xl" }}
                            lineHeight="short"
                            overflowWrap="anywhere"
                          >
                            {promo.title || "Untitled promo"}
                          </Text>
                          {promo.status === "cancelled" ? (
                            <Text
                              color="red.300"
                              fontSize="md"
                              fontWeight="700"
                            >
                              Revoked
                            </Text>
                          ) : promo.status === "expired" ||
                            isPromoExpired(promo.end_at, currentTime) ? (
                            <Text
                              color="orange.300"
                              fontSize="md"
                              fontWeight="700"
                            >
                              Expired
                            </Text>
                          ) : (
                            <IconButton
                              size="xs"
                              aria-label="Revoke promo code"
                              minH="8"
                              minW="8"
                              colorScheme="red"
                              variant="outline"
                              isLoading={revokingId === String(promo.id)}
                              isDisabled={Boolean(revokingId)}
                              onClick={() => void revokePromo(promo)}
                            >
                              <FiTrash2 size="1.2rem" />
                            </IconButton>
                          )}
                        </HStack>
                        <Text color="bg.200" fontWeight="700">
                          {promo.status === "cancelled"
                            ? ""
                            : formatPromoCountdown(
                                promo.start_at,
                                promo.end_at,
                                currentTime,
                              ) || ""}
                        </Text>
                        <Text color="bg.300">
                          {promo.discount_type === "PERCENT"
                            ? `${promo.amount}% off • ${promo.used_count ?? 0} of ${promo.qty ?? "\u221e"} used`
                            : `${formatMoney(
                                promo.amount,
                                promo.machine?.currency ||
                                  session.client.currency ||
                                  session.machines[0]?.currency,
                            )} off • ${promo.used_count ?? 0} of ${promo.qty ?? "\u221e"} used`}
                        </Text>
                        <Text color="bg.400" fontSize="sm">
                          {promo.machine
                            ? promo.machine.title ||
                              promo.machine.serial_number ||
                              `Machine #${promo.machine.id}`
                            : "All machines"}
                        </Text>
                      </Box>
                      <Box
                        minW={{ base: "0", sm: "100px" }}
                        w={{ base: "full", sm: "auto" }}
                      >
                        <Box3D
                          mb="2"
                          variant={
                            promo.status === "cancelled" ||
                            promo.status === "expired" ||
                            isPromoExpired(promo.end_at, currentTime)
                              ? "no_contrast"
                              : "primary"
                          }
                          p="2"
                          w="100%"
                          boxShadow="lg"
                          borderRadius="md"
                        >
                          <Text
                            color="bg.900"
                            fontWeight="bold"
                            align="center"
                            fontSize="lg"
                            overflowWrap="anywhere"
                          >
                            {promo.code}
                          </Text>
                        </Box3D>
                      </Box>
                    </Grid>

                    <Text
                      color="bg.400"
                      fontSize="xs"
                      lineHeight="short"
                      overflowWrap="anywhere"
                    >
                      {formatPromoDate(promo.start_at, useLocalDates)} to{" "}
                      {formatPromoDate(promo.end_at, useLocalDates)}
                    </Text>

                    {promo.notes?.trim() ? (
                      <Text color="bg.300" mt="2" whiteSpace="pre-wrap">
                        <Text as="span" color="bg.200" fontWeight="700">
                          Notes:{" "}
                        </Text>
                        {promo.notes}
                      </Text>
                    ) : null}
                  </Box3D>
                ))}
              </VStack>
            ) : (
              <Text color="bg.300">No promo codes yet.</Text>
            )}
          </VStack>
        </Box>

        <Box
          as="form"
          onSubmit={onSubmit}
          bg="bg.900"
          border="1px solid"
          borderColor="whiteAlpha.100"
          borderRadius="2xl"
          p={{ base: "4", md: "6" }}
        >
          <VStack spacing="4" align="stretch">
            <Text color="acid.300" fontWeight="800">
              Create a promo code
            </Text>
            <FormControl>
              <FormLabel>Title</FormLabel>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Promo name. Ex: Sunday 50% OFF"
              />
            </FormControl>
            <FormControl>
              <FormLabel>Code</FormLabel>
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="Send this to your clients. Ex: SUNDAY50"
              />
            </FormControl>
            <FormControl>
              <FormLabel>Target machine</FormLabel>
              <Select
                value={machineId}
                onChange={(event) => setMachineId(event.target.value)}
              >
                <option value="">All machines</option>
                {session.machines.map((machine) => (
                  <option key={machine.id} value={machine.id}>
                    {machine.title ||
                      machine.serial_number ||
                      `Machine #${machine.id}`}
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel>Discount</FormLabel>
              <InputGroup>
                <Input
                  value={amount}
                  onChange={(event) => {
                    const nextAmount = event.target.value;
                    setAmount(
                      discountType === "PERCENT" && Number(nextAmount) > 100
                        ? "100"
                        : nextAmount,
                    );
                  }}
                  type="number"
                  min="0"
                  max={discountType === "PERCENT" ? "100" : undefined}
                  step="0.01"
                  pr="7.5rem"
                  placeholder={
                    discountType === "PERCENT"
                      ? "Percent discount"
                      : "Fixed price"
                  }
                />
                <InputRightElement width="7.25rem" pr="1">
                  <ButtonGroup size="xs" isAttached>
                    <Button
                      type="button"
                      minH="7"
                      h="7"
                      minW="12"
                      variant={
                        discountType === "PERCENT" ? "primary" : "outline"
                      }
                      aria-label="Percentage discount"
                      aria-pressed={discountType === "PERCENT"}
                      onClick={() => {
                        setDiscountType("PERCENT");
                        if (Number(amount) > 100) setAmount("100");
                      }}
                    >
                      %
                    </Button>
                    <Button
                      type="button"
                      minH="7"
                      h="7"
                      minW="12"
                      variant={discountType === "FIXED" ? "primary" : "outline"}
                      aria-label={`Fixed discount in ${globalCurrency?.code || "USD"}`}
                      aria-pressed={discountType === "FIXED"}
                      onClick={() => setDiscountType("FIXED")}
                    >
                      {currencySymbol}
                    </Button>
                  </ButtonGroup>
                </InputRightElement>
              </InputGroup>
            </FormControl>
            <FormControl>
              <FormLabel>Cups limit</FormLabel>
              <Input
                value={qty}
                onChange={(event) => setQty(event.target.value)}
                type="number"
                min="1"
                step="1"
                placeholder="Maximum discounted cups"
              />
            </FormControl>
            <FormControl>
              <FormLabel>Starts at</FormLabel>
              <Input
                value={startAt}
                onChange={(event) => updateStartAt(event.target.value)}
                type="datetime-local"
                placeholder="Start date and time"
              />
              <Wrap spacing="2" mt="2">
                {START_SHORTCUTS.map((shortcut) => (
                  <WrapItem key={shortcut.value}>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      borderRadius="full"
                      onClick={() => applyStartShortcut(shortcut.value)}
                    >
                      {shortcut.label}
                    </Button>
                  </WrapItem>
                ))}
              </Wrap>
            </FormControl>
            <FormControl>
              <FormLabel>Ends at</FormLabel>
              <Input
                value={endAt}
                onChange={(event) => setEndAt(event.target.value)}
                type="datetime-local"
                min={startAt || undefined}
                isDisabled={!startAt}
                placeholder="End date and time"
              />
              <Wrap spacing="2" mt="2">
                {END_SHORTCUTS.map((shortcut) => (
                  <WrapItem key={shortcut.value}>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      borderRadius="full"
                      isDisabled={!startAt}
                      onClick={() => applyEndShortcut(shortcut.value)}
                    >
                      {shortcut.label}
                    </Button>
                  </WrapItem>
                ))}
              </Wrap>
            </FormControl>
            <FormControl>
              <FormLabel>Notes</FormLabel>
              <Input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional notes"
              />
            </FormControl>

            {error ? <Text color="red.300">{error}</Text> : null}

            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              isDisabled={!code || !amount || !qty || !startAt || !endAt}
            >
              Create promo code
            </Button>
          </VStack>
        </Box>
      </SimpleGrid>
    </PortalShell>
  );
}

export const getServerSideProps: GetServerSideProps<PromosPageProps> = async (
  context,
) => {
  const result = await requirePortalSession(context);
  if ("redirect" in result) return { redirect: result.redirect };
  const serverNow = Date.now();

  try {
    const params = new URLSearchParams();
    params.set("filters[client][id][$eq]", String(result.session.client.id));
    params.set("sort[0]", "start_at:desc");
    params.set("pagination[pageSize]", "2000");
    params.set("populate[machine][populate][currency]", "*");
    const promos = await requestStrapiRestAsService<PromoCode[]>(
      `/api/promo-codes?${params.toString()}`,
    );

    return {
      props: {
        session: result.session,
        promos,
        serverNow,
      },
    };
  } catch (error) {
    console.error("[promos] load failed:", error);

    return {
      props: {
        session: result.session,
        promos: [],
        serverNow,
        loadError:
          "Add the promo-code content type in Strapi to persist and list client promo codes.",
      },
    };
  }
};
