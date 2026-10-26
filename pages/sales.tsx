import {
  Alert, AlertIcon, Badge, Box, Button, ButtonGroup, FormControl, FormLabel,
  HStack, Input, Select, SimpleGrid, Stat, StatLabel, StatNumber, Table,
  TableContainer, Tbody, Td, Text, Th, Thead, Tr, useToast,
} from "@chakra-ui/react";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip,
  XAxis, YAxis,
} from "recharts";
import { PortalShell } from "../components/portal/PortalShell";
import Loader from "../components/shared/Loader";
import { requirePortalSession } from "../lib/portal/auth";
import { formatMoney } from "../lib/portal/currency";
import type { PortalSession } from "../types/portal";
import type { Currency, Sale, SalesSummary } from "../types/strapi";

type SalesPageProps = { session: PortalSession };
type SalesPayload = {
  sales: Sale[];
  pagination: { page: number; pageSize: number; pageCount: number; total: number };
  nayax: { status: "unconfigured" | "ok" | "error"; error?: string | null; lastSyncAt?: string | null };
};
type Group = "product" | "machine" | "cell";
type SalesFilters = { machineId: string; from: string; to: string };

const currencyFrom = (code: string | null | undefined, session: PortalSession): Currency => {
  const known = session.client.currency || session.machines.find((machine) => machine.currency?.code === code)?.currency;
  if (known && (!code || known.code === code)) return known;
  const normalized = (code || "USD").toUpperCase();
  return { id: `code:${normalized}`, code: normalized, symbol: normalized, symbol_position: "before", decimal_digits: 2 };
};
const saleCurrency = (sale: Sale, session: PortalSession) =>
  sale.currency || sale.machine?.currency || currencyFrom(sale.currency_code, session);
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const localTime = (sale: Sale) => {
  if (sale.occurred_at_local) return sale.occurred_at_local.replace("T", " ");
  return sale.occurred_at ? new Date(sale.occurred_at).toLocaleString() : "—";
};
const productLabel = (sale: Sale) => {
  const primary = sale.product_name || sale.product?.name || "—";
  const tastes = [sale.taste?.name, sale.taste_2?.name].filter(Boolean).join(" + ");
  return tastes && !primary.toLowerCase().includes(tastes.toLowerCase()) ? `${primary} · ${tastes}` : primary;
};
const filterParams = (machineId: string, from: string, to: string) => {
  const params = new URLSearchParams();
  if (machineId) params.set("machineId", machineId);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return params;
};

export default function SalesPage({ session }: SalesPageProps) {
  const router = useRouter();
  const toast = useToast();
  const [payload, setPayload] = useState<SalesPayload | null>(null);
  const [daily, setDaily] = useState<SalesSummary | null>(null);
  const [breakdown, setBreakdown] = useState<SalesSummary | null>(null);
  const [group, setGroup] = useState<Group>("product");
  const [machineId, setMachineId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (
    page = 1,
    nextGroup: Group = group,
    filters: SalesFilters = { machineId, from, to },
  ) => {
    setIsLoading(true);
    setError("");
    const base = filterParams(filters.machineId, filters.from, filters.to);
    const listParams = new URLSearchParams(base);
    listParams.set("page", String(page));
    listParams.set("pageSize", "25");
    const dayParams = new URLSearchParams(base);
    dayParams.set("group", "day");
    const groupParams = new URLSearchParams(base);
    groupParams.set("group", nextGroup);
    try {
      const responses = await Promise.all([
        fetch(`/api/portal/sales?${listParams}`, { cache: "no-store" }),
        fetch(`/api/portal/sales-summary?${dayParams}`, { cache: "no-store" }),
        fetch(`/api/portal/sales-summary?${groupParams}`, { cache: "no-store" }),
      ]);
      const bodies = await Promise.all(responses.map((response) => response.json().catch(() => null)));
      const failed = responses.findIndex((response) => !response.ok);
      if (failed >= 0) throw new Error(bodies[failed]?.message || "Sales could not be loaded.");
      setPayload(bodies[0]);
      setDaily(bodies[1]);
      setBreakdown(bodies[2]);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Sales could not be loaded.";
      setError(message);
      toast({ title: "Sales load failed", description: message, status: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!router.isReady) return;
    const queryValue = (value: string | string[] | undefined) =>
      Array.isArray(value) ? value[0] || "" : value || "";
    const initialMachineId = queryValue(router.query.machineId);
    const initialFrom = queryValue(router.query.from);
    const initialTo = queryValue(router.query.to);
    setMachineId(initialMachineId);
    setFrom(initialFrom);
    setTo(initialTo);

    const initialFilters = {
      machineId: initialMachineId,
      from: initialFrom,
      to: initialTo,
    };
    void load(1, "product", initialFilters);
  }, [router.isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeGroup = (next: Group) => {
    setGroup(next);
    void load(payload?.pagination.page || 1, next);
  };
  const summary = daily;
  const currency = currencyFrom(summary?.currency, session);
  const truncated = Boolean(daily?.truncated || breakdown?.truncated);
  const exportHref = `/api/portal/sales?${filterParams(machineId, from, to)}&format=csv`;

  return (
    <PortalShell
      title="Sales"
      description="Drinks actually dispensed by the machine. Card fees, refunds, and settlement are not included here; those are available only in Nayax."
      clientName={session.client.company} billingEnabled={session.client.subscription_billing_enabled}
    >
      <Box bg="bg.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="2xl" p="5" mb="6">
        <HStack align="end" spacing="4" flexWrap="wrap">
          <FormControl maxW="260px">
            <FormLabel>Machine</FormLabel>
            <Select value={machineId} onChange={(event) => setMachineId(event.target.value)} placeholder="All machines">
              {session.machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.serial_number}</option>)}
            </Select>
          </FormControl>
          <FormControl maxW="190px"><FormLabel>From</FormLabel><Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></FormControl>
          <FormControl maxW="190px"><FormLabel>To</FormLabel><Input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></FormControl>
          <Button variant="primary" onClick={() => void load(1)}>Apply filters</Button>
          <Button as="a" href={exportHref} variant="outline">Export CSV</Button>
        </HStack>
      </Box>

      {error ? <Alert status="error" mb="5" borderRadius="xl"><AlertIcon />{error}</Alert> : null}
      {truncated ? <Alert status="warning" mb="5" borderRadius="xl"><AlertIcon />This period contains more than 20,000 drinks. Narrow the date range; charts and breakdowns are hidden because they would be incomplete.</Alert> : null}

      <SimpleGrid columns={{ base: 2, md: 3, xl: 6 }} spacing="4" mb="6">
        {[
          ["Cups", summary?.totals.cups ?? "—"],
          ["Revenue", summary ? formatMoney(summary.totals.revenue, currency) : "—"],
          ["Average check", summary ? formatMoney(summary.totals.avg_check || 0, currency) : "—"],
          ["Free cups", summary?.totals.free_cups ?? "—"],
          ["Powder (kg)", summary ? (summary.totals.powder_g / 1000).toFixed(2) : "—"],
          ["Water (L)", summary ? (summary.totals.water_ml / 1000).toFixed(1) : "—"],
        ].map(([label, value]) => <Box key={String(label)} bg="bg.900" borderRadius="2xl" p="5"><Stat><StatLabel color="bg.300">{label}</StatLabel><StatNumber color="bg.50" fontSize="2xl">{value}</StatNumber></Stat></Box>)}
      </SimpleGrid>

      {isLoading && !payload ? <HStack py="12" justify="center"><Loader size="md" /><Text color="bg.300">Loading sales…</Text></HStack> : summary && summary.totals.cups === 0 ? (
        <Box bg="bg.900" borderRadius="2xl" p="10" mb="6"><Text color="bg.300" textAlign="center">This machine has not started reporting sales yet.</Text></Box>
      ) : (
        <>
          {!truncated ? (
            <Box bg="bg.900" borderRadius="2xl" p={{ base: 4, md: 6 }} mb="6">
              <Text color="acid.300" fontWeight="800" mb="5">Revenue by day</Text>
              <Box h="300px">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={daily?.groups || []}>
                    <defs>
                      <linearGradient id="salesRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#76f85f" stopOpacity={0.38} />
                        <stop offset="55%" stopColor="#76f85f" stopOpacity={0.14} />
                        <stop offset="100%" stopColor="#76f85f" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,.08)" />
                    <XAxis dataKey="key" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip contentStyle={{ background: "#171923", border: "1px solid rgba(255,255,255,.15)" }} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name={`Revenue (${currency.code})`}
                      stroke="#76f85f"
                      strokeWidth={3}
                      fill="url(#salesRevenueGradient)"
                      dot={{ r: 3, fill: "#76f85f", stroke: "#141313", strokeWidth: 2 }}
                      activeDot={{ r: 5, fill: "#76f85f", stroke: "#f3fff1", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </Box>
          ) : null}

          {!truncated ? <Box bg="bg.900" borderRadius="2xl" p="6" mb="6"><HStack justify="space-between" mb="4" flexWrap="wrap"><Text color="acid.300" fontWeight="800">Breakdown</Text><ButtonGroup size="sm" isAttached>{(["product", "machine", "cell"] as Group[]).map((item) => <Button key={item} variant={group === item ? "primary" : "outline"} onClick={() => changeGroup(item)}>By {item}</Button>)}</ButtonGroup></HStack><TableContainer><Table><Thead><Tr><Th pl="0">{group}</Th><Th isNumeric>Cups</Th><Th isNumeric>Share</Th><Th isNumeric>Revenue</Th><Th isNumeric>Powder</Th></Tr></Thead><Tbody>{(breakdown?.groups || []).map((row) => <Tr key={row.key}><Td pl="0">{group === "cell" && row.key !== "—" ? `Cell ${row.key}` : row.key}</Td><Td isNumeric>{row.cups}</Td><Td isNumeric>{summary?.totals.cups ? `${((row.cups / summary.totals.cups) * 100).toFixed(1)}%` : "—"}</Td><Td isNumeric>{formatMoney(row.revenue, currency)}</Td><Td isNumeric>{(row.powder_g / 1000).toFixed(2)} kg</Td></Tr>)}</Tbody></Table></TableContainer></Box> : null}
        </>
      )}

      <Box bg="bg.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="2xl" p="6">
        <Text color="acid.300" fontWeight="800" mb="4">Dispensed drinks</Text>
        {isLoading ? <HStack py="10" justify="center"><Loader size="md" /><Text color="bg.300">Loading sales…</Text></HStack> : !payload?.sales.length ? <Text color="bg.300" py="10" textAlign="center">This machine has not started reporting sales yet.</Text> : <><TableContainer><Table minW="1120px"><Thead><Tr><Th pl="0">Machine local time</Th><Th>Machine</Th><Th>Product</Th><Th>Size</Th><Th>Cell</Th><Th isNumeric>List price</Th><Th isNumeric>Paid</Th><Th>Payment</Th></Tr></Thead><Tbody>{payload.sales.map((sale) => <Tr key={sale.id}><Td pl="0">{localTime(sale)} {sale.raw?.clock_suspect ? <Badge colorScheme="orange">CLOCK</Badge> : null}</Td><Td>{sale.machine?.serial_number || "—"}</Td><Td>{productLabel(sale)} <HStack as="span" display="inline-flex" ml="1">{sale.is_free ? <Badge colorScheme="purple">FREE</Badge> : null}{sale.is_mix ? <Badge colorScheme="blue">MIX</Badge> : null}</HStack></Td><Td>{sale.cup_size || "—"}{sale.drink_volume_ml ? ` · ${sale.drink_volume_ml} ml` : ""}</Td><Td>{sale.cell_position ?? "—"}</Td><Td isNumeric>{formatMoney(number(sale.list_price), saleCurrency(sale, session))}</Td><Td isNumeric fontWeight="700">{formatMoney(number(sale.amount), saleCurrency(sale, session))}</Td><Td>{sale.payment_method || (sale.is_free ? "FREE" : "—")}</Td></Tr>)}</Tbody></Table></TableContainer><HStack justify="space-between" mt="5"><Text color="bg.300" fontSize="sm">Page {payload.pagination.page} of {payload.pagination.pageCount} · {payload.pagination.total} drinks</Text><HStack><Button size="sm" isDisabled={payload.pagination.page <= 1} onClick={() => void load(payload.pagination.page - 1)}>Previous</Button><Button size="sm" isDisabled={payload.pagination.page >= payload.pagination.pageCount} onClick={() => void load(payload.pagination.page + 1)}>Next</Button></HStack></HStack></>}
      </Box>

      {payload ? <Box mt="8" p="4" borderRadius="xl" bg="whiteAlpha.50"><Text fontSize="sm" color="bg.300">Nayax reconciliation (auxiliary): {payload.nayax.status}{payload.nayax.lastSyncAt ? ` · last sync ${new Date(payload.nayax.lastSyncAt).toLocaleString()}` : ""}{payload.nayax.error ? ` · ${payload.nayax.error}` : ""}. Nayax data is never added to kiosk revenue.</Text></Box> : null}
    </PortalShell>
  );
}

export const getServerSideProps: GetServerSideProps<SalesPageProps> = async (context) => {
  const result = await requirePortalSession(context);
  if ("redirect" in result) return { redirect: result.redirect };
  return { props: { session: result.session } };
};
