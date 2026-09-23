import { Box, Flex, Text } from "@chakra-ui/react";
import { TicketButton } from "./TicketButton";

export function SupportContactBox({
  hasKnownClient = false,
}: {
  hasKnownClient?: boolean;
}) {
  return (
    <Box
      w="full"
      mt="8"
      px={{ base: "5", md: "7" }}
      py={{ base: "5", md: "6" }}
      bg="whiteAlpha.50"
      border="1px solid"
      borderColor="whiteAlpha.100"
      borderRadius="2xl"
    >
      <Flex
        align={{ base: "flex-start", sm: "center" }}
        justify="center"
        direction={{ base: "column", sm: "row" }}
        gap={{ base: "2", sm: "1.5" }}
      >
        <Text color="bg.200">Something is not working as expected?</Text>
        <TicketButton
          title="Contact us"
          hasKnownClient={hasKnownClient}
          variant="link"
          color="acid.300"
          minH="auto"
          textDecoration="underline"
          _hover={{ color: "acid.200" }}
        />
      </Flex>
    </Box>
  );
}
