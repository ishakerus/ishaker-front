import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  IconButton,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Text,
} from "@chakra-ui/react";
import { FiMenu, FiPower } from "react-icons/fi";
import Link from "next/link";

const adminLinks = [
  ["/admin/dashboard", "Clients"],
  ["/admin/patches", "Patches"],
  ["/admin/currencies", "Currencies"],
  ["/admin/presets", "Presets"],
  ["/admin/languages", "Languages"],
  ["/admin/translations", "Translations"],
  ["/admin/translation-sets", "Text packs"],
  ["/admin/voice-clips", "Voice clips"],
];

export function AdminHeader({ title = "Client machines" }: { title?: string }) {
  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  };

  return (
    <Box
      borderBottom="1px solid"
      borderColor="whiteAlpha.100"
      bg="rgba(20,19,19,0.86)"
      position="sticky"
      top={0}
      zIndex={2}
    >
      <Flex
        maxW="1600px"
        mx="auto"
        px={{ base: 3, md: 6 }}
        py={{ base: 3, md: 4 }}
        align="center"
        justify="space-between"
        gap={4}
      >
        <Box minW="0">
          <Text
            fontSize={{ base: "xs", md: "sm" }}
            color="acid.300"
            fontWeight="700"
          >
            iShaker Admin
          </Text>
          <Heading
            as="h1"
            color="bg.50"
            fontSize={{ base: "20px", md: "34px" }}
            lineHeight="1.1"
            my={0}
            noOfLines={1}
          >
            {title}
          </Heading>
        </Box>

        <HStack
          display={{ base: "none", lg: "flex" }}
          flexWrap="wrap"
          justify="flex-end"
        >
          {adminLinks.map(([href, label]) => (
            <Button key={href} as={Link} href={href} size="sm" variant="ghost">
              {label}
            </Button>
          ))}
          <Button
            leftIcon={<FiPower />}
            onClick={logout}
            variant="outline"
            borderColor="whiteAlpha.200"
            color="bg.100"
            borderRadius="8px"
            _hover={{ bg: "whiteAlpha.100" }}
          >
            Logout
          </Button>
        </HStack>

        <Menu placement="bottom-end">
          <MenuButton
            display={{ base: "inline-flex", lg: "none" }}
            as={IconButton}
            aria-label="Open admin navigation"
            icon={<FiMenu />}
            variant="outline"
            borderColor="whiteAlpha.300"
            color="bg.100"
            borderRadius="10px"
          />
          <MenuList
            bg="bg.800"
            borderColor="whiteAlpha.200"
            boxShadow="xl"
            py="2"
          >
            {adminLinks.map(([href, label]) => (
              <MenuItem
                key={href}
                as={Link}
                href={href}
                bg="bg.800"
                color="bg.100"
                minH="44px"
                _hover={{ bg: "whiteAlpha.100" }}
                _focus={{ bg: "whiteAlpha.100" }}
              >
                {label}
              </MenuItem>
            ))}
            <MenuDivider borderColor="whiteAlpha.200" />
            <MenuItem
              icon={<FiPower />}
              onClick={logout}
              bg="bg.800"
              color="red.200"
              minH="44px"
              _hover={{ bg: "whiteAlpha.100" }}
              _focus={{ bg: "whiteAlpha.100" }}
            >
              Logout
            </MenuItem>
          </MenuList>
        </Menu>
      </Flex>
    </Box>
  );
}
