import {
  Box,
  Button,
  Container,
  Heading,
  Text,
  useToast,
  VStack,
} from "@chakra-ui/react";
import type { GetServerSideProps } from "next";
import { NextSeo } from "next-seo";
import { useState } from "react";
import { FiCheck, FiCopy, FiSun } from "react-icons/fi";
import QRCode from "react-qr-code";
import { Header } from "../../components/home/Header";
import {
  buildPromoQrUrl,
  isQrSafePromoCode,
} from "../../lib/portal/promoQr";

type PromoCodePageProps = {
  code: string;
};

export default function PromoCodePage({ code }: PromoCodePageProps) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const url = buildPromoQrUrl(code);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      toast({
        title: "Code could not be copied",
        description: "Press and hold the code to select it.",
        status: "error",
      });
    }
  };

  return (
    <>
      <NextSeo
        title={`${code} promo code`}
        description="Show this promo QR code to an iShaker machine scanner."
        noindex
        nofollow
      />
      <Box minH="100vh" bg="bg.900" color="bg.50" overflow="hidden">
        <Header borderColor="whiteAlpha.100" />
        <Container
          as="main"
          maxW="3xl"
          minH="calc(100vh - 85px)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          bg="radial-gradient(circle at center, rgba(118, 248, 95, 0.18) 0%, rgba(27, 24, 24, 0) 62%)"
          py={{ base: "10", md: "16" }}
        >
          <VStack spacing={{ base: "5", md: "7" }} textAlign="center" w="full">
            <Heading
              as="h1"
              fontSize={{ base: "2xl", md: "4xl" }}
              lineHeight="short"
            >
              Scan at the iShaker machine
            </Heading>

            <Box
              bg="white"
              borderRadius="2xl"
              p="4"
              width="288px"
              maxW="100%"
              lineHeight="0"
              boxShadow="0 24px 70px rgba(0,0,0,0.36)"
            >
              <QRCode
                value={url}
                level="M"
                size={256}
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              />
            </Box>

            <Button
              onClick={() => void copyCode()}
              variant="ghost"
              leftIcon={copied ? <FiCheck /> : <FiCopy />}
              height="auto"
              py="2"
              maxW="100%"
            >
              <Text
                as="span"
                fontSize={{ base: "2xl", md: "3xl" }}
                fontWeight="900"
                letterSpacing="wider"
                overflowWrap="anywhere"
              >
                {code}
              </Text>
            </Button>

            <VStack spacing="2" maxW="560px">
              <Text fontSize={{ base: "md", md: "lg" }} color="bg.100">
                Show this QR code to the scanner on the iShaker machine. Your
                discount is applied at checkout.
              </Text>
              <Text color="bg.400" fontSize="sm">
                Or enter the code on the payment screen.
              </Text>
            </VStack>

            <Box
              border="1px solid"
              borderColor="acid.300"
              borderRadius="full"
              color="acid.300"
              px="5"
              py="2.5"
            >
              <Text display="flex" alignItems="center" gap="2" fontWeight="800">
                <FiSun aria-hidden /> Turn up your screen brightness
              </Text>
            </Box>
          </VStack>
        </Container>
      </Box>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<
  PromoCodePageProps
> = async ({ params }) => {
  const rawCode = params?.code;
  if (typeof rawCode !== "string" || !isQrSafePromoCode(rawCode)) {
    return { notFound: true };
  }

  return {
    props: {
      code: rawCode.trim().toUpperCase(),
    },
  };
};
