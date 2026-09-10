import {
  Box,
  Button,
  Container,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  HStack,
  Icon,
  IconButton,
  Text,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { TouchEvent, useEffect, useRef } from "react";
import {
  FiActivity,
  FiBookOpen,
  FiHome,
  FiLogIn,
  FiMenu,
  FiShoppingBag,
  FiTool,
  FiUserPlus,
} from "react-icons/fi";

type HeaderProps = { borderColor?: string };

export const siteNavItems = [
  { href: "/", label: "Home", icon: FiHome },
  { href: "/shop", label: "iShaker Shop", icon: FiShoppingBag },
  { href: "/stats", label: "Realtime Sales", icon: FiActivity },
  { href: "/articles", label: "Maintenance", icon: FiTool },
];

const isActivePath = (pathname: string, href: string) =>
  href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);

export function Header({ borderColor = "whiteAlpha.100" }: HeaderProps) {
  const router = useRouter();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    router.events.on("routeChangeStart", onClose);
    return () => router.events.off("routeChangeStart", onClose);
  }, [onClose, router.events]);

  const startSwipe = (event: TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const finishSwipe = (event: TouchEvent) => {
    const startX = touchStartX.current;
    const endX = event.changedTouches[0]?.clientX;
    touchStartX.current = null;
    if (startX !== null && endX !== undefined && endX - startX > 55) onClose();
  };

  return (
    <>
      <Box
        as="header"
        position="sticky"
        top="0"
        zIndex="sticky"
        borderBottom="1px solid"
        borderColor={borderColor}
        bg="rgba(20, 19, 19, 0.86)"
        backdropFilter="blur(18px)"
        boxShadow="0 12px 35px rgba(0,0,0,.14)"
      >
        <Container maxW="7xl" py={{ base: "2.5", md: "3" }}>
          <Flex align="center" justify="space-between" gap="5">
            <Box
              as={Link}
              href="/"
              display="block"
              flexShrink={0}
              aria-label="iShaker home"
            >
              <Box
                position="relative"
                w={{ base: "116px", md: "138px" }}
                h="44px"
              >
                <Image
                  src="/logo.png"
                  alt="iShaker logo"
                  fill
                  priority
                  sizes="138px"
                  style={{ objectFit: "contain" }}
                />
              </Box>
            </Box>

            <HStack
              display={{ base: "none", lg: "flex" }}
              spacing="1"
              flex="1"
              justify="center"
            >
              {siteNavItems.map((item) => {
                const active = isActivePath(router.pathname, item.href);
                return (
                  <Flex
                    key={item.href}
                    as={Link}
                    href={item.href}
                    px={{ lg: "2.5", xl: "3.5" }}
                    py="2.5"
                    gap="2"
                    align="center"
                    borderRadius="xl"
                    color={active ? "acid.300" : "whiteAlpha.700"}
                    bg={active ? "whiteAlpha.100" : "transparent"}
                    fontWeight="700"
                    fontSize={{ lg: "xs", xl: "sm" }}
                    whiteSpace="nowrap"
                    transition="all 160ms ease"
                    _hover={{ color: "white", bg: "whiteAlpha.100" }}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon as={item.icon} boxSize="17px" />
                    <Text>{item.label}</Text>
                  </Flex>
                );
              })}
            </HStack>

            <HStack
              display={{ base: "none", lg: "flex" }}
              spacing="2"
              flexShrink={0}
            >
              <Button
                as={Link}
                href="/login"
                variant="primary"
                size="sm"
                leftIcon={<FiLogIn />}
              >
                Login
              </Button>
              <Button
                as={Link}
                href="/get-started"
                variant="contrast"
                size="sm"
                leftIcon={<FiUserPlus />}
              >
                Register
              </Button>
            </HStack>

            <IconButton
              display={{ base: "inline-flex", lg: "none" }}
              aria-label="Open navigation"
              icon={<FiMenu size="22px" />}
              onClick={onOpen}
              variant="ghost"
              color="white"
              border="1px solid"
              borderColor="whiteAlpha.200"
            />
          </Flex>
        </Container>
      </Box>

      <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="xs">
        <DrawerOverlay bg="blackAlpha.700" backdropFilter="blur(4px)" />
        <DrawerContent
          bg="#151717"
          color="white"
          borderLeft="1px solid"
          borderColor="whiteAlpha.100"
          onTouchStart={startSwipe}
          onTouchEnd={finishSwipe}
        >
          <DrawerCloseButton mt="2" color="whiteAlpha.700" />
          <DrawerHeader
            pt="7"
            pb="5"
            borderBottom="1px solid"
            borderColor="whiteAlpha.100"
          >
            <Box position="relative" w="132px" h="42px">
              <Image
                src="/logo.png"
                alt="iShaker"
                fill
                sizes="132px"
                style={{ objectFit: "contain" }}
              />
            </Box>
          </DrawerHeader>
          <DrawerBody px="4" py="5">
            <VStack align="stretch" spacing="2">
              {siteNavItems.map((item) => {
                const active = isActivePath(router.pathname, item.href);
                return (
                  <Flex
                    key={item.href}
                    as={Link}
                    href={item.href}
                    align="center"
                    gap="3"
                    p="3.5"
                    borderRadius="xl"
                    color={active ? "acid.300" : "whiteAlpha.800"}
                    bg={active ? "rgba(118,248,95,.09)" : "transparent"}
                    border="1px solid"
                    borderColor={
                      active ? "rgba(118,248,95,.22)" : "transparent"
                    }
                    fontWeight="750"
                    _hover={{ bg: "whiteAlpha.100", color: "white" }}
                    aria-current={active ? "page" : undefined}
                  >
                    <Flex
                      boxSize="9"
                      align="center"
                      justify="center"
                      borderRadius="lg"
                      bg="whiteAlpha.100"
                    >
                      <Icon as={item.icon} boxSize="18px" />
                    </Flex>
                    <Text>{item.label}</Text>
                  </Flex>
                );
              })}
            </VStack>

            <VStack
              mt="7"
              pt="6"
              borderTop="1px solid"
              borderColor="whiteAlpha.100"
              spacing="3"
            >
              <Button
                as={Link}
                href="/get-started"
                variant="contrast"
                w="full"
                leftIcon={<FiUserPlus />}
              >
                Create account
              </Button>
              <Button
                as={Link}
                href="/login"
                variant="primary"
                w="full"
                leftIcon={<FiLogIn />}
              >
                Login
              </Button>
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}
