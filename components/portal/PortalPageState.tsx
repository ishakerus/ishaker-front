import {
  Box,
  Button,
  Container,
  HStack,
  Heading,
  Text,
  VStack,
} from "@chakra-ui/react";
import { NextSeo } from "next-seo";
import Link from "next/link";
import type { ReactNode } from "react";
import Loader from "../shared/Loader";
import { SupportSessionBanner } from "../admin/SupportSessionBanner";
import type { PortalPageError } from "../../lib/portal/usePortalPage";
import type { PortalSession } from "../../types/portal";

export function PortalPageContent({
  session,
  children,
}: {
  session: PortalSession;
  children: ReactNode;
}) {
  return (
    <>
      <SupportSessionBanner session={session} />
      {children}
    </>
  );
}

export function PortalPageLoading({ label }: { label: string }) {
  return (
    <>
      <NextSeo title={label} noindex nofollow />
      <Box minH="100vh" bg="bg.1000" color="bg.100">
        <Container maxW="xl" py={{ base: "20", md: "28" }}>
          <HStack spacing="4">
            <Loader size="lg" />
            <Text color="bg.300">Loading {label.toLocaleLowerCase()}…</Text>
          </HStack>
        </Container>
      </Box>
    </>
  );
}

export function PortalPageFailure({
  label,
  error,
  retry,
  notFoundLabel = "Product line not found",
  backHref = "/product-lines",
  backLabel = "Back to product lines",
}: {
  label: string;
  error: PortalPageError;
  retry: () => void;
  notFoundLabel?: string;
  backHref?: string;
  backLabel?: string;
}) {
  if (error.status === 401) return <PortalPageLoading label={label} />;
  const notFound = error.status === 404;

  return (
    <>
      <NextSeo title={notFound ? "Not found" : label} noindex nofollow />
      <Box minH="100vh" bg="bg.1000" color="bg.100">
        <Container maxW="xl" py={{ base: "20", md: "28" }}>
          <VStack align="stretch" spacing="5">
            <Heading as="h1" fontSize="3xl">
              {notFound ? notFoundLabel : `${label} unavailable`}
            </Heading>
            <Text color="bg.300">{error.message}</Text>
            <HStack>
              {!notFound ? (
                <Button variant="primary" onClick={retry}>
                  Try again
                </Button>
              ) : null}
              <Button as={Link} href={backHref} variant="outline">
                {backLabel}
              </Button>
            </HStack>
          </VStack>
        </Container>
      </Box>
    </>
  );
}
