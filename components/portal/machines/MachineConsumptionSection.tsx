import {
  Alert, AlertIcon, Badge, Box, FormControl, FormLabel, HStack, Select,
  SimpleGrid, Table, TableContainer, Tbody, Td, Text, Th, Thead, Tr,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import type { PortalMachineCell } from "../../../types/portal";
import type { Machine, SalesSummary } from "../../../types/strapi";
import { getMachineContainerCount } from "../../../lib/portal/containerSlots";

type Props = {
  machine: Machine;
  initialCells?: PortalMachineCell[];
};

const finite = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const forecastColor = (days: number | null) => days !== null && days < 3 ? "red" : days !== null && days < 7 ? "yellow" : "green";
const forecast = (remaining: number, used: number, days: number) => used > 0 ? remaining / (used / days) : null;
const forecastLabel = (days: number | null) => days === null ? "No usage yet" : `${days < 10 ? days.toFixed(1) : Math.round(days)} days`;

export function MachineConsumptionSection({ machine, initialCells }: Props) {
  const [period, setPeriod] = useState(30);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [cells, setCells] = useState<PortalMachineCell[]>(initialCells || []);
  const [error, setError] = useState("");
  const range = useMemo(() => {
    const to = new Date();
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - period);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [period]);

  useEffect(() => {
    if (initialCells) setCells(initialCells);
  }, [initialCells]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ machineId: String(machine.id), group: "cell", ...range });
    const requests: Promise<Response>[] = [fetch(`/api/portal/sales-summary?${params}`, { cache: "no-store" })];
    if (!initialCells) requests.push(fetch(`/api/portal/machines/${machine.id}/cells`, { cache: "no-store" }));
    Promise.all(requests).then(async (responses) => {
      const bodies = await Promise.all(responses.map((response) => response.json().catch(() => null)));
      if (!responses[0].ok) throw new Error(bodies[0]?.message || "Consumption could not be loaded.");
      if (responses[1] && !responses[1].ok) throw new Error(bodies[1]?.message || "Inventory could not be loaded.");
      if (!active) return;
      setSummary(bodies[0]);
      if (bodies[1]) setCells(bodies[1]);
      setError("");
    }).catch((caught) => active && setError(caught instanceof Error ? caught.message : "Consumption could not be loaded."));
    return () => { active = false; };
  }, [initialCells, machine.id, range]);

  const usageByCell = new Map((summary?.groups || []).map((row) => [row.key, row]));
  const waterLiters = finite(machine.water_amount_liters);
  const cupsRemaining = finite(machine.cups_amount);
  const waterDays = forecast(waterLiters * 1000, finite(summary?.totals.water_ml), period);
  const cupDays = forecast(cupsRemaining, finite(summary?.totals.cups_used), period);

  return (
    <Box bg="bg.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="2xl" p={{ base: 5, md: 6 }}>
      <HStack justify="space-between" align="end" mb="4" flexWrap="wrap">
        <Box><Text color="acid.300" fontWeight="800" fontSize="lg">Consumption and remaining inventory</Text><Text color="bg.300" mt="1">Usage from drinks dispensed by this machine.</Text></Box>
        <FormControl maxW="180px"><FormLabel fontSize="sm">Period</FormLabel><Select value={period} onChange={(event) => setPeriod(Number(event.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></Select></FormControl>
      </HStack>
      {error ? <Alert status="error" mb="4"><AlertIcon />{error}</Alert> : null}
      {summary?.truncated ? <Alert status="warning" mb="4"><AlertIcon />More than 20,000 drinks match this period. Choose a shorter period; incomplete forecasts are hidden.</Alert> : null}
      {!summary?.truncated ? <>
        <TableContainer><Table><Thead><Tr><Th pl="0">Cell</Th><Th>Product</Th><Th isNumeric>Cups</Th><Th isNumeric>Used</Th><Th isNumeric>Remaining</Th><Th pr="0">Forecast</Th></Tr></Thead><Tbody>{[...cells].sort((a, b) => a.position - b.position).map((cell) => {
          const usage = usageByCell.get(String(cell.position));
          const used = finite(usage?.powder_g);
          const remaining = finite(cell.amount_kg) * 1000;
          const powderCount = getMachineContainerCount(machine.machine_type);
          const unit = powderCount !== null && cell.position > powderCount ? "ml" : "g";
          const days = forecast(remaining, used, period);
          return <Tr key={cell.id}><Td pl="0">{cell.position}</Td><Td>{cell.product?.product_line?.name || cell.product?.name || "Unassigned"}{cell.product?.taste?.name ? ` · ${cell.product.taste.name}` : ""}</Td><Td isNumeric>{usage?.cups || 0}</Td><Td isNumeric>{used.toFixed(0)} {unit}</Td><Td isNumeric>{remaining.toFixed(0)} {unit}</Td><Td pr="0"><Badge colorScheme={forecastColor(days)}>{forecastLabel(days)}</Badge></Td></Tr>;
        })}</Tbody></Table></TableContainer>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing="4" mt="5">
          <Box bg="whiteAlpha.50" borderRadius="xl" p="4"><Text color="bg.300" fontSize="sm">Water</Text><Text fontWeight="800">{(finite(summary?.totals.water_ml) / 1000).toFixed(1)} L used · {waterLiters.toFixed(1)} L remaining</Text><Badge mt="2" colorScheme={forecastColor(waterDays)}>{forecastLabel(waterDays)}</Badge></Box>
          <Box bg="whiteAlpha.50" borderRadius="xl" p="4"><Text color="bg.300" fontSize="sm">Cups</Text><Text fontWeight="800">{finite(summary?.totals.cups_used)} used · {cupsRemaining} remaining</Text><Badge mt="2" colorScheme={forecastColor(cupDays)}>{forecastLabel(cupDays)}</Badge></Box>
        </SimpleGrid>
      </> : null}
      <Text color="bg.300" fontSize="xs" mt="4">Consumption is calculated from the recipe; actual amounts can differ because the machine doses by time. Current powder, syrup, water, and cup remains come from the machine’s post-dispense inventory sync.</Text>
    </Box>
  );
}
