import {
  Box,
  Button,
  HStack,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { GetServerSideProps } from "next";
import { NextSeo } from "next-seo";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminHeader } from "../../../components/admin/AdminHeader";
import { MachineReadinessPanel } from "../../../components/admin/MachineReadinessPanel";
import { MachineDoorUnlockPanel } from "../../../components/admin/MachineDoorUnlockPanel";
import { MachineField } from "../../../components/admin/MachineField";
import { MachineFreeMode } from "../../../components/machines/MachineFreeMode";
import { requireAdminSession } from "../../../lib/admin/auth";
import { getMachinePatchVersion } from "../../../lib/admin/machinePatch";
import { requestStrapiRestAsService } from "../../../services/server/strapiClient";
import type { Machine } from "../../../types/strapi";

type AdminMachineReadinessPageProps = {
  machine: Machine;
  readinessReferenceTime: number;
};

export default function AdminMachineReadinessPage({
  machine,
  readinessReferenceTime,
}: AdminMachineReadinessPageProps) {
  const [readinessNow, setReadinessNow] = useState(readinessReferenceTime);

  useEffect(() => {
    const interval = window.setInterval(() => setReadinessNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <>
      <NextSeo
        title={`${machine.title || `Machine ${machine.id}`} readiness`}
        noindex
        nofollow
      />
      <Box minH="100vh" bg="bg.1000" color="bg.100">
        <AdminHeader title="Machine readiness" />
        <Box
          maxW="1280px"
          mx="auto"
          px={{ base: 4, md: 8 }}
          py={{ base: 6, md: 8 }}
        >
          <HStack justify="space-between" align="flex-start" mb="6">
            <Box>
              <Text color="bg.50" fontSize="2xl" fontWeight="900">
                {machine.title || `Machine #${machine.id}`}
              </Text>
              <Text color="bg.300">
                {machine.client?.company || "Unassigned client"} · Serial{" "}
                {machine.serial_number || "not set"}
              </Text>
            </Box>
            <Button
              as={Link}
              href="/admin/dashboard"
              variant="outline"
              borderColor="whiteAlpha.200"
              flexShrink={0}
            >
              Back to fleet
            </Button>
          </HStack>

          <VStack spacing="5" align="stretch">
            <MachineReadinessPanel
              readiness={machine.readiness}
              now={readinessNow}
            />

            <MachineDoorUnlockPanel machine={machine} />

            <MachineFreeMode machineId={machine.id} apiScope="admin" />

            <Box
              bg="bg.900"
              border="1px solid"
              borderColor="whiteAlpha.100"
              borderRadius="8px"
              p={{ base: 4, md: 5 }}
            >
              <Text color="acid.300" fontWeight="800" mb="4">
                Machine identifiers
              </Text>
              <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing="4">
                <MachineField label="Machine ID" value={String(machine.id)} />
                <MachineField label="Serial" value={machine.serial_number} />
                <MachineField label="AnyDesk" value={machine.anydesk_id} />
                <MachineField
                  label="Patch version"
                  value={getMachinePatchVersion(machine)}
                />
              </SimpleGrid>
            </Box>
          </VStack>
        </Box>
      </Box>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<
  AdminMachineReadinessPageProps
> = async (context) => {
  const redirect = await requireAdminSession(context);
  if (redirect) return redirect;

  const machineId = Array.isArray(context.params?.id)
    ? context.params?.id[0]
    : context.params?.id;
  if (!machineId) return { notFound: true };

  try {
    const params = new URLSearchParams();
    params.set("populate[0]", "client");
    params.set("populate[1]", "machine_type");
    params.set("populate[2]", "patch");
    const machine = await requestStrapiRestAsService<Machine>(
      `/api/machines/${encodeURIComponent(machineId)}?${params.toString()}`,
    );

    if (!machine?.id) return { notFound: true };
    return {
      props: {
        machine,
        readinessReferenceTime: Date.now(),
      },
    };
  } catch (error) {
    if ((error as { status?: number }).status === 404) {
      return { notFound: true };
    }
    throw error;
  }
};
