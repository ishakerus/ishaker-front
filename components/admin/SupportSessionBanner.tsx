import { Box, Button, HStack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import type { PortalSession } from "../../types/portal";

export function SupportSessionBanner({ session }: { session?: PortalSession }) {
  const [now, setNow] = useState<number | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");
  const [hidden, setHidden] = useState(false);
  const support = session?.support;
  const hiddenKey = support
    ? `support-banner-hidden:${support.userId}:${support.machineId}:${support.expiresAt}`
    : null;

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!hiddenKey) {
      setHidden(false);
      return;
    }
    try {
      setHidden(Boolean(window.sessionStorage.getItem(hiddenKey)));
    } catch {
      setHidden(false);
    }
  }, [hiddenKey]);

  if (!support || hidden) return null;
  const expired = now !== null && now >= support.expiresAt;
  const minutes =
    now === null
      ? null
      : Math.max(0, Math.ceil((support.expiresAt - now) / 60_000));
  const exit = async () => {
    setLeaving(true);
    try {
      const response = await fetch("/api/admin/cabinet/exit", {
        method: "POST",
      });
      if (!response.ok) throw new Error();
      window.location.href = "/admin/dashboard";
    } catch {
      setLeaving(false);
      setError("Could not close the session. Try again.");
    }
  };
  const hide = () => {
    try {
      if (hiddenKey) window.sessionStorage.setItem(hiddenKey, "1");
    } catch {
      // Hiding should still work when session storage is unavailable.
    }
    setHidden(true);
  };
  return (
    <Box
      bg="acid.300"
      color="bg.1000"
      px="3"
      py="2"
      position="sticky"
      top="0"
      zIndex={1500}
      role="status"
    >
      <HStack justify="space-between" flexWrap="wrap" spacing="2">
        <Box>
          <Text fontWeight="bold" fontSize="xs" lineHeight="1.3">
            Support: {support.username} · {session.client.company}
          </Text>
          <Text fontSize="11px" lineHeight="1.3">
            {expired
              ? "Support session expired. Reopen this cabinet from the dashboard."
              : `Your support permissions apply. Actions are recorded.${minutes === null ? "" : ` ${minutes} min remaining.`}`}
          </Text>
          {error ? (
            <Text color="red.700" fontSize="xs">
              {error}
            </Text>
          ) : null}
        </Box>
        <HStack spacing="1.5">
          <Button
            onClick={hide}
            variant="outline"
            borderColor="blackAlpha.600"
            color="bg.1000"
            _hover={{ bg: "blackAlpha.100" }}
            size="xs"
          >
            Hide
          </Button>
          <Button
            onClick={exit}
            isLoading={leaving}
            variant="outline"
            borderColor="blackAlpha.600"
            color="bg.1000"
            _hover={{ bg: "blackAlpha.100" }}
            size="xs"
          >
            Exit to dashboard
          </Button>
        </HStack>
      </HStack>
    </Box>
  );
}
