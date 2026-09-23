import {
  Box,
  Button,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useToast,
  VStack,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { FiCheck, FiCopy, FiDownload, FiShare2 } from "react-icons/fi";
import QRCode from "react-qr-code";
import { formatMoney } from "../../../lib/portal/currency";
import { buildPromoQrUrl } from "../../../lib/portal/promoQr";
import type { PromoCode } from "../../../types/portal";
import type { Currency } from "../../../types/strapi";

type PromoQrModalProps = {
  fallbackCurrency?: Currency | null;
  isOpen: boolean;
  onClose: () => void;
  promo: PromoCode | null;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const createQrPngBlob = async (container: HTMLDivElement) => {
  const sourceSvg = container.querySelector("svg");
  if (!sourceSvg) throw new Error("QR image is unavailable.");

  const canvasSize = 1024;
  const padding = 64;
  const qrSize = canvasSize - padding * 2;
  const svg = sourceSvg.cloneNode(true) as SVGSVGElement;
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", String(qrSize));
  svg.setAttribute("height", String(qrSize));

  const svgBlob = new Blob([new XMLSerializer().serializeToString(svg)], {
    type: "image/svg+xml;charset=utf-8",
  });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("QR image could not be rendered."));
      image.src = svgUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PNG export is unavailable.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvasSize, canvasSize);
    context.drawImage(image, padding, padding, qrSize, qrSize);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("PNG export failed."));
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
};

const downloadBlob = (blob: Blob, filename: string) => {
  const pngUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = pngUrl;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(pngUrl), 0);
};

export function PromoQrModal({
  fallbackCurrency,
  isOpen,
  onClose,
  promo,
}: PromoQrModalProps) {
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const [canShare, setCanShare] = useState(false);
  const [shareFile, setShareFile] = useState<File | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && Boolean(navigator.share));
  }, []);

  useEffect(() => {
    if (isOpen) setCopied(null);
  }, [isOpen, promo?.id]);

  useEffect(() => {
    setShareFile(null);
    if (!isOpen || !promo || !qrContainerRef.current) return;

    let cancelled = false;
    const normalizedCode = promo.code.trim().toUpperCase();
    void createQrPngBlob(qrContainerRef.current)
      .then((blob) => {
        if (!cancelled) {
          setShareFile(
            new File([blob], `promo-${normalizedCode}.png`, {
              type: "image/png",
            }),
          );
        }
      })
      .catch(() => {
        // Link sharing remains available if this browser cannot prepare a PNG.
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, promo]);

  if (!promo) return null;

  const url = buildPromoQrUrl(promo.code);
  const normalizedCode = promo.code.trim().toUpperCase();
  const discount =
    promo.discount_type === "PERCENT"
      ? `${promo.amount}% off`
      : `${formatMoney(
          promo.amount,
          promo.machine?.currency || fallbackCurrency,
        )} off`;

  const copyText = async (value: string, target: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(target);
    } catch {
      toast({
        title: `${target === "code" ? "Code" : "Link"} could not be copied`,
        description:
          target === "code"
            ? "Select and copy the promo code shown in the window."
            : "Select and copy the link shown in the window.",
        status: "error",
      });
    }
  };

  const share = async () => {
    try {
      const canShareImage = Boolean(
        shareFile &&
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [shareFile] }),
      );

      if (shareFile && canShareImage) {
        await navigator.share({
          files: [shareFile],
          title: `${normalizedCode} iShaker promo code`,
          text: `Scan this QR code or open ${url}`,
          url,
        });
      } else {
        await navigator.share({
          title: `${normalizedCode} iShaker promo code`,
          text: `Use promo code ${normalizedCode}`,
          url,
        });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast({ title: "Promo code could not be shared", status: "error" });
    }
  };

  const download = async () => {
    if (!qrContainerRef.current) return;
    setIsDownloading(true);
    try {
      const blob =
        shareFile || (await createQrPngBlob(qrContainerRef.current));
      downloadBlob(blob, `promo-${normalizedCode}.png`);
    } catch (error) {
      toast({
        title: "QR code could not be downloaded",
        description:
          error instanceof Error ? error.message : "Please try again.",
        status: "error",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="lg">
      <ModalOverlay />
      <ModalContent bg="bg.900" color="bg.50">
        <ModalHeader>Promo QR code</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing="4" align="stretch">
            <Box
              ref={qrContainerRef}
              bg="white"
              borderRadius="xl"
              p="4"
              width="288px"
              maxW="100%"
              mx="auto"
              lineHeight="0"
            >
              <QRCode
                value={url}
                level="M"
                size={256}
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              />
            </Box>

            <VStack spacing="1" textAlign="center">
              <Text
                fontSize={{ base: "2xl", md: "3xl" }}
                fontWeight="900"
                letterSpacing="wide"
                overflowWrap="anywhere"
              >
                {normalizedCode}
              </Text>
              <Link
                href={url}
                color="acid.300"
                fontSize="sm"
                overflowWrap="anywhere"
                textDecoration="underline"
              >
                {url}
              </Link>
            </VStack>

            <Box
              border="1px solid"
              borderColor="whiteAlpha.200"
              borderRadius="lg"
              p="4"
            >
              <Text fontSize="lg" fontWeight="800">
                {promo.title || "Untitled promo"}
              </Text>
              <Text color="acid.300" fontWeight="800">
                {discount}
              </Text>
              <Text color="bg.300" fontSize="sm">
                Valid {formatDate(promo.start_at)} to {formatDate(promo.end_at)}
              </Text>
            </Box>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Wrap width="100%" justify="flex-end" spacing="2">
            <WrapItem>
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
            </WrapItem>
            <WrapItem>
              <Button
                leftIcon={copied === "code" ? <FiCheck /> : <FiCopy />}
                onClick={() => void copyText(normalizedCode, "code")}
                variant="outline"
              >
                {copied === "code" ? "Code copied" : "Copy code"}
              </Button>
            </WrapItem>
            <WrapItem>
              <Button
                leftIcon={copied === "link" ? <FiCheck /> : <FiCopy />}
                onClick={() => void copyText(url, "link")}
                variant="outline"
              >
                {copied === "link" ? "Link copied" : "Copy link"}
              </Button>
            </WrapItem>
            {canShare ? (
              <WrapItem>
                <Button
                  leftIcon={<FiShare2 />}
                  onClick={() => void share()}
                  variant="outline"
                >
                  {shareFile &&
                  typeof navigator !== "undefined" &&
                  typeof navigator.canShare === "function" &&
                  navigator.canShare({ files: [shareFile] })
                    ? "Share image"
                    : "Share link"}
                </Button>
              </WrapItem>
            ) : null}
            <WrapItem>
              <Button
                leftIcon={<FiDownload />}
                onClick={() => void download()}
                isLoading={isDownloading}
                loadingText="Creating PNG"
                variant="primary"
              >
                Download PNG
              </Button>
            </WrapItem>
          </Wrap>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
