import { Box, Button, Flex, FormControl, FormLabel, Heading, Input, Text } from "@chakra-ui/react";
import { NextSeo } from "next-seo";
import { useRouter } from "next/router";
import { FormEvent, useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      if (!response.ok) {
        setError(response.status === 429 ? "Too many attempts. Try again in 15 minutes." :
          response.status === 503 ? "Sign-in is temporarily unavailable." : "Invalid login or password, or support access is disabled.");
        return;
      }
      await router.replace("/admin/dashboard");
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <NextSeo title="Admin Login" noindex nofollow />
      <Flex
        minH="100vh"
        bg="bg.1000"
        color="bg.100"
        align="center"
        justify="center"
        px={{ base: 5, md: 8 }}
      >
        <Box w="100%" maxW="420px">
          <Text color="acid.300" fontSize="sm" fontWeight="700" letterSpacing="0" mb={3}>
            iShaker Admin
          </Text>
          <Heading as="h1" color="bg.50" fontSize={{ base: "34px", md: "42px" }} lineHeight="1" mb={4}>
            Private cabinet
          </Heading>
          <Text color="bg.300" mb={8}>
            Sign in with your individual support account.
          </Text>

          <Box
            as="form"
            onSubmit={onSubmit}
            bg="bg.900"
            border="1px solid"
            borderColor="whiteAlpha.100"
            borderRadius="8px"
            p={{ base: 5, md: 6 }}
            boxShadow="0 18px 55px rgba(0, 0, 0, 0.28)"
          >
            <FormControl mb={5} isRequired>
              <FormLabel color="bg.100" fontWeight="700">Login or email</FormLabel>
              <Input value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} bg="bg.800" borderColor="whiteAlpha.200" color="bg.50" h="48px" />
            </FormControl>
            <FormControl isRequired>
              <FormLabel color="bg.100" fontWeight="700">Password</FormLabel>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                bg="bg.800"
                borderColor="whiteAlpha.200"
                color="bg.50"
                h="48px"
                _hover={{ borderColor: "acid.300" }}
                _focus={{
                  borderColor: "acid.300",
                  boxShadow: "0 0 0 1px var(--chakra-colors-acid-300)",
                }}
              />
            </FormControl>

            {error ? (
              <Text color="red.300" fontSize="sm" mt={3}>
                {error}
              </Text>
            ) : null}

            <Button
              type="submit"
              isLoading={isLoading}
              isDisabled={!identifier.trim() || !password}
              mt={6}
              w="100%"
              h="48px"
              bg="acid.300"
              color="bg.1000"
              borderRadius="8px"
              _hover={{ bg: "acid.200" }}
              _active={{ bg: "acid.400" }}
            >
              Sign in
            </Button>
          </Box>
        </Box>
      </Flex>
    </>
  );
}
