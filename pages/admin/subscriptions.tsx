import {
  Alert, AlertIcon, Badge, Box, Button, FormControl, FormHelperText, FormLabel,
  Heading, HStack, Input, Select, SimpleGrid, Switch, Table, TableContainer,
  Tbody, Td, Text, Th, Thead, Tr, VStack, useToast,
} from "@chakra-ui/react";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "../../components/admin";
import { requireAdminSession } from "../../lib/admin/auth";
import { endOfLocalDay, localDateValue, subscriptionPlanStatus, type AdminSubscriptionClient } from "../../lib/admin/subscriptions";
import { useCustomDialog } from "../../components/shared/CustomDialog";

const formatDate = (value: string | null | undefined) => value ? new Date(value).toLocaleString() : "Not set";
type PlanAction = "start" | "cancel" | "resume" | "update_price" | "sync";
type Machine = NonNullable<AdminSubscriptionClient["machines"]>[number];

function MachinePlanRow({ machine, enabled, busy, action }: { machine: Machine; enabled: boolean; busy: boolean; action: (action: PlanAction, machineId?: number, priceCents?: number) => Promise<void> }) {
  const { showConfirm } = useCustomDialog();
  const currentPrice = machine.subscription?.monthly_price_cents ?? machine.machine_type?.subscription_monthly_price_cents ?? 0;
  const [price, setPrice] = useState((currentPrice / 100).toFixed(2));
  useEffect(() => setPrice((currentPrice / 100).toFixed(2)), [currentPrice]);
  const cents = Math.round(Number(price) * 100);
  const validPrice = /^\d+(\.\d{1,2})?$/.test(price) && Number.isSafeInteger(cents) && cents >= 50;
  const sub = machine.subscription;
  const exists = Boolean(sub?.stripe_status && !["canceled", "incomplete_expired"].includes(sub.stripe_status));
  const run = async (kind: PlanAction) => {
    const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
    const messages = {
      start: `Create a recurring ${amount} plan every 30 days for this machine? The first invoice will be unpaid. No saved card will be charged automatically.`,
      cancel: "Cancel renewal at the end of the current billing period? Existing paid access and access overrides are preserved.",
      resume: "Resume renewal for this existing plan? Its recurring billing will continue.",
      update_price: `Change future invoices to ${amount}? Existing invoices and paid-through dates are unchanged.`,
      sync: "",
    };
    if (!await showConfirm({ title: kind === "start" ? "Start subscription plan?" : kind === "cancel" ? "Cancel plan renewal?" : kind === "resume" ? "Resume plan renewal?" : "Update plan price?", message: messages[kind], confirmLabel: kind === "start" ? "Create plan" : kind === "cancel" ? "Cancel renewal" : kind === "resume" ? "Resume renewal" : "Save price", tone: kind === "cancel" ? "danger" : "info" })) return;
    await action(kind, Number(machine.id), cents);
  };
  return <Tr>
    <Td>{machine.title || machine.serial_number || `Machine #${machine.id}`}<Text fontSize="xs" color="bg.300">{machine.machine_type?.name || ""}</Text></Td>
    <Td><Input aria-label={`Plan price for machine ${machine.id}`} type="number" min="0.50" step="0.01" w="110px" value={price} onChange={(event) => setPrice(event.target.value)} isDisabled={!enabled || busy} /><Text fontSize="xs" color="bg.300" mt="1">USD / 30 days</Text></Td>
    <Td><Badge colorScheme={sub?.stripe_cancel_at_period_end ? "orange" : exists ? "green" : "gray"}>{sub?.stripe_cancel_at_period_end ? "Renewal canceled" : sub?.stripe_status || "Not started"}</Badge><Text fontSize="xs" mt="1">Payment: {sub?.stripe_payment_status || "No invoice"}</Text></Td>
    <Td>{formatDate(sub?.ends_at)}</Td>
    <Td>{formatDate(sub?.stripe_current_period_end)}</Td>
    <Td><VStack align="stretch" spacing="2">
      {!exists ? <Button size="sm" isDisabled={!enabled || busy || !validPrice} onClick={() => void run("start")}>Start plan</Button> : <>
        <Button size="sm" isDisabled={!enabled || busy || !validPrice || cents === currentPrice} onClick={() => void run("update_price")}>Save price</Button>
        <Button size="sm" variant="outline" colorScheme={sub?.stripe_cancel_at_period_end ? "green" : "red"} isDisabled={!enabled || busy} onClick={() => void run(sub?.stripe_cancel_at_period_end ? "resume" : "cancel")}>{sub?.stripe_cancel_at_period_end ? "Resume renewal" : "Cancel renewal"}</Button>
      </>}
    </VStack></Td>
  </Tr>;
}

export default function AdminSubscriptionsPage() {
  const router = useRouter();
  const toast = useToast();
  const [clients, setClients] = useState<AdminSubscriptionClient[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [active, setActive] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [planBusy, setPlanBusy] = useState(false);
  const [stripeConfig, setStripeConfig] = useState<{ managed_client_id: string | null; mode: string; test_client_name: string } | null>(null);
  const selected = clients.find((client) => String(client.id) === selectedId);
  const visibleClients = useMemo(() => clients.filter((client) =>
    [client.company, client.portal_email, ...(client.users_permissions_users || []).flatMap((user) => [user.username, user.email])]
      .some((value) => value?.toLowerCase().includes(search.trim().toLowerCase()))
  ), [clients, search]);

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
        setStripeConfig(payload.stripeConfig || null);
        const queryId = typeof router.query.client === "string" ? router.query.client : "";
        if ((payload.clients || []).some((client: AdminSubscriptionClient) => String(client.id) === queryId)) setSelectedId(queryId);
      } catch (caught) { if (alive) setError(caught instanceof Error ? caught.message : "Subscription settings could not be loaded."); }
      finally { if (alive) setLoading(false); }
    };
    void load();
    return () => { alive = false; };
  }, [router.isReady, router.query.client]);

  useEffect(() => {
    setActive(selected?.subscription_billing_enabled === true && selected.subscription_restrictions_enabled !== false);
    setEndDate(localDateValue(selected?.subscription_access_until));
    setError("");
  }, [selectedId, selected?.subscription_access_until, selected?.subscription_billing_enabled, selected?.subscription_restrictions_enabled]);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const accessUntil = endDate && endDate === localDateValue(selected.subscription_access_until) ? selected.subscription_access_until! : endOfLocalDay(endDate);
      const response = await fetch(`/api/admin/subscriptions/${selected.id}`, {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ restrictionsEnabled: active, accessUntil }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Subscription settings could not be saved.");
      setClients((current) => current.map((client) => String(client.id) === selectedId ? {
        ...client, subscription_billing_enabled: payload.client.subscription_billing_enabled,
        subscription_restrictions_enabled: payload.client.subscription_restrictions_enabled,
        subscription_access_until: payload.client.subscription_access_until || null,
      } : client));
      toast({ title: "Subscription plan saved", description: `Updated ${selected.company}.`, status: "success" });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Subscription settings could not be saved.";
      setError(message);
      toast({ title: "Save failed", description: message, status: "error" });
    } finally { setSaving(false); }
  };

  const managePlan = async (action: PlanAction, machineId?: number, priceCents?: number) => {
    if (!selected) return;
    setPlanBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/subscriptions/${selected.id}/plan`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, machineId, priceCents }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "The plan action could not be completed.");
      const refreshed = await fetch("/api/admin/subscriptions", { cache: "no-store" });
      const data = await refreshed.json();
      if (!refreshed.ok) throw new Error("Plan updated, but the latest details could not be loaded. Refresh this page.");
      setClients(data.clients || []);
      toast({ title: action === "sync" ? "Plans refreshed" : "Plan updated", status: "success" });
    } catch (caught) { const message = caught instanceof Error ? caught.message : "The plan action failed."; setError(message); toast({ title: "Plan action failed", description: message, status: "error" }); }
    finally { setPlanBusy(false); }
  };
  const stripeEnabled = Boolean(selected && stripeConfig && (stripeConfig.mode === "live" ? String(selected.id) === stripeConfig.managed_client_id : selected.company.toLowerCase() === stripeConfig.test_client_name.toLowerCase()));

  return <AdminShell title="Subscriptions">
    <Text color="bg.300" mb="6">Select a client or user to manage subscription access for all of their machines.</Text>
    {error ? <Alert status="error" mb="5" borderRadius="lg"><AlertIcon />{error}</Alert> : null}
    <SimpleGrid columns={{ base: 1, lg: 2 }} spacing="6">
      <Box p="6" bg="bg.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="xl">
        <Heading size="md" mb="5">Select client / user</Heading>
        <VStack spacing="4" align="stretch">
          <Input aria-label="Search clients and users" placeholder="Search client, username, or email" value={search} onChange={(event) => setSearch(event.target.value)} isDisabled={loading || saving} />
          <Select aria-label="Client or user" placeholder={loading ? "Loading clients…" : "Choose a client / user"} value={selectedId} onChange={(event) => setSelectedId(event.target.value)} isDisabled={loading || saving}>
            {visibleClients.map((client) => <option key={client.id} value={String(client.id)}>{client.company} — {(client.users_permissions_users || []).map((user) => user.username || user.email).filter(Boolean).join(", ") || client.portal_email || `Client #${client.id}`}</option>)}
          </Select>
          {!loading && !visibleClients.length ? <Text color="bg.300">No clients match your search.</Text> : null}
          {selected ? <Box mt="3">
            <HStack justify="space-between"><Heading size="sm">{selected.company}</Heading><Badge colorScheme={!selected.subscription_billing_enabled ? "gray" : subscriptionPlanStatus(selected) === "Expired" ? "red" : "green"}>{subscriptionPlanStatus(selected)}</Badge></HStack>
            <Text mt="2" fontSize="sm" color="bg.300">{selected.portal_email || "No portal email"}</Text>
            <Text mt="3" fontSize="sm">Administrator end date: {formatDate(selected.subscription_access_until)}</Text>
            <Text mt="1" fontSize="sm" color="bg.300">{selected.machines?.length || 0} machines · Changes apply to the entire client account.</Text>
          </Box> : null}
        </VStack>
      </Box>
      <Box p="6" bg="bg.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="xl">
        <Heading size="md" mb="5">Access permissions</Heading>
        {!selected ? <Text color="bg.300">Choose a client to edit their subscription.</Text> : <VStack spacing="5" align="stretch">
          <FormControl display="flex" alignItems="center" justifyContent="space-between">
            <FormLabel htmlFor="subscription-active" mb="0">Enforce subscription restrictions</FormLabel>
            <Switch id="subscription-active" colorScheme="green" size="lg" isChecked={active} onChange={(event) => setActive(event.target.checked)} isDisabled={saving} />
          </FormControl>
          <Text fontSize="sm" color="bg.300">When enabled, unpaid or expired access restricts configuration, deployments, promotions, and free mode. You can turn restrictions off while keeping an existing Stripe plan running.</Text>
          <FormControl>
            <FormLabel htmlFor="subscription-end-date">Access end date override</FormLabel>
            <Input id="subscription-end-date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} isDisabled={saving} />
            <FormHelperText color="bg.300">Access includes the entire selected day in your timezone. Leave blank to use each machine’s Stripe paid-through date.</FormHelperText>
          </FormControl>
          <HStack flexWrap="wrap" gap="2">
            <Button size="sm" variant="outline" isDisabled={saving} onClick={() => { const date = new Date(); date.setDate(date.getDate() + 30); setEndDate(localDateValue(date.toISOString())); }}>30 days from today</Button>
            <Button size="sm" variant="ghost" isDisabled={saving || !endDate} onClick={() => setEndDate("")}>Use Stripe dates</Button>
          </HStack>
          <Alert status="info" borderRadius="lg"><AlertIcon /><Text fontSize="sm">These permissions do not change invoices or billing. Use the plan controls below to start a plan, cancel renewal, resume it, or change future prices.</Text></Alert>
          <Button variant="primary" onClick={() => void save()} isLoading={saving} isDisabled={planBusy}>Save access permissions</Button>
        </VStack>}
      </Box>
    </SimpleGrid>
    {selected?.machines?.length ? <Box mt="6" p="6" bg="bg.900" borderRadius="xl">
      <HStack justify="space-between" mb="4"><Heading size="md">Existing subscription plans</Heading><Button size="sm" isLoading={planBusy} isDisabled={!stripeEnabled || saving} onClick={() => void managePlan("sync")}>Refresh from Stripe</Button></HStack>
      {!stripeEnabled ? <Alert status="info" mb="4" borderRadius="lg"><AlertIcon />Stripe plan management is limited to the current pilot client. Access permissions can be managed for any client.</Alert> : <Text color="bg.300" fontSize="sm" mb="4">Starting a plan creates an unpaid recurring invoice. Canceling stops renewal at the period end. Price changes apply to future invoices, without proration.</Text>}
      <TableContainer mb="6"><Table><Thead><Tr><Th>Machine</Th><Th>Plan price</Th><Th>Existing plan</Th><Th>Recorded paid until</Th><Th>Billing period ends</Th><Th>Manage plan</Th></Tr></Thead><Tbody>
        {selected.machines.map((machine) => <MachinePlanRow key={machine.id} machine={machine} enabled={stripeEnabled} busy={planBusy || saving} action={managePlan} />)}
      </Tbody></Table></TableContainer>
      <Heading size="md" mb="4">Current machine dates</Heading>
      <TableContainer><Table><Thead><Tr><Th>Machine</Th><Th>Stripe / recorded paid until</Th><Th>Effective access until</Th></Tr></Thead><Tbody>
        {selected.machines.map((machine) => <Tr key={machine.id}><Td>{machine.title || machine.serial_number || `Machine #${machine.id}`}</Td><Td>{formatDate(machine.subscription?.ends_at)}</Td><Td>{!selected.subscription_billing_enabled || selected.subscription_restrictions_enabled === false ? "Restrictions off — access unrestricted" : formatDate(selected.subscription_access_until || machine.subscription?.ends_at)}</Td></Tr>)}
      </Tbody></Table></TableContainer>
    </Box> : null}
  </AdminShell>;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const redirect = await requireAdminSession(context);
  return redirect || { props: {} };
};
