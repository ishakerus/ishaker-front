import { Box, Button, Collapse, Flex, Heading, HStack, SimpleGrid, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { SubscriptionBadge, SubscriptionPaymentBadge } from "../admin/SubscriptionBadge";
import { configuredMachinePlans, machinePlanRenewal } from "../../lib/portal/billingPresentation";
import type { BillingSubscription } from "../../types/billing";

const money = (cents: number, currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : "—";
function safePaymentUrl(value: string | null) {
  try { const url = new URL(value || ""); return url.protocol === "https:" && url.hostname === "invoice.stripe.com" ? url.href : null; } catch { return null; }
}
function MachinePlan({ sub, now }: { sub: BillingSubscription; now: number }) {
  const [history, setHistory] = useState(false);
  const renewal = machinePlanRenewal(sub);
  const until = sub.ends_at;
  const paid = Boolean(until && Date.parse(until) > now);
  const url = safePaymentUrl(sub.payment_url);
  return <Box p="5" bg="whiteAlpha.50" borderRadius="xl" border="1px solid" borderColor="whiteAlpha.200">
    <Flex justify="space-between" align="start" gap="3" mb="3"><Box minW="0"><Heading size="sm" overflowWrap="anywhere">{sub.machine_title || sub.machine_serial_number || `Machine #${sub.machine_id}`}</Heading><Text fontSize="sm" mt="2" color="whiteAlpha.600">{sub.machine_type || "Machine"}{sub.machine_serial_number ? ` · S/N ${sub.machine_serial_number}` : ""}</Text></Box><SubscriptionBadge colorScheme={renewal.color} description={renewal.description}>{renewal.label}</SubscriptionBadge></Flex>
    <Text fontSize="2xl" fontWeight="bold" my="3">{sub.monthly_price_cents === null ? "Price pending" : `${money(sub.monthly_price_cents)} / 30 days`}</Text>
    <SubscriptionPaymentBadge until={until} now={now} accessOverride={sub.access_source === "admin"} subscription={{ stripe_payment_status: sub.payment_status || undefined }} />
    <Box mt="3" p="3" borderRadius="lg" bg={paid ? "green.900" : "whiteAlpha.100"}><Text fontSize="xs" color="whiteAlpha.600">{sub.access_source === "admin" ? "Access until" : "Paid until"}</Text><Text fontWeight="semibold" mt="1">{until ? date(until) : "No payment recorded"}</Text></Box>
    {sub.stripe_current_period_end ? <Text fontSize="xs" color="whiteAlpha.600" mt="2">Billing period ends {date(sub.stripe_current_period_end)}. This is separate from the paid-through date.</Text> : null}
    {sub.stripe_resume_at ? <Text fontSize="sm" mt="3" color="whiteAlpha.700">Renewal resumes {date(sub.stripe_resume_at)}.</Text> : sub.stripe_status === "scheduled" ? <Text fontSize="sm" mt="3" color="whiteAlpha.700">Starts {date(sub.starts_at)}.</Text> : sub.stripe_cancel_at_period_end ? <Text fontSize="sm" mt="3" color="whiteAlpha.700">Automatic renewal is off.{url ? " The existing invoice is still payable." : ""}</Text> : null}
    <HStack mt="4" flexWrap="wrap" gap="2">
      {url ? <Button as="a" href={url} target="_blank" rel="noopener noreferrer" colorScheme="green" size="sm">{sub.payment_amount_cents != null ? `Pay ${money(sub.payment_amount_cents)} invoice` : "Pay invoice"}</Button> : null}
      {sub.invoices?.length ? <Button size="sm" variant="ghost" aria-expanded={history} onClick={() => setHistory(!history)}>{history ? "Hide payment history" : `Payment history (${sub.invoices.length})`}</Button> : null}
    </HStack>
    <Collapse in={history}><Box mt="4" borderTop="1px solid" borderColor="whiteAlpha.100">{(sub.invoices || []).map((invoice) => <Flex key={invoice.id} py="3" gap="3" align="center" flexWrap="wrap"><Box flex="1"><Text fontSize="sm">{invoice.number || "Invoice"}</Text><Text fontSize="xs" color="whiteAlpha.600">{date(invoice.created_at)}</Text></Box><Text fontSize="sm">{money(invoice.total_cents, invoice.currency)}</Text><Text fontSize="xs" textTransform="capitalize">{invoice.payment_status.replace(/_/g, " ")}</Text>{safePaymentUrl(invoice.payment_url) ? <Button as="a" size="xs" variant="outline" href={safePaymentUrl(invoice.payment_url)!} target="_blank" rel="noopener noreferrer">{invoice.status === "open" ? "Pay" : "View"}</Button> : null}</Flex>)}</Box></Collapse>
  </Box>;
}
export function MachineSubscriptions({ subscriptions }: { subscriptions: BillingSubscription[] }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  const plans = configuredMachinePlans(subscriptions);
  return <Box mb="8"><Heading size="md" mb="4">Machine subscriptions ({plans.length})</Heading>{plans.length ? <SimpleGrid columns={{ base: 1, lg: 2 }} spacing="4">{plans.map((sub) => <MachinePlan key={sub.machine_id} sub={sub} now={now} />)}</SimpleGrid> : <Text color="whiteAlpha.600">No machine subscription plans have been set up. Contact your administrator to start a plan.</Text>}</Box>;
}
