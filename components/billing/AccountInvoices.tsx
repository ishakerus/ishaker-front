import {
  Alert, AlertIcon, Badge, Box, Button, Collapse, Divider, Flex, FormControl,
  FormLabel, Heading, HStack, Input, InputGroup, InputLeftAddon, InputRightAddon, Modal, ModalBody,
  ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay,
  SimpleGrid, Skeleton, Text, Textarea, Tooltip, useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { FiArrowUpRight, FiCopy, FiFileText, FiPlus, FiRepeat } from "react-icons/fi";
import type { AccountCharge } from "../../types/billing";
import { useCustomDialog } from "../shared/CustomDialog";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 100);
const date = (value: string | null) => value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const cadence = { once: "One-time", monthly: "Monthly", yearly: "Yearly" };
const statusLabel = (value: string) => ({ creating: "Not issued", incomplete: "Awaiting first payment", incomplete_expired: "First payment expired", open: "Unpaid", active: "Recurring", void: "Voided", past_due: "Overdue", canceled: "Canceled", paid: "Paid", unpaid: "Unpaid" }[value] || value.replace(/_/g, " "));
const color = (value: string) => value === "paid" ? "green" : value === "past_due" ? "red" : ["open", "unpaid", "incomplete"].includes(value) ? "orange" : "gray";
function paymentUrl(value: string | null) {
  try { const url = new URL(value || ""); return url.protocol === "https:" && url.hostname === "invoice.stripe.com" ? url.href : null; } catch { return null; }
}

type Action = (action: "cancel" | "delete" | "retry", charge: AccountCharge) => Promise<void>;
function InvoiceCard({ charge, adminAction, busy }: { charge: AccountCharge; adminAction?: Action; busy?: boolean }) {
  const [history, setHistory] = useState(false);
  const [copied, setCopied] = useState(false);
  const unpaid = charge.invoices.filter((invoice) => invoice.status === "open" && invoice.remaining_cents > 0);
  const payable = unpaid.find((invoice) => paymentUrl(invoice.payment_url));
  const url = paymentUrl(payable?.payment_url || null);
  const recurring = charge.frequency !== "once";
  const canceled = ["canceled", "void", "incomplete_expired"].includes(charge.status);
  const cancelable = !canceled && (charge.status === "creating" || (recurring ? !charge.renewal_canceled : unpaid.length > 0));
  const summaryStatus = charge.outstanding_cents > 0 ? charge.payment_status : charge.payment_status === "paid" ? "paid" : charge.status;
  return <Box border="1px solid" borderColor={charge.outstanding_cents ? "orange.400" : "whiteAlpha.200"} bg="whiteAlpha.50" borderRadius="xl" overflow="hidden">
    <Box p={{ base: "4", md: "5" }}>
      <Flex justify="space-between" gap="4" align="start">
        <Box minW="0"><HStack spacing="2" mb="2" flexWrap="wrap">
          <Tooltip label={charge.payment_status === "past_due" ? "The payment due date has passed. This invoice never restricts access." : "Payment status is confirmed by Stripe. Account invoices never restrict access."} hasArrow><Badge colorScheme={color(summaryStatus)}>{statusLabel(summaryStatus)}</Badge></Tooltip>
          <Badge variant="outline" colorScheme="gray">{cadence[charge.frequency]}</Badge>
          {charge.renewal_canceled ? <Tooltip label="Future invoices have been stopped. Existing unpaid invoices remain payable." hasArrow><Badge colorScheme="gray">Renewal stopped</Badge></Tooltip> : null}
        </HStack><Heading size="sm" lineHeight="1.5" whiteSpace="pre-wrap" overflowWrap="anywhere">{charge.description}</Heading><Text fontSize="xs" color="whiteAlpha.600" mt="2">Account invoice #{charge.id} · {date(charge.created_at)}</Text></Box>
        <Box textAlign="right" flexShrink={0}><Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="bold">{money(charge.amount_cents)}</Text><Text fontSize="xs" color="whiteAlpha.600">{recurring ? charge.frequency === "monthly" ? "per month" : "per year" : "one payment"}</Text></Box>
      </Flex>
      <HStack mt="4" spacing="6" flexWrap="wrap" gap="2">
        {charge.outstanding_cents > 0 ? <Box><Text fontSize="xs" color="whiteAlpha.600">Amount outstanding</Text><Text fontWeight="semibold" color={charge.payment_status === "past_due" ? "red.200" : "orange.200"}>{money(charge.outstanding_cents)}</Text></Box> : null}
        {payable?.due_at ? <Box><Text fontSize="xs" color="whiteAlpha.600">Payment due</Text><Text fontSize="sm">{date(payable.due_at)}</Text></Box> : null}
        {charge.next_invoice_at ? <Box><Text fontSize="xs" color="whiteAlpha.600">Next invoice</Text><Text fontSize="sm">{date(charge.next_invoice_at)}</Text></Box> : null}
      </HStack>
      <Flex gap="2" mt="4" wrap="wrap" align="center">
        {url ? <Button as="a" href={url} target="_blank" rel="noopener noreferrer" size="sm" colorScheme="green" rightIcon={<FiArrowUpRight />}>{adminAction ? "Open payment link" : "Pay invoice"}</Button> : null}
        {url && adminAction ? <Button size="sm" variant="ghost" leftIcon={<FiCopy />} onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); } }}>{copied ? "Copied" : "Copy link"}</Button> : null}
        <Button size="sm" variant="ghost" onClick={() => setHistory(!history)} aria-expanded={history}>{history ? "Hide invoices" : `Invoices (${charge.invoices.length})`}</Button>
        {charge.status === "creating" && adminAction ? <Button size="sm" variant="outline" isDisabled={busy} onClick={() => void adminAction("retry", charge)}>Retry issuing</Button> : null}
        {cancelable && adminAction ? <Button size="sm" colorScheme="red" variant="ghost" ml={{ md: "auto" }} isDisabled={busy} onClick={() => void adminAction("cancel", charge)}>{recurring ? "Stop future invoices" : "Cancel invoice"}</Button> : null}
        {adminAction ? <Button size="sm" colorScheme="red" variant="ghost" isDisabled={busy} onClick={() => void adminAction("delete", charge)}>Delete</Button> : null}
      </Flex>
      {charge.status === "creating" ? <Text mt="3" fontSize="xs" color="orange.200">Issuing has not completed. The payment status updates automatically. You can retry issuing if it remains incomplete.</Text> : null}
    </Box>
    <Collapse in={history}><Divider borderColor="whiteAlpha.100" /><Box p="4" bg="blackAlpha.200">
      {!charge.invoices.length ? <Text color="whiteAlpha.600" fontSize="sm">No issued invoices yet.</Text> : charge.invoices.map((invoice) => <Flex key={invoice.id} py="3" gap="3" align="center" wrap="wrap" borderBottom="1px solid" borderColor="whiteAlpha.100">
        <Box flex="1" minW="100px"><Text fontSize="sm" fontWeight="semibold">{invoice.number || "Invoice"}</Text><Text fontSize="xs" color="whiteAlpha.600">{date(invoice.created_at)}{invoice.due_at ? ` · Due ${date(invoice.due_at)}` : ""}</Text></Box><Text fontSize="sm">{money(invoice.total_cents)}</Text><Badge colorScheme={color(invoice.payment_status)}>{statusLabel(invoice.payment_status)}</Badge>
        {paymentUrl(invoice.payment_url) ? <Button as="a" href={paymentUrl(invoice.payment_url)!} target="_blank" rel="noopener noreferrer" size="xs" variant="outline">{invoice.status === "open" ? "Pay" : "View"}</Button> : null}
      </Flex>)}
    </Box></Collapse>
  </Box>;
}

export function AccountInvoices({ charges, adminAction, busy }: { charges: AccountCharge[]; adminAction?: Action; busy?: boolean }) {
  const [filter, setFilter] = useState("all");
  const outstanding = charges.reduce((sum, charge) => sum + charge.outstanding_cents, 0);
  const visible = charges.filter((charge) => filter === "unpaid" ? charge.outstanding_cents > 0 : filter === "recurring" ? charge.frequency !== "once" && !charge.renewal_canceled && !["canceled", "incomplete_expired"].includes(charge.status) : true)
    .sort((a, b) => Number(b.outstanding_cents > 0) - Number(a.outstanding_cents > 0) || b.id - a.id);
  return <Box id="account-invoices" mb="8" scrollMarginTop="100px">
    {!adminAction ? <Heading size="md" mb="2">Account invoices ({charges.length})</Heading> : null}
    <Text fontSize="sm" color="whiteAlpha.600" mb="4">Separate charges for your account. These do not affect machine access.</Text>
    {charges.length ? <>
      <Flex justify="space-between" align="center" mb="4" gap="3" flexWrap="wrap"><HStack spacing="1" bg="blackAlpha.200" p="1" borderRadius="lg">{[["all", "All"], ["unpaid", "Unpaid"], ["recurring", "Recurring"]].map(([value, label]) => <Button key={value} size="sm" variant={filter === value ? "solid" : "ghost"} onClick={() => setFilter(value)} aria-pressed={filter === value}>{label}</Button>)}</HStack><Text fontSize="sm" color="whiteAlpha.700">Outstanding <Text as="span" ml="2" color={outstanding ? "orange.200" : "green.200"} fontWeight="bold">{money(outstanding)}</Text></Text></Flex>
      <SimpleGrid columns={{ base: 1, xl: 2 }} spacing="4">{visible.map((charge) => <InvoiceCard key={charge.id} charge={charge} adminAction={adminAction} busy={busy} />)}</SimpleGrid>
      {!visible.length ? <Text py="6" color="whiteAlpha.600">No invoices match this filter.</Text> : null}
    </> : <Box py="8" px="4" border="1px dashed" borderColor="whiteAlpha.200" borderRadius="xl" textAlign="center"><Box as={FiFileText} mx="auto" mb="3" color="whiteAlpha.500" boxSize="6" /><Text fontWeight="semibold">No account invoices</Text><Text fontSize="sm" color="whiteAlpha.600" mt="1">{adminAction ? "Issue a one-time charge or set up monthly or yearly invoices." : "Any separate charges will appear here."}</Text></Box>}
  </Box>;
}

export function AdminAccountInvoices({ clientId, clientName }: { clientId: string | number; clientName: string }) {
  const [charges, setCharges] = useState<AccountCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState<AccountCharge["frequency"]>("once");
  const [dueDays, setDueDays] = useState("7");
  const [requestKey, setRequestKey] = useState("");
  const toast = useToast();
  const { showConfirm } = useCustomDialog();
  const endpoint = `/api/admin/subscriptions/${clientId}/invoices`;
  const load = async (signal?: AbortSignal) => {
    const response = await fetch(endpoint, { cache: "no-store", signal }); const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Account invoices could not be loaded.");
    setCharges(data.charges || []);
  };
  useEffect(() => { const controller = new AbortController(); setLoading(true); setError(""); setOpen(false); setCharges([]); void load(controller.signal).catch((caught) => { if (!controller.signal.aborted) setError(caught.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, [endpoint]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (busy || open) return;
    const controller = new AbortController();
    const refresh = () => { if (document.visibilityState === "visible") void load(controller.signal).catch(() => {}); };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [endpoint, busy, open]); // eslint-disable-line react-hooks/exhaustive-deps
  const send = async (body: object) => {
    const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json();
    if (!response.ok) throw new Error(data.message || "The invoice action failed.");
    setCharges(data.charges || []);
  };
  const cents = Math.round(Number(amount) * 100);
  const valid = /^\d+(\.\d{1,2})?$/.test(amount) && Number.isSafeInteger(cents) && cents >= 50 && cents <= 99999999 && description.trim().length > 0 && /^\d+$/.test(dueDays) && Number(dueDays) >= 1 && Number(dueDays) <= 90;
  const run = async (task: () => Promise<void>, message: string) => { if (busy) return; setBusy(true); setError(""); try { await task(); toast({ title: message, status: "success" }); } catch (caught) { setError(caught instanceof Error ? caught.message : "Invoice action failed."); await load().catch(() => {}); } finally { setBusy(false); } };
  const create = () => run(async () => { await send({ action: "create", amount_cents: cents, description: description.trim(), frequency, due_days: Number(dueDays), request_key: requestKey }); setOpen(false); }, "Invoice issued");
  const action: Action = async (kind, charge) => {
    if (kind === "delete" && !await showConfirm({ title: "Delete this invoice?", message: charge.frequency === "once" ? "This removes the invoice from the admin and client views and voids it if unpaid. Paid records stay in Stripe; no refund is issued." : "This removes the recurring invoice from both views, stops future billing immediately, and voids existing unpaid invoices. Paid records stay in Stripe; no refund is issued.", confirmLabel: "Delete invoice", tone: "danger" })) return;
    if (kind === "cancel" && !await showConfirm({ title: charge.frequency === "once" ? "Cancel this invoice?" : "Stop future invoices?", message: charge.frequency === "once" ? "The unpaid invoice will be voided and its payment link will stop accepting payment." : "No new invoices will be issued after the current period. Existing unpaid invoices remain payable. Machine access is unaffected.", confirmLabel: charge.frequency === "once" ? "Cancel invoice" : "Stop future invoices", tone: "danger" })) return;
    await run(() => send({ action: kind, charge_id: charge.id }), kind === "delete" ? "Invoice deleted" : kind === "retry" ? "Invoice issued" : "Invoice updated");
  };
  return <Box mt="6" p={{ base: "4", md: "6" }} bg="bg.900" borderRadius="xl" border="1px solid" borderColor="whiteAlpha.100">
    <Flex justify="space-between" align="center" gap="3" mb="4" wrap="wrap"><Heading size="md">Account invoices</Heading><HStack><Button size="sm" colorScheme="green" leftIcon={<FiPlus />} isDisabled={busy || loading} onClick={() => { setAmount(""); setDescription(""); setFrequency("once"); setDueDays("7"); setRequestKey(crypto.randomUUID()); setError(""); setOpen(true); }}>Issue invoice</Button></HStack></Flex>
    {error && !open ? <Alert status="error" mb="4" borderRadius="lg"><AlertIcon />{error}</Alert> : null}
    {loading ? <Skeleton height="160px" borderRadius="xl" /> : <AccountInvoices charges={charges} adminAction={action} busy={busy} />}
    <Modal isOpen={open} onClose={() => { if (!busy) setOpen(false); }} size="xl" scrollBehavior="inside" isCentered closeOnOverlayClick={!busy} closeOnEsc={!busy}><ModalOverlay backdropFilter="blur(4px)" /><ModalContent bg="bg.900" color="white" mx="4"><ModalHeader>Issue account invoice<Text fontSize="sm" fontWeight="normal" color="whiteAlpha.600" mt="1">{clientName}</Text></ModalHeader><ModalCloseButton isDisabled={busy} /><ModalBody>
      {error ? <Alert status="error" mb="4" borderRadius="lg"><AlertIcon />{error}</Alert> : null}
      <Box as="fieldset" disabled={busy} border="0" p="0" m="0">
        <FormControl mb="5" isRequired><FormLabel>Amount</FormLabel><InputGroup size="lg"><InputLeftAddon bg="whiteAlpha.100">$</InputLeftAddon><Input autoFocus aria-label="Invoice amount" inputMode="decimal" value={amount} placeholder="0.00" onChange={(event) => { setAmount(event.target.value); setRequestKey(crypto.randomUUID()); }} /><InputRightAddon bg="transparent" borderLeft="0" fontSize="sm">USD</InputRightAddon></InputGroup></FormControl>
        <FormControl mb="5" isRequired><FormLabel>What is this invoice for?</FormLabel><Textarea value={description} placeholder="For example: outstanding balance for delivery and installation" rows={3} maxLength={1000} onChange={(event) => { setDescription(event.target.value); setRequestKey(crypto.randomUUID()); }} /><Text fontSize="xs" color="whiteAlpha.500" mt="1">Visible to the client and on the Stripe invoice.</Text></FormControl>
        <FormControl mb="5"><FormLabel>Frequency</FormLabel><SimpleGrid columns={3} gap="2">{(["once", "monthly", "yearly"] as const).map((value) => <Button key={value} variant={frequency === value ? "solid" : "outline"} colorScheme={frequency === value ? "green" : "gray"} leftIcon={value === "once" ? <FiFileText /> : <FiRepeat />} onClick={() => { setFrequency(value); setRequestKey(crypto.randomUUID()); }} aria-pressed={frequency === value}>{cadence[value]}</Button>)}</SimpleGrid></FormControl>
        <FormControl mb="5"><FormLabel>Days to pay each invoice</FormLabel><HStack><Input aria-label="Days to pay" type="number" min={1} max={90} value={dueDays} w="90px" onChange={(event) => { setDueDays(event.target.value); setRequestKey(crypto.randomUUID()); }} /><Text fontSize="sm" color="whiteAlpha.600">days from issue date</Text></HStack><Text fontSize="xs" color="whiteAlpha.600" mt="2">The invoice becomes overdue after this deadline. It stays payable and never restricts access. This does not change the monthly or yearly billing date.</Text></FormControl>
      </Box>
      <Box p="4" bg="green.900" border="1px solid" borderColor="green.700" borderRadius="lg"><Flex justify="space-between" align="center"><Text fontWeight="semibold">{cadence[frequency]} invoice</Text><Text fontSize="xl" fontWeight="bold">{Number.isFinite(cents) ? money(cents) : "$0.00"}</Text></Flex><Text mt="2" fontSize="sm" color="whiteAlpha.800">{frequency === "once" ? "Issued immediately. The client pays once using a Stripe payment link." : `First invoice issued immediately, then every ${frequency === "monthly" ? "month" : "year"} until stopped. Each invoice has its own payment link.`}</Text><Text mt="2" fontSize="xs" color="whiteAlpha.600">No card is charged when you issue this invoice. No machine is linked and access is never restricted. Without an email, the first recurring payment is due within 23 hours; later renewals use automatic collection.</Text></Box>
    </ModalBody><ModalFooter gap="3"><Button variant="ghost" isDisabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button colorScheme="green" isDisabled={!valid || busy} isLoading={busy} onClick={() => void create()}>Issue invoice</Button></ModalFooter></ModalContent></Modal>
  </Box>;
}
