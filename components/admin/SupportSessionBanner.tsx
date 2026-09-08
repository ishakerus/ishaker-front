import { Box, Button, HStack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import type { PortalSession } from "../../types/portal";

export function SupportSessionBanner({ session }: { session?: PortalSession }) {
  const [now, setNow] = useState<number | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (!session?.support) return null;
  const support = session.support;
  const expired = now !== null && now >= support.expiresAt;
  const minutes = now === null ? null : Math.max(0, Math.ceil((support.expiresAt - now) / 60_000));
  const exit = async () => {
    setLeaving(true);
    try {
      const response = await fetch("/api/admin/cabinet/exit", { method: "POST" });
      if (!response.ok) throw new Error();
      window.location.href = "/admin/dashboard";
    } catch { setLeaving(false); setError("Could not close the session. Try again."); }
  };
  return (
    <Box bg="orange.100" color="gray.900" px="5" py="3" position="sticky" top="0" zIndex={1500} role="status">
      <HStack justify="space-between" flexWrap="wrap">
        <Box>
          <Text fontWeight="bold">Support: {support.username} · {session.client.company}</Text>
          <Text fontSize="sm">{expired ? "Support session expired. Reopen this cabinet from the dashboard." : `Your support permissions apply. Actions are recorded.${minutes === null ? "" : ` ${minutes} min remaining.`}`}</Text>
          {error ? <Text color="red.700">{error}</Text> : null}
        </Box>
        <Button onClick={exit} isLoading={leaving} colorScheme="orange" size="sm">Exit to dashboard</Button>
      </HStack>
    </Box>
  );
}
