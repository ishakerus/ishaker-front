import {
  Alert, AlertIcon, Box, Button, FormControl, FormHelperText, FormLabel,
  Heading, HStack, Input, LinkBox, LinkOverlay, Skeleton, SimpleGrid, Table, TableContainer,
  Tbody, Td, Text, Th, Thead, Tr, VStack, useToast,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter,
} from "@chakra-ui/react";
import NextLink from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "../../components/admin";
import { subscriptionSearchResults, type AdminSubscriptionMachine, subscriptionClientHref, subscriptionMachineSummary, filterSubscriptionMachines, type SubscriptionMachineFilter, clientOptionLabel, localDateTimeValue, subscriptionStartShortcut, type SubscriptionStartShortcut, type AdminSubscriptionClient } from "../../lib/admin/subscriptions";
import { SubscriptionBadge, SubscriptionPaymentBadge, subscriptionStatusDescription } from "./SubscriptionBadge";
import { useCustomDialog } from "../../components/shared/CustomDialog";

const formatDate = (value: string | null | undefined) => value ? new Date(value).toLocaleString() : "Not set";
type PlanAction = "start" | "cancel" | "resume" | "sync";
type Machine = NonNullable<AdminSubscriptionClient["machines"]>[number];

const stateLabels = { expired: "Expired", unpaid: "Awaiting payment", expiring: "Expiring soon", active: "Active", scheduled: "Scheduled", not_activated: "Not activated" };
const stateDescriptions = {
  expired: "The recorded access period has ended.", unpaid: "A plan exists, but no paid-through date has been recorded yet.",
  expiring: "The recorded access period ends within the next five days.", active: "The recorded access period is current.",
  scheduled: "The subscription start or renewal is scheduled for a future date.", not_activated: "No subscription plan has been activated for this machine.",
};
const stateColors = { expired: "red", unpaid: "orange", expiring: "yellow", active: "green", scheduled: "blue", not_activated: "gray" };

function SubscriptionOverview({ clients, loading }: { clients: AdminSubscriptionClient[]; loading: boolean }) {
  const [filter, setFilter] = useState<SubscriptionMachineFilter>("attention");
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const rows = useMemo(() => subscriptionMachineSummary(clients, now), [clients, now]);
  const visible = filterSubscriptionMachines(rows, filter);
  const filters: Array<{ key: SubscriptionMachineFilter; label: string }> = [
    { key: "attention", label: "Expiring & expired" }, { key: "connected", label: "All subscriptions" },
    { key: "not_activated", label: "Not activated" }, { key: "all", label: "All machines" },
  ];
  return <Box>
    <Heading size="md" mb="2">Machine subscriptions</Heading>
    <Text color="bg.300" fontSize="sm" mb="5">Expired and unpaid plans appear first, followed by subscriptions expiring within 5 days.</Text>
    <HStack role="group" aria-label="Filter machine subscriptions" flexWrap="wrap" gap="2" mb="5">
      {filters.map((option) => <Button key={option.key} size="sm" variant={filter === option.key ? "solid" : "outline"} colorScheme={filter === option.key ? "green" : "gray"} aria-pressed={filter === option.key} onClick={() => setFilter(option.key)}>{option.label}<SubscriptionBadge ml="2" description={`Number of machines in the ${option.label.toLowerCase()} filter.`}>{filterSubscriptionMachines(rows, option.key).length}</SubscriptionBadge></Button>)}
    </HStack>
    {loading ? <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing="4">{[1, 2, 3].map((key) => <Skeleton key={key} height="200px" borderRadius="xl" />)}</SimpleGrid>
      : !visible.length ? <Box p="8" bg="bg.900" borderRadius="xl"><Text>{filter === "attention" ? "No expired, unpaid, or soon-expiring subscriptions." : filter === "not_activated" ? "All machines have an activated subscription." : "No machines in this filter."}</Text></Box>
      : <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing="4">
        {visible.map(({ client, machine, until, state, remaining }) => <LinkBox as="article" key={`${client.id}-${machine.id}`} p="5" bg="bg.900" border="1px solid" borderColor="whiteAlpha.200" borderRadius="xl" _hover={{ borderColor: "green.300" }} data-machine-id={machine.id}>
          <HStack justify="space-between" align="start" mb="3"><Heading size="sm">{machine.nickname || machine.title || machine.serial_number || `Machine #${machine.id}`}</Heading><SubscriptionBadge colorScheme={remaining?.color || stateColors[state]} description={stateDescriptions[state]}>{stateLabels[state]}</SubscriptionBadge></HStack>
          <Text color="bg.300" fontSize="sm">{machine.machine_type?.name || "Machine"} · Serial: {machine.serial_number || "Not set"}</Text>
          <LinkOverlay as={NextLink} href={subscriptionClientHref(client.id)} fontWeight="semibold" display="block" mt="4">{clientOptionLabel(client)} →</LinkOverlay>
          {until ? <Text fontSize="sm" mt="3">{client.subscription_billing_enabled && client.subscription_access_until ? "Access until" : "Paid until"}: {formatDate(until)}</Text> : <Text fontSize="sm" mt="3">{state === "scheduled" ? machine.subscription?.stripe_resume_at ? `Resumes: ${formatDate(machine.subscription.stripe_resume_at)}` : `Starts: ${formatDate(machine.subscription?.starts_at)}` : state === "not_activated" ? "No activated subscription plan" : "No paid-through date"}</Text>}
          <SubscriptionPaymentBadge mt="2" subscription={machine.subscription} until={until} accessOverride={Boolean(client.subscription_billing_enabled && client.subscription_access_until)} now={now} />
          <Text fontSize="xs" color="bg.300" mt="3">Restrictions {client.subscription_billing_enabled && client.subscription_restrictions_enabled !== false ? "on" : "off"}</Text>
        </LinkBox>)}
      </SimpleGrid>}
  </Box>;
}

function ClientSelector({ clients, unassignedMachines, value, onNavigate, disabled }: { clients: AdminSubscriptionClient[]; unassignedMachines: AdminSubscriptionMachine[]; value: string; onNavigate: (href: string) => void; disabled: boolean }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const selected = clients.find((client) => String(client.id) === value);
  const options = useMemo(() => subscriptionSearchResults(clients, unassignedMachines, query), [clients, unassignedMachines, query]);
  useEffect(() => {
    if (open && options[highlighted]) document.getElementById(`subscription-search-${options[highlighted].key}`)?.scrollIntoView({ block: "nearest" });
  }, [open, highlighted, options]);
  const choose = (option: ReturnType<typeof subscriptionSearchResults>[number]) => { onNavigate(option.href); setOpen(false); setQuery(""); };
  return <Box position="relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    <Input role="combobox" aria-label="Select client or search by machine" aria-expanded={open} aria-controls="subscription-client-options" aria-autocomplete="list" aria-activedescendant={open && options[highlighted] ? `subscription-search-${options[highlighted].key}` : undefined}
      placeholder="Search nickname, location, machine serial or nickname" isDisabled={disabled}
      value={open ? query : selected ? clientOptionLabel(selected) : ""}
      onFocus={() => { setOpen(true); setQuery(""); setHighlighted(0); }}
      onClick={() => setOpen(true)}
      onChange={(event) => { setQuery(event.target.value); setOpen(true); setHighlighted(0); }}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setHighlighted((index) => Math.max(0, Math.min(options.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))); }
        if (event.key === "Enter" && open && options[highlighted]) { event.preventDefault(); choose(options[highlighted]); }
        if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
      }} />
    {open ? <Box id="subscription-client-options" role="listbox" aria-label="Clients and unregistered machines" position="absolute" top="100%" mt="1" left="0" right="0" zIndex="10" bg="bg.900" border="1px solid" borderColor="whiteAlpha.300" borderRadius="md" maxH="280px" overflowY="auto" boxShadow="xl">
      {options.map((option, index) => <Box key={option.key} id={`subscription-search-${option.key}`} role="option" aria-selected={Boolean(option.clientId && option.clientId === value)} p="3" cursor="pointer" bg={highlighted === index ? "whiteAlpha.200" : undefined} onMouseEnter={() => setHighlighted(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}><NextLink href={option.href} onClick={(event) => { event.stopPropagation(); setOpen(false); setQuery(""); }}>{option.label}{option.unregistered ? <SubscriptionBadge ml="2" colorScheme="orange" description="This machine has no client assigned yet. Open its machine page to view it.">Not registered yet</SubscriptionBadge> : null}</NextLink></Box>)}
      {!options.length ? <Text p="3" color="bg.300">No clients or machines match your search.</Text> : null}
    </Box> : null}
    <Text fontSize="xs" color="bg.300" mt="2">Search by client nickname or location, or by a machine’s serial number or nickname.</Text>
  </Box>;
}

function MachinePlanRow({ machine, enabled, busy, action }: { machine: Machine; enabled: boolean; busy: boolean; action: (action: PlanAction, machineId?: number, priceCents?: number, startsAt?: string | null) => Promise<boolean> }) {
  const { showConfirm } = useCustomDialog();
  const currentPrice = machine.subscription?.stripe_resume_price_cents ?? machine.subscription?.monthly_price_cents ?? machine.machine_type?.subscription_monthly_price_cents ?? 0;
  const [price, setPrice] = useState((currentPrice / 100).toFixed(2));
  useEffect(() => setPrice((currentPrice / 100).toFixed(2)), [currentPrice]);
  const cents = Math.round(Number(price) * 100);
  const validPrice = /^\d+(\.\d{1,2})?$/.test(price) && Number.isSafeInteger(cents) && cents >= 50;
  const [startDate, setStartDate] = useState("");
  const [startOpen, setStartOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<"start" | "resume">("start");
  const [shortcut, setShortcut] = useState<SubscriptionStartShortcut | null>("now");
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const sub = machine.subscription;
  const scheduled = sub?.stripe_status === "scheduled";
  const resumeScheduled = Boolean(sub?.stripe_resume_at);
  const validStart = !startDate || (Number.isFinite(new Date(startDate).getTime()) && new Date(startDate).getTime() > now);
  const exists = resumeScheduled || Boolean(sub?.stripe_status && !["canceled", "incomplete_expired"].includes(sub.stripe_status));
  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  const shortcuts: Array<{ key: SubscriptionStartShortcut; label: string }> = [
    { key: "now", label: "Now" }, { key: "tomorrow", label: "Tomorrow 12am" },
    { key: "in_three_days", label: "In 3 days" }, { key: "next_week", label: "Next week" }, { key: "next_month", label: "Next month" },
  ];
  const createPlan = async () => {
    if (!validStart || !validPrice || busy || !enabled) return;
    if (await action(dialogAction, Number(machine.id), cents, startDate ? new Date(startDate).toISOString() : null)) setStartOpen(false);
  };
  const openPlanDialog = (kind: "start" | "resume") => { setDialogAction(kind); setStartDate(""); setShortcut("now"); setStartOpen(true); };
  const cancelPlan = async () => {
    const message = resumeScheduled ? "Cancel the scheduled renewal? Billing will remain canceled."
      : scheduled ? "Cancel this scheduled plan before it starts? No invoice will be created."
      : "Cancel renewal at the end of the current billing period? Existing paid access and access overrides are preserved.";
    if (!await showConfirm({ title: resumeScheduled ? "Cancel scheduled renewal?" : "Cancel plan renewal?", message, confirmLabel: resumeScheduled ? "Cancel scheduled renewal" : "Cancel renewal", tone: "danger" })) return;
    await action("cancel", Number(machine.id));
  };
  return <Tr>
    <Td>{machine.nickname || machine.title || machine.serial_number || `Machine #${machine.id}`}<Text fontSize="xs" color="bg.300">{machine.machine_type?.name || ""}</Text></Td>
    <Td><Input aria-label={`Plan price for machine ${machine.id}`} type="number" min="0.50" step="0.01" w="110px" value={price} onChange={(event) => setPrice(event.target.value)} isDisabled={!enabled || busy} /><Text fontSize="xs" color="bg.300" mt="1">USD / 30 days</Text>{exists && !scheduled && cents !== currentPrice ? <Text fontSize="xs" color="bg.300" mt="1" maxW="160px" whiteSpace="normal">New price applies after canceling and resuming renewal.</Text> : null}</Td>
    <Td><SubscriptionBadge colorScheme={sub?.stripe_cancel_at_period_end ? "orange" : exists ? "green" : "gray"} description={resumeScheduled ? `Renewal will automatically resume ${formatDate(sub?.stripe_resume_at)} at the selected price.` : sub?.stripe_cancel_at_period_end ? `Automatic renewal is canceled. Any already-paid access keeps its original end date${sub?.ends_at ? `: ${formatDate(sub.ends_at)}` : ""}.` : subscriptionStatusDescription(sub?.stripe_status)}>{resumeScheduled ? "Renewal scheduled" : sub?.stripe_cancel_at_period_end ? "Renewal canceled" : sub?.stripe_status || "Not started"}</SubscriptionBadge><Box mt="2"><SubscriptionPaymentBadge subscription={sub} now={now} /></Box>{resumeScheduled ? <Text fontSize="xs" mt="2">Resumes: {formatDate(sub?.stripe_resume_at)}</Text> : null}{scheduled ? <Text fontSize="xs" mt="2">Starts: {formatDate(sub?.starts_at)}</Text> : null}</Td>
    <Td>{formatDate(sub?.ends_at)}</Td>
    <Td>{formatDate(sub?.stripe_current_period_end)}</Td>
    <Td><VStack align="stretch" spacing="2">
      {!exists ? <Button size="sm" isDisabled={!enabled || busy || !validPrice} onClick={() => openPlanDialog("start")}>Start plan</Button> : <>
        <Button size="sm" variant="outline" colorScheme={sub?.stripe_cancel_at_period_end && !resumeScheduled ? "green" : "red"} isDisabled={!enabled || busy || (!resumeScheduled && sub?.stripe_cancel_at_period_end && !validPrice)} onClick={() => { if (!resumeScheduled && sub?.stripe_cancel_at_period_end) openPlanDialog("resume"); else void cancelPlan(); }}>{resumeScheduled ? "Cancel scheduled renewal" : scheduled ? "Cancel scheduled plan" : sub?.stripe_cancel_at_period_end ? "Resume renewal" : "Cancel renewal"}</Button>
      </>}
    </VStack>
      <Modal isOpen={startOpen} onClose={() => { if (!busy) setStartOpen(false); }} isCentered closeOnOverlayClick={!busy} closeOnEsc={!busy}>
        <ModalOverlay />
        <ModalContent bg="bg.900" color="bg.100" mx="4">
          <ModalHeader>{dialogAction === "resume" ? "Resume renewal" : "Start subscription plan"}</ModalHeader><ModalCloseButton isDisabled={busy} />
          <ModalBody>
            <Text fontWeight="semibold" mb="1">{machine.nickname || machine.title || machine.serial_number || `Machine #${machine.id}`}</Text>
            <Text fontSize="sm" color="bg.300" mb="5">{amount} every 30 days</Text>
            <FormControl isInvalid={!validStart}>
              <FormLabel htmlFor={`plan-start-${machine.id}`}>{dialogAction === "resume" ? "Resume date and time" : "Start date and time"}</FormLabel>
              <Input id={`plan-start-${machine.id}`} type="datetime-local" min={localDateTimeValue(new Date(now))} value={startDate} onChange={(event) => { setStartDate(event.target.value); setShortcut(event.target.value ? null : "now"); }} isDisabled={busy} />
              <FormHelperText color="bg.300">{startDate ? formatDate(new Date(startDate).toISOString()) : "Now"} · {Intl.DateTimeFormat().resolvedOptions().timeZone}</FormHelperText>
            </FormControl>
            <HStack flexWrap="wrap" gap="2" mt="4" mb="3" role="group" aria-label="Start date shortcuts">
              {shortcuts.map((option) => <Button key={option.key} size="sm" variant={shortcut === option.key ? "solid" : "outline"} colorScheme={shortcut === option.key ? "green" : "gray"} aria-pressed={shortcut === option.key} isDisabled={busy} onClick={() => { setStartDate(subscriptionStartShortcut(option.key)); setShortcut(option.key); }}>{option.label}</Button>)}
            </HStack>
            <Text fontSize="xs" color="bg.300" mb="4">Next week: Monday at 12am. Next month: the 1st at 12am.</Text>
            {!validStart ? <Text fontSize="sm" color="red.300" mb="3">Choose a future date or Now.</Text> : null}
            <Text fontSize="sm">{dialogAction === "resume" ? "Renewal resumes at the selected time and price. Existing invoices and paid-through dates stay unchanged. Scheduled renewals are processed automatically within a minute of the selected time." : "The first invoice is created on the selected date. No saved card will be charged automatically."}</Text>
          </ModalBody>
          <ModalFooter gap="3"><Button variant="ghost" isDisabled={busy} onClick={() => setStartOpen(false)}>Cancel</Button><Button colorScheme="green" isLoading={busy} isDisabled={!enabled || !validPrice || !validStart} onClick={() => void createPlan()}>{dialogAction === "resume" ? startDate ? "Schedule renewal" : "Resume renewal" : "Create plan"}</Button></ModalFooter>
        </ModalContent>
      </Modal>
    </Td>
  </Tr>;
}

export default function AdminSubscriptionsPage() {
  const router = useRouter();
  const toast = useToast();
  const [clients, setClients] = useState<AdminSubscriptionClient[]>([]);
  const [unassignedMachines, setUnassignedMachines] = useState<AdminSubscriptionMachine[]>([]);
  const selectedId = typeof router.query.clientId === "string" ? router.query.clientId : "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [planBusy, setPlanBusy] = useState(false);
  const [stripeConfig, setStripeConfig] = useState<{ mode: string } | null>(null);
  const selected = clients.find((client) => String(client.id) === selectedId);


  useEffect(() => {
    if (!router.isReady) return;
    let alive = true;
    const load = async () => {
      try {
        const response = await fetch("/api/admin/subscriptions", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Subscription settings could not be loaded.");
        if (!alive) return;
        setClients(payload.clients || []);
        setUnassignedMachines(payload.unassignedMachines || []);
        setStripeConfig(payload.stripeConfig || null);
      } catch (caught) { if (alive) setError(caught instanceof Error ? caught.message : "Subscription settings could not be loaded."); }
      finally { if (alive) setLoading(false); }
    };
    void load();
    return () => { alive = false; };
  }, [router.isReady]);

  useEffect(() => setError(""), [selectedId]);

  const managePlan = async (action: PlanAction, machineId?: number, priceCents?: number, startsAt?: string | null) => {
    if (!selected) return false;
    setPlanBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/subscriptions/${selected.id}/plan`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, machineId, priceCents, startsAt }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "The plan action could not be completed.");
      const refreshed = await fetch("/api/admin/subscriptions", { cache: "no-store" });
      const data = await refreshed.json();
      if (!refreshed.ok) throw new Error("Plan updated, but the latest details could not be loaded. Refresh this page.");
      setClients(data.clients || []);
      setUnassignedMachines(data.unassignedMachines || []);
      toast({ title: action === "sync" ? "Plans refreshed" : "Plan updated", status: "success" });
      return true;
    } catch (caught) { const message = caught instanceof Error ? caught.message : "The plan action failed."; setError(message); toast({ title: "Plan action failed", description: message, status: "error" }); return false; }
    finally { setPlanBusy(false); }
  };
  const stripeEnabled = Boolean(selected?.status === "client" && stripeConfig);

  return <AdminShell title={selected ? `${selected.company} · Subscriptions` : "Subscriptions"}>
    <Text color="bg.300" mb="6">Find a client or machine to open the client’s subscription page. Review expiring subscriptions below.</Text>
    {error ? <Alert status="error" mb="5" borderRadius="lg"><AlertIcon />{error}</Alert> : null}
    {selectedId ? <Button as={NextLink} href="/admin/subscriptions" variant="ghost" size="sm" mb="4">← All subscriptions</Button> : null}
    <Box p="6" mb="6" bg="bg.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="xl">
      <Heading size="md" mb="4">Find client / machine</Heading>
      <ClientSelector clients={clients} unassignedMachines={unassignedMachines} value={selectedId} onNavigate={(href) => { void router.push(href); }} disabled={loading || planBusy} />
    </Box>
    {!selectedId ? <SubscriptionOverview clients={clients} loading={loading} /> : null}
    {selectedId && !loading && !error && !selected ? <Alert status="warning" borderRadius="lg"><AlertIcon />Client not found. Choose another client above.</Alert> : null}
    {selectedId && loading ? <Skeleton height="280px" borderRadius="xl" /> : null}
    {selected?.machines?.length ? <Box mt="6" p="6" bg="bg.900" borderRadius="xl">
      <HStack justify="space-between" mb="4"><Heading size="md">Existing subscription plans</Heading><Button size="sm" isLoading={planBusy} isDisabled={!stripeEnabled} onClick={() => void managePlan("sync")}>Refresh from Stripe</Button></HStack>
      <Text color="bg.300" fontSize="sm" mb="4">Starting a plan creates an unpaid recurring invoice on its selected start date. Canceling stops renewal at the period end. Edited prices apply when you cancel and resume renewal, or start a new plan.</Text>
      <TableContainer><Table><Thead><Tr><Th>Machine</Th><Th>Plan price</Th><Th>Existing plan</Th><Th>Recorded paid until</Th><Th>Billing period ends</Th><Th>Manage plan</Th></Tr></Thead><Tbody>
        {selected.machines.map((machine) => <MachinePlanRow key={machine.id} machine={machine} enabled={stripeEnabled} busy={planBusy} action={managePlan} />)}
      </Tbody></Table></TableContainer>
    </Box> : null}
    {selected && !selected.machines?.length ? <Text color="bg.300">No machines assigned to this client.</Text> : null}
  </AdminShell>;
}
