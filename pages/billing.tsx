import {
  Alert, AlertIcon, Badge, Box, Button, Heading, HStack, SimpleGrid, Stat,
  StatLabel, StatNumber, Table, TableContainer, Tbody, Td, Text, Th, Thead, Tr,
} from "@chakra-ui/react";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import { PortalShell } from "../components/portal/PortalShell";
import { requirePortalSession } from "../lib/portal/auth";
import type { ClientBilling } from "../types/billing";
import type { PortalSession } from "../types/portal";

const money = (cents: number, currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
const date = (value: string | null) => value ? new Date(value).toLocaleDateString() : "—";
const paidUntil = (value: string) => new Date(value).toLocaleString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
const color = (status: string) => status === "paid" || status === "active" ? "green" : ["past_due", "unpaid", "payment_failed", "expired", "uncollectible", "red"].includes(status) ? "red" : "orange";
const label = (value: string) => value.replace(/_/g, " ");

export default function BillingPage({ session }: { session: PortalSession }) {
  const router = useRouter();
  const [billing, setBilling] = useState<ClientBilling | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const inFlight = useRef(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/portal/billing", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || "Billing could not be loaded.");
    setBilling(body);
    return body as ClientBilling;
  }, []);
  const action = useCallback(async (kind: "checkout" | "portal" | "sync", machineId?: number, background = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (!background) {
      setError("");
      setBusy(machineId ? `checkout:${machineId}` : kind);
    }
    try {
      const response = await fetch("/api/portal/billing", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: kind, machineId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "The billing action could not be completed.");
      if (kind === "sync") setBilling(body);
      else {
        const url = new URL(body.url);
        if (url.protocol !== "https:" || !["checkout.stripe.com", "billing.stripe.com"].includes(url.hostname)) throw new Error("Invalid billing link.");
        window.location.assign(url.href);
      }
    } catch (caught) { if (!background) setError(caught instanceof Error ? caught.message : "The billing action failed."); }
    finally { inFlight.current = false; if (!background) setBusy(""); }
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    let alive = true;
    setBusy("load");
    load().then(async (result) => {
      if (alive && result.stripe.enabled && result.stripe.linked) await action("sync");
    }).catch((caught) => { if (alive) setError(caught.message); }).finally(() => { if (alive) setBusy(""); });
    return () => { alive = false; };
  }, [router.isReady, load, action]);

  useEffect(() => {
    if (!billing?.stripe.enabled || !billing.stripe.linked) return;
    const refresh = () => { if (document.visibilityState === "visible") void action("sync", undefined, true); };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [billing?.stripe.enabled, billing?.stripe.linked, action]);

  return (
    <PortalShell title="Billing" description="Subscriptions and payments" clientName={session.client.company} access={session.access}>
      <HStack justify="space-between" mb="6" flexWrap="wrap" gap="3">
        <Box><Heading size="lg">Subscriptions & payments</Heading><Text mt="2" color="whiteAlpha.700">Service for your machines, billed every 30 days.</Text></Box>
        <HStack>
          <Badge colorScheme={billing?.stripe.test_mode === false ? "green" : "purple"}>{billing?.stripe.test_mode === false ? "Live billing" : "Stripe test mode"}</Badge>
          <Button size="sm" isDisabled={!billing?.stripe.enabled || !billing.stripe.linked || Boolean(busy)} isLoading={busy === "sync"} onClick={() => void action("sync")}>Refresh payments</Button>
          <Button size="sm" isDisabled={!billing?.stripe.enabled || !billing.stripe.linked || Boolean(busy)} isLoading={busy === "portal"} onClick={() => void action("portal")}>Manage billing</Button>
        </HStack>
      </HStack>
      {error ? <Alert status="error" mb="5" borderRadius="lg"><AlertIcon />{error}</Alert> : null}
      {router.query.checkout === "success" ? <Alert status="info" mb="5" borderRadius="lg"><AlertIcon />Checkout completed. Payment is confirmed from Stripe; refresh payments if your status is still pending.</Alert> : null}
      {router.query.checkout === "canceled" ? <Alert status="info" mb="5" borderRadius="lg"><AlertIcon />Checkout was canceled. You can resume it below.</Alert> : null}
      {billing && !billing.stripe.enabled ? <Alert status="info" mb="5" borderRadius="lg"><AlertIcon />Payments are not enabled for this account yet. Contact support to set up billing.</Alert> : null}
      {!billing && !error ? <Text py="8">Loading billing…</Text> : null}
      {billing ? <>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing="4" mb="8">
          <Stat p="5" bg="whiteAlpha.50" borderRadius="xl"><StatLabel>Stripe payment status</StatLabel><StatNumber fontSize="2xl" textTransform="capitalize">{label(billing.stripe.payment_status)}</StatNumber></Stat>
          <Stat p="5" bg="whiteAlpha.50" borderRadius="xl"><StatLabel>Outstanding Stripe invoices (USD)</StatLabel><StatNumber>{money(billing.stripe.open_balance_cents)}</StatNumber></Stat>
          <Stat p="5" bg="whiteAlpha.50" borderRadius="xl"><StatLabel>{billing.balance_cents < 0 ? "Other account debt" : "Account credit"}</StatLabel><StatNumber>{money(Math.abs(billing.balance_cents))}</StatNumber><Text fontSize="xs" color="whiteAlpha.600">Staff-managed balance, separate from Stripe invoices.</Text></Stat>
        </SimpleGrid>
        <Heading size="md" mb="4">Machine subscriptions</Heading>
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing="4" mb="8">
          {billing.subscriptions.map((sub) => <Box key={sub.machine_id} p="5" bg="whiteAlpha.50" borderRadius="xl" border="1px solid" borderColor={sub.notification_color ? `${sub.notification_color}.400` : "whiteAlpha.200"}>
            <HStack justify="space-between" mb="3"><Heading size="sm">{sub.machine_title || sub.machine_type || `Machine ${sub.machine_id}`}</Heading><Badge colorScheme={sub.notification_color || color(sub.status)}>{label(sub.status)}</Badge></HStack>
            <Text color="whiteAlpha.700" fontSize="sm">Machine #{sub.machine_id} · {sub.machine_type || "Machine"}</Text>
            <Text fontSize="2xl" fontWeight="bold" my="3">{sub.monthly_price_cents === null ? "Price pending" : `${money(sub.monthly_price_cents)} / 30 days`}</Text>
            <Box my="3" p="3" borderRadius="lg" bg={sub.ends_at ? "green.900" : "whiteAlpha.100"}>
              <Text fontSize="xs" color="whiteAlpha.700">Paid until</Text>
              <Text fontWeight="bold">{sub.ends_at ? paidUntil(sub.ends_at) : "Not paid yet"}</Text>
              {sub.remaining_days !== null ? <Text fontSize="sm" color="whiteAlpha.700">{sub.remaining_days} days remaining</Text> : null}
            </Box>
            {sub.payment_status ? <Text fontSize="sm" mt="1">Payment: {label(sub.payment_status)}{sub.stripe_status ? ` · Subscription: ${label(sub.stripe_status)}` : ""}</Text> : null}
            {sub.payment_url ? <Button as="a" href={sub.payment_url} target="_blank" rel="noopener noreferrer" mt="4" variant="primary">Pay {sub.monthly_price_cents === null ? "invoice" : money(sub.monthly_price_cents)} invoice</Button> : null}
            {!sub.subscription_id || (sub.billing_provider === "stripe" && !sub.stripe_status) ? <Button mt="4" variant="primary" isDisabled={!billing.stripe.enabled || Boolean(busy) || !sub.monthly_price_cents} isLoading={busy === `checkout:${sub.machine_id}`} onClick={() => void action("checkout", sub.machine_id)}>Pay subscription</Button> : null}
            {sub.billing_provider === "manual" && sub.subscription_id ? <Text mt="3" fontSize="sm" color="whiteAlpha.600">Managed by staff. Contact billing to switch to Stripe.</Text> : null}
          </Box>)}
          {!billing.subscriptions.length ? <Text>No machines are assigned to your account.</Text> : null}
        </SimpleGrid>
        <Heading size="md" mb="4">Invoices</Heading>
        {!billing.stripe.invoices.length ? <Text color="whiteAlpha.700">No Stripe invoices yet. Start a subscription above.</Text> : <TableContainer border="1px solid" borderColor="whiteAlpha.200" borderRadius="xl"><Table><Thead><Tr><Th>Invoice</Th><Th>Created</Th><Th>Total</Th><Th>Status</Th><Th>Due</Th><Th>Payment</Th></Tr></Thead><Tbody>
          {billing.stripe.invoices.map((invoice) => <Tr key={invoice.id}><Td>{invoice.number || invoice.id}</Td><Td>{date(invoice.created_at)}</Td><Td>{money(invoice.total_cents, invoice.currency)}</Td><Td><Badge colorScheme={color(invoice.payment_status)}>{label(invoice.payment_status)}</Badge></Td><Td>{date(invoice.due_at)}</Td><Td>{invoice.payment_url ? <Button as="a" href={invoice.payment_url} size="sm" target="_blank" rel="noopener noreferrer">{invoice.status === "open" ? "Pay invoice" : "View invoice"}</Button> : "—"}</Td></Tr>)}
        </Tbody></Table></TableContainer>}
        <Text mt="5" fontSize="xs" color="whiteAlpha.600">Last Stripe sync: {billing.stripe.last_synced_at ? new Date(billing.stripe.last_synced_at).toLocaleString() : "Not synced yet"}</Text>
        <Text mt="1" fontSize="xs" color="whiteAlpha.600">Payments refresh every 15 seconds while this page is open.</Text>
      </> : null}
    </PortalShell>
  );
}

export const getServerSideProps: GetServerSideProps<{ session: PortalSession }> = async (context) => {
  const result = await requirePortalSession(context);
  if ("redirect" in result) return { redirect: result.redirect };
  if (!result.session.client.subscription_billing_enabled) return { redirect: { destination: "/machines", permanent: false } };
  return { props: { session: result.session } };
};
