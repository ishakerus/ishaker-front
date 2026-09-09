import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Checkbox,
  Container,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Text,
  VStack,
} from "@chakra-ui/react";
import { NextSeo } from "next-seo";
import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useState } from "react";
import {
  FiActivity,
  FiArrowRight,
  FiEye,
  FiEyeOff,
  FiLock,
  FiMail,
  FiTool,
} from "react-icons/fi";
import { Header } from "../components/home/Header";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const queryIdentifier = Array.isArray(router.query.identifier)
      ? router.query.identifier[0]
      : router.query.identifier;
    if (queryIdentifier) setIdentifier(queryIdentifier.toLowerCase());
  }, [router.query.identifier]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.toLowerCase(),
          password,
        }),
      });
      if (!response.ok) {
        setError(
          "We couldn’t sign you in. Check your nickname or email and password.",
        );
        return;
      }
      const payload = await response.json().catch(() => null);
      if (payload?.role === "support") {
        await router.replace(payload.redirectTo || "/admin");
        return;
      }
      await router.replace(
        router.query.reason === "nickname-exists"
          ? "/step1"
          : payload?.redirectTo || "/machines",
      );
    } catch {
      setError("The portal is temporarily unavailable. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <NextSeo
        title="Login"
        description="Sign in to your iShaker client portal."
        noindex
        nofollow
      />
      <Box minH="100vh" bg="#0d1010" color="white" overflow="hidden">
        <Header borderColor="whiteAlpha.100" />
        <Box position="relative">
          <Box
            position="absolute"
            top="-100px"
            right="-120px"
            boxSize="520px"
            borderRadius="full"
            bg="acid.400"
            opacity="0.07"
            filter="blur(110px)"
            pointerEvents="none"
          />
          <Container
            maxW="6xl"
            py={{ base: "10", md: "16", lg: "20" }}
            position="relative"
          >
            <Flex
              direction={{ base: "column", lg: "row" }}
              border="1px solid"
              borderColor="whiteAlpha.100"
              borderRadius={{ base: "2xl", md: "3xl" }}
              overflow="hidden"
              bg="rgba(255,255,255,.035)"
              boxShadow="0 35px 100px rgba(0,0,0,.34)"
            >
              <Flex
                flex="1"
                direction="column"
                justify="space-between"
                p={{ base: "7", md: "10", lg: "12" }}
                bgGradient="linear(to-br, rgba(118,248,95,.13), rgba(122,109,225,.08))"
              >
                <Box>
                  <Text
                    color="acid.300"
                    fontSize="sm"
                    fontWeight="800"
                    letterSpacing=".12em"
                    textTransform="uppercase"
                    mb="5"
                  >
                    Client Panel
                  </Text>
                  <Heading
                    as="h1"
                    color="white"
                    fontSize={{ base: "4xl", md: "5xl" }}
                    lineHeight="1.02"
                    letterSpacing="-.04em"
                    m="0"
                    mb="5"
                  >
                    Your machines.
                    <br />
                    One clear view.
                  </Heading>
                  <Text
                    color="whiteAlpha.700"
                    fontSize="lg"
                    lineHeight="1.7"
                    maxW="460px"
                  >
                    Sign in to monitor performance, follow sales, and keep every
                    iShaker ready to serve.
                  </Text>
                </Box>
                <VStack
                  align="stretch"
                  spacing="4"
                  mt={{ base: "10", lg: "20" }}
                >
                  {[
                    {
                      icon: FiActivity,
                      text: "Live sales and performance insights",
                    },
                    {
                      icon: FiTool,
                      text: "Machine health and maintenance tools",
                    },
                    { icon: FiLock, text: "Secure access to your portal data" },
                  ].map((item) => (
                    <Flex
                      key={item.text}
                      align="center"
                      gap="3"
                      color="whiteAlpha.800"
                    >
                      <Flex
                        boxSize="9"
                        align="center"
                        justify="center"
                        bg="whiteAlpha.100"
                        borderRadius="lg"
                        color="acid.300"
                      >
                        <Icon as={item.icon} />
                      </Flex>
                      <Text fontWeight="650">{item.text}</Text>
                    </Flex>
                  ))}
                </VStack>
              </Flex>

              <Box
                flex="0 0 48%"
                bg="#171919"
                p={{ base: "7", md: "10", lg: "12" }}
              >
                <Heading
                  as="h2"
                  color="white"
                  fontSize={{ base: "3xl", md: "4xl" }}
                  m="0"
                  mb="2"
                >
                  Welcome back
                </Heading>
                <Text color="whiteAlpha.600" mb="8">
                  {router.query.reason === "nickname-exists"
                    ? "That nickname already has an account. Sign in to continue registration."
                    : "Enter your portal details to continue."}
                </Text>

                <Box as="form" onSubmit={onSubmit}>
                  <VStack spacing="5" align="stretch">
                    <FormControl isRequired>
                      <FormLabel color="whiteAlpha.800" fontSize="sm">
                        Nickname or email
                      </FormLabel>
                      <InputGroup size="lg">
                        <InputLeftElement
                          pointerEvents="none"
                          color="whiteAlpha.400"
                        >
                          <FiMail />
                        </InputLeftElement>
                        <Input
                          type="text"
                          value={identifier}
                          onChange={(event) =>
                            setIdentifier(event.target.value.toLowerCase())
                          }
                          autoComplete="username"
                          autoCapitalize="none"
                          placeholder="your_nickname"
                          bg="whiteAlpha.50"
                          borderColor="whiteAlpha.200"
                          _placeholder={{ color: "whiteAlpha.300" }}
                        />
                      </InputGroup>
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel color="whiteAlpha.800" fontSize="sm">
                        Password
                      </FormLabel>
                      <InputGroup size="lg">
                        <InputLeftElement
                          pointerEvents="none"
                          color="whiteAlpha.400"
                        >
                          <FiLock />
                        </InputLeftElement>
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          autoComplete="current-password"
                          placeholder="Enter your password"
                          bg="whiteAlpha.50"
                          borderColor="whiteAlpha.200"
                          _placeholder={{ color: "whiteAlpha.300" }}
                          pr="12"
                        />
                        <InputRightElement>
                          <IconButton
                            aria-label={
                              showPassword ? "Hide password" : "Show password"
                            }
                            icon={showPassword ? <FiEyeOff /> : <FiEye />}
                            onClick={() => setShowPassword((value) => !value)}
                            variant="ghost"
                            size="sm"
                            color="whiteAlpha.600"
                          />
                        </InputRightElement>
                      </InputGroup>
                    </FormControl>
                    <Checkbox
                      colorScheme="green"
                      color="whiteAlpha.600"
                      size="sm"
                    >
                      Keep me signed in on this device
                    </Checkbox>
                  </VStack>

                  {error ? (
                    <Alert status="error" mt="5">
                      <AlertIcon />
                      {error}
                    </Alert>
                  ) : null}

                  <Button
                    mt="7"
                    type="submit"
                    variant="primary"
                    size="lg"
                    w="full"
                    isLoading={isLoading}
                    isDisabled={!identifier.trim() || !password}
                    rightIcon={<FiArrowRight />}
                  >
                    Sign in
                  </Button>
                  <Text
                    color="whiteAlpha.500"
                    fontSize="sm"
                    textAlign="center"
                    mt="6"
                  >
                    New to iShaker?{" "}
                    <Box
                      as={Link}
                      href="/get-started"
                      color="acid.300"
                      fontWeight="800"
                    >
                      Create your account
                    </Box>
                  </Text>
                </Box>
              </Box>
            </Flex>
          </Container>
        </Box>
      </Box>
    </>
  );
}
