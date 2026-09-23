import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  ButtonGroup,
  Flex,
  HStack,
  Icon,
  SimpleGrid,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import type { GetServerSideProps } from "next";
import { useEffect, useState } from "react";
import { FiInbox, FiMail, FiUser } from "react-icons/fi";
import { AdminShell } from "../../components/admin";
import Loader from "../../components/shared/Loader";
import { requireAdminSession } from "../../lib/admin/auth";
import type { Ticket } from "../../types/strapi";

type Resolution = boolean | null;

const resolutionStyle = (resolved: Resolution) => {
  if (resolved === true) {
    return {
      label: "Resolved",
      colorScheme: "green",
      borderColor: "green.400",
      background: "rgba(72, 187, 120, 0.07)",
    };
  }
  if (resolved === false) {
    return {
      label: "Not resolved",
      colorScheme: "red",
      borderColor: "red.400",
      background: "rgba(245, 101, 101, 0.07)",
    };
  }
  return {
    label: "Paused",
    colorScheme: "orange",
    borderColor: "orange.300",
    background: "rgba(237, 137, 54, 0.07)",
  };
};

const ticketType = (status: Ticket["status"]) => {
  if (status === "bug") return { label: "Bug", colorScheme: "red" };
  if (status === "question") {
    return { label: "Question", colorScheme: "blue" };
  }
  return { label: "Suggestion", colorScheme: "purple" };
};

const formatDate = (value?: string | null) => {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export default function AdminTicketsPage() {
  const toast = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    setIsLoading(true);
    setError("");
    const response = await fetch("/api/admin/tickets", { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    setIsLoading(false);

    if (!response.ok) {
      setError(payload?.message || "Tickets could not be loaded.");
      return;
    }
    setTickets(payload?.tickets || []);
  };

  useEffect(() => {
    void load();
  }, []);

  const setResolution = async (ticket: Ticket, resolved: Resolution) => {
    const id = String(ticket.id);
    setSavingId(id);
    const response = await fetch(`/api/admin/tickets/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resolved }),
    });
    const payload = await response.json().catch(() => null);
    setSavingId(null);

    if (!response.ok) {
      toast({
        title: "Status update failed",
        description:
          payload?.message || "Ticket status could not be updated.",
        status: "error",
      });
      return;
    }

    setTickets((current) =>
      current.map((item) =>
        String(item.id) === id
          ? {
              ...item,
              resolved,
              updatedAt: payload?.ticket?.updatedAt || item.updatedAt,
            }
          : item,
      ),
    );
    window.dispatchEvent(new Event("tickets-updated"));
    toast({ title: `Ticket marked ${resolutionStyle(resolved).label.toLowerCase()}`, status: "success" });
  };

  const counts = tickets.reduce(
    (result, ticket) => {
      if (ticket.resolved === true) result.resolved += 1;
      else if (ticket.resolved === false) result.open += 1;
      else result.paused += 1;
      return result;
    },
    { resolved: 0, open: 0, paused: 0 },
  );

  return (
    <AdminShell title="Tickets">
      {error ? (
        <Alert status="error" mb="6" borderRadius="xl">
          <AlertIcon />
          {error}
        </Alert>
      ) : null}

      <SimpleGrid columns={{ base: 1, sm: 3 }} spacing="4" mb="6">
        {[
          { label: "Not resolved", count: counts.open, color: "red.300" },
          { label: "Paused", count: counts.paused, color: "orange.300" },
          { label: "Resolved", count: counts.resolved, color: "green.300" },
        ].map((item) => (
          <Box
            key={item.label}
            bg="bg.900"
            border="1px solid"
            borderColor="whiteAlpha.100"
            borderRadius="2xl"
            p="5"
          >
            <Text color="bg.400" fontSize="sm" fontWeight="700">
              {item.label}
            </Text>
            <Text color={item.color} fontSize="3xl" fontWeight="900">
              {item.count}
            </Text>
          </Box>
        ))}
      </SimpleGrid>

      {isLoading ? <Loader size="lg" /> : null}

      {!isLoading && !tickets.length && !error ? (
        <VStack
          py="16"
          bg="bg.900"
          border="1px solid"
          borderColor="whiteAlpha.100"
          borderRadius="2xl"
          color="bg.400"
        >
          <Icon as={FiInbox} boxSize="9" />
          <Text fontWeight="700">No tickets yet</Text>
        </VStack>
      ) : null}

      <VStack align="stretch" spacing="4">
        {tickets.map((ticket) => {
          const resolution = resolutionStyle(ticket.resolved);
          const type = ticketType(ticket.status);
          const contact = ticket.client?.company || ticket.email || "Unknown";
          const hasClient = Boolean(ticket.client?.company);

          return (
            <Box
              key={ticket.id}
              bg={resolution.background}
              border="1px solid"
              borderColor="whiteAlpha.100"
              borderLeft="5px solid"
              borderLeftColor={resolution.borderColor}
              borderRadius="2xl"
              p={{ base: "5", md: "6" }}
            >
              <Flex
                direction={{ base: "column", md: "row" }}
                justify="space-between"
                align={{ base: "stretch", md: "flex-start" }}
                gap="5"
              >
                <Box minW="0" flex="1">
                  <HStack spacing="2" mb="3" flexWrap="wrap">
                    <Badge colorScheme={type.colorScheme}>{type.label}</Badge>
                    <Badge colorScheme={resolution.colorScheme}>
                      {resolution.label}
                    </Badge>
                    <Text color="bg.500" fontSize="xs">
                      #{ticket.id} · {formatDate(ticket.createdAt)}
                    </Text>
                  </HStack>

                  <HStack color="bg.300" fontSize="sm" mb="4">
                    <Icon as={hasClient ? FiUser : FiMail} />
                    <Text fontWeight="700">{contact}</Text>
                  </HStack>

                  <Text
                    color="bg.100"
                    lineHeight="1.75"
                    whiteSpace="pre-wrap"
                    overflowWrap="anywhere"
                  >
                    {ticket.description || "No message provided."}
                  </Text>
                </Box>

                <ButtonGroup
                  isAttached
                  size="sm"
                  isDisabled={savingId === String(ticket.id)}
                  flexShrink={0}
                >
                  <Button
                    colorScheme="red"
                    variant={ticket.resolved === false ? "solid" : "outline"}
                    onClick={() => void setResolution(ticket, false)}
                    aria-pressed={ticket.resolved === false}
                  >
                    Not resolved
                  </Button>
                  <Button
                    colorScheme="orange"
                    variant={ticket.resolved === null ? "solid" : "outline"}
                    onClick={() => void setResolution(ticket, null)}
                    aria-pressed={ticket.resolved === null}
                  >
                    Paused
                  </Button>
                  <Button
                    colorScheme="green"
                    variant={ticket.resolved === true ? "solid" : "outline"}
                    onClick={() => void setResolution(ticket, true)}
                    aria-pressed={ticket.resolved === true}
                  >
                    Resolved
                  </Button>
                </ButtonGroup>
              </Flex>
            </Box>
          );
        })}
      </VStack>
    </AdminShell>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const redirect = await requireAdminSession(context);
  return redirect || { props: {} };
};
