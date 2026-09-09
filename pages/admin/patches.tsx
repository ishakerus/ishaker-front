import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Flex,
  HStack,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { GetServerSideProps } from "next";
import { AdminShell } from "../../components/admin/AdminShell";
import { PatchDescription } from "../../components/admin/PatchDescription";
import { requireAdminSession } from "../../lib/admin/auth";
import normalize from "../../services/normalizer";
import { AdminPatchesQuery } from "../../services/queries";
import { requestStrapiAsService } from "../../services/server/strapiClient";
import type { Patch } from "../../types/strapi";

type AdminPatchesPageProps = {
  patches: Patch[];
  loadError?: string;
};

export default function AdminPatchesPage({
  patches,
  loadError,
}: AdminPatchesPageProps) {
  const sortedPatches = [...patches].sort(
    (left, right) => Number(right.id) - Number(left.id),
  );

  return (
    <AdminShell title="Patches">
      <Flex
        align={{ base: "flex-start", sm: "center" }}
        justify="space-between"
        direction={{ base: "column", sm: "row" }}
        gap="2"
        mb="5"
      >
        <Box>
          <Text color="acid.300" fontWeight="900" fontSize="lg">
            Patch history
          </Text>
          <Text color="bg.400" fontSize="sm">
            Latest to oldest
          </Text>
        </Box>
        <Text color="bg.400" fontSize="sm">
          {sortedPatches.length} patches
        </Text>
      </Flex>

      {loadError ? (
        <Alert status="error" borderRadius="12px" mb="5">
          <AlertIcon />
          {loadError}
        </Alert>
      ) : null}

      <VStack align="stretch" spacing="4">
        {sortedPatches.map((patch) => {
          const stable = patch.isStable === true;
          return (
            <Box
              as="article"
              key={patch.id}
              bg="bg.900"
              border="1px solid"
              borderColor="whiteAlpha.100"
              borderRadius={{ base: "14px", md: "18px" }}
              p={{ base: "4", md: "6" }}
            >
              <Flex
                align="flex-start"
                direction={{ base: "column", md: "row" }}
                gap={{ base: "4", md: "7" }}
              >
                <Box minW={{ md: "150px" }}>
                  <Text
                    color="bg.500"
                    fontSize="xs"
                    fontWeight="800"
                    letterSpacing="0.12em"
                  >
                    PATCH
                  </Text>
                  <Text
                    color="bg.50"
                    fontSize={{ base: "56px", md: "72px" }}
                    fontWeight="900"
                    letterSpacing="-0.06em"
                    lineHeight="0.95"
                  >
                    {patch.id}
                  </Text>
                  <HStack mt="3" spacing="2" flexWrap="wrap">
                    <Badge
                      colorScheme={stable ? "green" : "orange"}
                      borderRadius="full"
                      px="2.5"
                      py="1"
                      textTransform="none"
                    >
                      {stable ? "Stable" : "Unstable"}
                    </Badge>
                    {patch.slug && patch.slug !== String(patch.id) ? (
                      <Text color="bg.500" fontFamily="mono" fontSize="xs">
                        {patch.slug}
                      </Text>
                    ) : null}
                  </HStack>
                </Box>

                <Box
                  flex="1"
                  minW="0"
                  pt={{ md: "3" }}
                  borderTop={{ base: "1px solid", md: "0" }}
                  borderColor="whiteAlpha.100"
                >
                  <PatchDescription description={patch.fix_summary} />
                </Box>
              </Flex>
            </Box>
          );
        })}
      </VStack>

      {!loadError && !sortedPatches.length ? (
        <Text color="bg.400" textAlign="center" py="16">
          No patches found.
        </Text>
      ) : null}
    </AdminShell>
  );
}

export const getServerSideProps: GetServerSideProps<
  AdminPatchesPageProps
> = async (context) => {
  const redirect = await requireAdminSession(context);
  if (redirect) return redirect;

  try {
    const result = normalize(
      await requestStrapiAsService<any>(AdminPatchesQuery),
    );
    return { props: { patches: (result?.patches || []) as Patch[] } };
  } catch (error) {
    console.error("[admin/patches] load failed:", error);
    return {
      props: {
        patches: [],
        loadError:
          "Patch history is unavailable. Check Strapi connection and service credentials.",
      },
    };
  }
};
