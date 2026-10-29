import {
  Alert, AlertIcon, Badge, Box, Button, Heading, HStack, SimpleGrid, Stat,
  StatLabel, StatNumber, Text,
} from "@chakra-ui/react";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import { PortalShell } from "../components/portal/PortalShell";
import { requirePortalSession } from "../lib/portal/auth";
import { AccountInvoices } from "../components/billing/AccountInvoices";
import { MachineSubscriptions } from "../components/billing/MachineSubscriptions";
import type { ClientBilling } from "../types/billing";
import type { PortalSession } from "../types/portal";

const money = (cents: number, currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
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
  const action = useCallback(async (kind: "portal" | "sync", background = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (!background) {
      setError("");
      setBusy(kind);
    }
    try {
      const response = await fetch("/api/portal/billing", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: kind }),
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
      if (alive && result.stripe.linked) await action("sync");
    }).catch((caught) => { if (alive) setError(caught.message); }).finally(() => { if (alive) setBusy(""); });
    return () => { alive = false; };
  }, [router.isReady, load, action]);

  useEffect(() => {
    if (!billing?.stripe.linked) return;
    const refresh = () => { if (document.visibilityState === "visible") void action("sync", true); };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [billing?.stripe.linked, action]);

  return (
    <PortalShell title="Billing" description="Subscriptions and payments" clientName={session.client.company} billingEnabled={session.client.subscription_billing_enabled} access={session.access}>
      <HStack justify="space-between" mb="6" flexWrap="wrap" gap="3">
        <Box><Heading size="lg">Subscriptions & payments</Heading><Text mt="2" color="whiteAlpha.700">Machine subscription plans and separate account invoices.</Text></Box>
        <HStack>
          <Badge colorScheme={billing?.stripe.test_mode === false ? "green" : "purple"}>{billing ? (!billing.stripe.enabled ? "Administrator-managed access" : billing.stripe.test_mode ? "Stripe test mode" : "Live billing") : "Billing"}</Badge>
          <Button size="sm" isDisabled={!billing?.stripe.linked || Boolean(busy)} isLoading={busy === "portal"} onClick={() => void action("portal")}>Manage billing</Button>
        </HStack>
      </HStack>
      {error ? <Alert status="error" mb="5" borderRadius="lg"><AlertIcon />{error}</Alert> : null}
      {router.query.checkout === "success" ? <Alert status="info" mb="5" borderRadius="lg"><AlertIcon />Checkout completed. Payment is confirmed from Stripe; your payment status updates automatically.</Alert> : null}
      {router.query.checkout === "canceled" ? <Alert status="info" mb="5" borderRadius="lg"><AlertIcon />Checkout was canceled. Existing invoices remain available below.</Alert> : null}
      {billing && !billing.stripe.enabled ? <Alert status="info" mb="5" borderRadius="lg"><AlertIcon />Your subscription access is managed by your administrator.</Alert> : null}
      {billing?.restrictions_enabled !== false && billing?.stripe.enabled && billing.subscriptions.some((sub) => !["active", "orange", "red"].includes(sub.status)) ? <Alert status="warning" mb="5" borderRadius="lg"><AlertIcon />Machines without paid access have restricted configuration, product deployments, promotions, and free mode. Billing, support, sales history, and service controls remain available.</Alert> : null}
      {!billing && !error ? <Text py="8">Loading billing…</Text> : null}
      {billing ? <>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing="4" mb="8">
          <Stat p="5" bg="whiteAlpha.50" borderRadius="xl"><StatLabel>Stripe payment status</StatLabel><StatNumber fontSize="2xl" textTransform="capitalize">{label(billing.stripe.payment_status)}</StatNumber></Stat>
          <Stat p="5" bg="whiteAlpha.50" borderRadius="xl"><StatLabel>Outstanding Stripe invoices (USD)</StatLabel><StatNumber>{money(billing.stripe.open_balance_cents)}</StatNumber></Stat>
          <Stat p="5" bg="whiteAlpha.50" borderRadius="xl"><StatLabel>{billing.balance_cents < 0 ? "Other account debt" : "Account credit"}</StatLabel><StatNumber>{money(Math.abs(billing.balance_cents))}</StatNumber><Text fontSize="xs" color="whiteAlpha.600">Staff-managed balance, separate from Stripe invoices.</Text></Stat>
        </SimpleGrid>
        <MachineSubscriptions subscriptions={billing.subscriptions} />
        <AccountInvoices charges={billing.account_charges || []} />
        <Text mt="5" fontSize="xs" color="whiteAlpha.600">Last Stripe sync: {billing.stripe.last_synced_at ? new Date(billing.stripe.last_synced_at).toLocaleString() : "Not synced yet"}</Text>
        <Text mt="1" fontSize="xs" color="whiteAlpha.600">Payments refresh every 15 seconds while this page is open.</Text>
      </> : null}
    </PortalShell>
  );
}

export const getServerSideProps: GetServerSideProps<{ session: PortalSession }> = async (context) => {
  const result = await requirePortalSession(context);
  if ("redirect" in result) return { redirect: result.redirect };
  if (result.session.access !== "client") return { redirect: { destination: "/machines", permanent: false } };
  return { props: { session: result.session } };
};
