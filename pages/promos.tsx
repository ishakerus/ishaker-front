import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormHelperText,
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
  Tooltip,
} from "@chakra-ui/react";
import { FormEvent, useEffect, useState } from "react";
import { FiTrash2 } from "react-icons/fi";
import { MdQrCode2 } from "react-icons/md";
import { PortalShell } from "../components/portal/PortalShell";
import {
  PortalPageContent,
  PortalPageFailure,
  PortalPageLoading,
} from "../components/portal/PortalPageState";
import { PromoQrModal } from "../components/portal/promos/PromoQrModal";
import { usePortalPage } from "../lib/portal/usePortalPage";
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
import { isQrSafePromoCode } from "../lib/portal/promoQr";
import { useCustomDialog } from "../components/shared/CustomDialog";

const INVALID_QR_CODE_MESSAGE =
  "Use only letters, digits, - or _, up to 32 characters.";
const UNSAFE_QR_CODE_TOOLTIP =
  "This code has characters the machine scanner can't read — create a new code with letters, digits, - or _.";

type PromoDisplayStatus = "active" | "scheduled" | "expired" | "revoked";

const PROMO_STATUS_STYLE: Record<
  PromoDisplayStatus,
  { label: string; colorScheme: string }
> = {
  active: { label: "Active", colorScheme: "green" },
  scheduled: { label: "Scheduled", colorScheme: "blue" },
  expired: { label: "Expired", colorScheme: "orange" },
  revoked: { label: "Revoked", colorScheme: "red" },
};

const getPromoDisplayStatus = (
  promo: PromoCode,
  now: number,
): PromoDisplayStatus => {
  if (promo.status === "cancelled") return "revoked";
  if (promo.status === "expired" || isPromoExpired(promo.end_at, now)) {
    return "expired";
  }

  const startsAt = new Date(promo.start_at).getTime();
  if (Number.isFinite(startsAt) && startsAt > now) return "scheduled";
  return "active";
};

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
  if (payload?.error === "invalid_code") return INVALID_QR_CODE_MESSAGE;
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

function PromosPage({
  session,
  promos,
  serverNow,
  loadError,
  onRefresh,
}: PromosPageProps & { onRefresh: () => Promise<unknown> }) {
  const { showConfirm } = useCustomDialog();
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [currentTime, setCurrentTime] = useState(serverNow);
  const [useLocalDates, setUseLocalDates] = useState(false);
  const [qrPromo, setQrPromo] = useState<PromoCode | null>(null);
  const globalCurrency =
    session.client.currency || session.machines[0]?.currency || null;
  const currencySymbol = getCurrencySymbol(globalCurrency);
  const codeHasError = code.length > 0 && !isQrSafePromoCode(code);

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

  const deletePromo = async (promo: PromoCode) => {
    const confirmed = await showConfirm({
      title: "Delete promo code?",
      message: `Permanently delete promo code “${promo.code}”? This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!confirmed) return;

    const id = String(promo.id);
    setDeleteError("");
    setDeletingId(id);
    try {
      const response = await fetch(
        `/api/portal/promos/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || "Promo code could not be deleted.");
      }
      await onRefresh();
    } catch (deleteFailure) {
      setDeleteError(
        deleteFailure instanceof Error
          ? deleteFailure.message
          : "Promo code could not be deleted.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!isQrSafePromoCode(code)) {
      setError(INVALID_QR_CODE_MESSAGE);
      return;
    }

    if (hasPromoCodeScopeConflict(promos, code, machineId || null)) {
      setError(
        machineId
          ? "This promo code already exists on the selected machine."
          : "This promo code overlaps an existing promo on one or more machines.",
      );
      return;
    }

    const confirmed = await showConfirm({
      title: "Create promo code?",
      message:
        "Create this promo code in the live client portal? Clients will be able to use it immediately once activated downstream.",
      confirmLabel: "Create",
      tone: "warning",
    });
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

    void onRefresh();
  };

  return (
    <PortalShell
      title="Promos"
      description="Use promo codes to give discounts to your clients. "
      clientName={session.client.company}
    >
      <SimpleGrid columns={{ base: 1, xl: 2 }} spacing="6">
        <Box
          order={{ base: 2, xl: 1 }}
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
            {deleteError ? <Text color="red.300">{deleteError}</Text> : null}
            {promos.length ? (
              <VStack
                spacing="3"
                align="stretch"
                maxH="1000px"
                overflowY="auto"
                pr={{ base: "0", md: "2" }}
              >
                {promos.map((promo) => {
                  const displayStatus = getPromoDisplayStatus(
                    promo,
                    currentTime,
                  );
                  const statusStyle = PROMO_STATUS_STYLE[displayStatus];
                  const canShowQr =
                    isQrSafePromoCode(promo.code) &&
                    displayStatus !== "expired" &&
                    displayStatus !== "revoked";
                  const qrTooltip = !isQrSafePromoCode(promo.code)
                    ? UNSAFE_QR_CODE_TOOLTIP
                    : canShowQr
                      ? `Show QR code for ${promo.code}`
                      : "QR codes are unavailable for expired or revoked promos.";
                  const countdown =
                    displayStatus === "revoked"
                      ? null
                      : formatPromoCountdown(
                          promo.start_at,
                          promo.end_at,
                          currentTime,
                        );

                  return (
                    <Box3D
                      variant="no_contrast"
                      bg={
                        displayStatus === "revoked"
                          ? "blackAlpha.200"
                          : undefined
                      }
                      p={{ base: "4", sm: "5" }}
                      minW="0"
                      key={promo.id}
                    >
                      <VStack align="stretch" spacing={{ base: "3", sm: "4" }}>
                        <HStack
                          justify="space-between"
                          align="center"
                          spacing="3"
                        >
                          <Text
                            color="bg.50"
                            fontWeight="800"
                            fontSize={{ base: "xl", sm: "2xl" }}
                            lineHeight="short"
                            overflowWrap="anywhere"
                            minW="0"
                          >
                            {promo.title || "Untitled promo"}
                          </Text>
                          <HStack flexShrink="0" spacing="2">
                            <Badge
                              colorScheme={statusStyle.colorScheme}
                              variant="subtle"
                              borderRadius="full"
                              px="2.5"
                              py="1"
                              fontSize="xs"
                              lineHeight="short"
                              textTransform="none"
                            >
                              {statusStyle.label}
                            </Badge>
                            <IconButton
                              size="xs"
                              aria-label={`Delete promo code ${promo.code}`}
                              minH="8"
                              minW="8"
                              colorScheme="red"
                              variant="outline"
                              isLoading={deletingId === String(promo.id)}
                              isDisabled={Boolean(deletingId)}
                              onClick={() => void deletePromo(promo)}
                            >
                              <FiTrash2 size="1.2rem" />
                            </IconButton>
                          </HStack>
                        </HStack>

                        <Grid
                          gridTemplateColumns={{
                            base: "minmax(0, 1fr)",
                            sm: "minmax(0, 1fr) auto",
                          }}
                          gap={{ base: "3", sm: "4" }}
                          alignItems="end"
                        >
                          <VStack minW="0" align="stretch" spacing="1">
                            {countdown ? (
                              <Text color="bg.200" fontWeight="700">
                                {countdown}
                              </Text>
                            ) : null}
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
                            <Text
                              color="bg.400"
                              fontSize="xs"
                              lineHeight="short"
                              overflowWrap="anywhere"
                              pt="1"
                            >
                              {formatPromoDate(promo.start_at, useLocalDates)}{" "}
                              to {formatPromoDate(promo.end_at, useLocalDates)}
                            </Text>
                          </VStack>
                          <HStack
                            align="stretch"
                            spacing="2"
                            minW={{ base: "0", sm: "170px" }}
                            w={{ base: "full", sm: "auto" }}
                          >
                            <Tooltip
                              label={qrTooltip}
                              hasArrow
                              isDisabled={canShowQr}
                            >
                              <Box as="span">
                                <IconButton
                                  aria-label={`Show QR code for ${promo.code}`}
                                  icon={<MdQrCode2 size="1.35rem" />}
                                  h="100%"
                                  minH="10"
                                  minW="12"
                                  borderRadius="lg"
                                  variant="outline"
                                  isDisabled={!canShowQr}
                                  onClick={() => setQrPromo(promo)}
                                />
                              </Box>
                            </Tooltip>
                            <Tooltip label={qrTooltip} hasArrow>
                              <Box as="span" flex="1" minW="0">
                                <Box3D
                                  as="button"
                                  type="button"
                                  aria-label={`Show QR code for ${promo.code}`}
                                  disabled={!canShowQr}
                                  variant={
                                    canShowQr ? "primary" : "no_contrast"
                                  }
                                  px="3"
                                  py="2.5"
                                  w="full"
                                  h="full"
                                  minH="11"
                                  minW="0"
                                  boxShadow="lg"
                                  borderRadius="lg"
                                  cursor={canShowQr ? "pointer" : "not-allowed"}
                                  transition="transform 140ms ease, filter 140ms ease"
                                  _hover={
                                    canShowQr
                                      ? {
                                          transform: "translateY(-1px)",
                                          filter: "brightness(1.05)",
                                        }
                                      : undefined
                                  }
                                  _active={
                                    canShowQr
                                      ? { transform: "translateY(0)" }
                                      : undefined
                                  }
                                  _focusVisible={{
                                    outline: "2px solid",
                                    outlineColor: "acid.200",
                                    outlineOffset: "2px",
                                  }}
                                  onClick={() => setQrPromo(promo)}
                                >
                                  <Text
                                    as="span"
                                    display="block"
                                    color={canShowQr ? "bg.900" : "bg.300"}
                                    fontWeight="bold"
                                    textAlign="center"
                                    fontSize="lg"
                                    overflowWrap="anywhere"
                                  >
                                    {promo.code}
                                  </Text>
                                </Box3D>
                              </Box>
                            </Tooltip>
                          </HStack>
                        </Grid>

                        {promo.notes?.trim() ? (
                          <Text
                            color="bg.300"
                            pt="3"
                            borderTop="1px solid"
                            borderColor="whiteAlpha.100"
                            whiteSpace="pre-wrap"
                          >
                            <Text as="span" color="bg.200" fontWeight="700">
                              Notes:{" "}
                            </Text>
                            {promo.notes}
                          </Text>
                        ) : null}
                      </VStack>
                    </Box3D>
                  );
                })}
              </VStack>
            ) : (
              <Text color="bg.300">No promo codes yet.</Text>
            )}
          </VStack>
        </Box>

        <Box
          order={{ base: 1, xl: 2 }}
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
            <FormControl isInvalid={codeHasError}>
              <FormLabel>Code</FormLabel>
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="Send this to your clients. Ex: SUNDAY50"
              />
              <FormHelperText>
                Use letters, digits, - and _, up to 32 characters.
              </FormHelperText>
              <FormErrorMessage>{INVALID_QR_CODE_MESSAGE}</FormErrorMessage>
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
              isDisabled={
                !code || codeHasError || !amount || !qty || !startAt || !endAt
              }
            >
              Create promo code
            </Button>
          </VStack>
        </Box>
      </SimpleGrid>
      <PromoQrModal
        promo={qrPromo}
        isOpen={Boolean(qrPromo)}
        onClose={() => setQrPromo(null)}
        fallbackCurrency={globalCurrency}
      />
    </PortalShell>
  );
}

export default function PromosRoute() {
  const { data, error, mutate } = usePortalPage<PromosPageProps>(
    "/api/portal/promos/bootstrap",
    { refreshInterval: 120_000 },
  );

  if (error) {
    return (
      <PortalPageFailure
        label="Promos"
        error={error}
        retry={() => void mutate()}
        notFoundLabel="Promos not found"
        backHref="/machines"
        backLabel="Back to machines"
      />
    );
  }
  if (!data) return <PortalPageLoading label="Promos" />;

  return (
    <PortalPageContent session={data.session}>
      <PromosPage {...data} onRefresh={() => mutate()} />
    </PortalPageContent>
  );
}
