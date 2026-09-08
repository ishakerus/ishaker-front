import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  HStack,
  Input,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import type { GetServerSideProps } from "next";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "../../components/admin";
import Loader from "../../components/shared/Loader";
import { requireAdminSession } from "../../lib/admin/auth";

export default function AdminTranslationSetsPage() {
  const [sets, setSets] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      const response = await fetch("/api/admin/translation-sets");
      const payload = await response.json().catch(() => null);
      setIsLoading(false);
      if (!response.ok) {
        setError("Text packs could not be loaded.");
        return;
      }
      setSets(payload?.sets || []);
    };
    void load();
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sets;
    return sets.filter((set) =>
      [
        set.name,
        set.slug,
        set.language?.name,
        set.client?.company,
        ...(set.machines || []).flatMap((machine: any) => [
          machine.title,
          machine.serial_number,
        ]),
      ].some((value) => String(value || "").toLowerCase().includes(normalized)),
    );
  }, [query, sets]);

  return (
    <AdminShell title="Text packs">
      <Box bg="bg.900" p="5" borderRadius="2xl" mb="5">
        <HStack justify="space-between" flexWrap="wrap">
          <Box>
            <Text color="acid.300" fontWeight="800">Localization text packs</Text>
            <Text color="bg.300" fontSize="sm">
              Root packs are read-only. Client packs contain overrides only.
            </Text>
          </Box>
          <Input
            maxW="340px"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pack, client, or machine"
          />
        </HStack>
      </Box>
      {isLoading ? <Loader size="lg" mb="5" /> : null}
      {error ? <Alert status="error" mb="5"><AlertIcon />{error}</Alert> : null}
      <TableContainer bg="bg.900" borderRadius="2xl" overflowX="auto">
        <Table size="sm" minW="1100px">
          <Thead bg="bg.800">
            <Tr>
              <Th>Pack</Th>
              <Th>Type</Th>
              <Th>Language</Th>
              <Th>Client</Th>
              <Th isNumeric>Keys</Th>
              <Th>Based on</Th>
              <Th>Machines</Th>
              <Th>Status</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filtered.map((set) => (
              <Tr key={set.id}>
                <Td>
                  <Text fontWeight="800">{set.name}</Text>
                  <Text color="bg.400" fontFamily="mono" fontSize="xs">{set.slug || `#${set.id}`}</Text>
                </Td>
                <Td><Badge colorScheme={set.is_root ? "purple" : "blue"}>{set.is_root ? "Root · read-only" : "Client"}</Badge></Td>
                <Td>{set.language?.name || "—"}</Td>
                <Td>{set.client?.company || "—"}</Td>
                <Td isNumeric>{set.entry_count ?? 0}</Td>
                <Td>{set.based_on?.name || "—"}</Td>
                <Td whiteSpace="normal">
                  {(set.machines || []).length
                    ? set.machines.map((machine: any) => machine.serial_number || `#${machine.id}`).join(", ")
                    : "—"}
                </Td>
                <Td><Badge colorScheme={set.isActive === false ? "gray" : "green"}>{set.isActive === false ? "Inactive" : "Active"}</Badge></Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableContainer>
    </AdminShell>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const redirect = await requireAdminSession(context);
  return redirect || { props: {} };
};
