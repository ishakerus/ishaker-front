import {
  AspectRatio,
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Icon,
  Image,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Text,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { FiCheck, FiChevronDown } from "react-icons/fi";
import type {
  PortalCatalogProduct,
  PortalMachineCell,
  PortalProduct,
  PortalProductLine,
  PortalSession,
} from "../../../types/portal";
import type { Machine } from "../../../types/strapi";
import { getMachineContainerCount } from "../../../lib/portal/containerSlots";
import { capitalizeName } from "../../../lib/formatName";
import { getSmallestMediaUrl } from "../../../lib/portal/media";
import { PortalShell } from "../PortalShell";
import { MachineCellsSection } from "../machines/MachineCellsSection";
import { MachineConsumptionSection } from "../machines/MachineConsumptionSection";
import { OrphanProductCard } from "./OrphanProductCard";
import { ProductLineCard } from "./ProductLineCard";
import { getProductLineIcon } from "./NewProductLinePage";
import { SupportContactBox } from "../../shared/SupportContactBox";

export type MachineContainerAssignment = {
  machine: Machine;
  cells: PortalMachineCell[];
  loadError?: string | null;
};

export type ProductLinesPageProps = {
  session: PortalSession;
  productLines: PortalProductLine[];
  rootProductLines: PortalProductLine[];
  orphanProducts: PortalProduct[];
  catalogProducts: PortalCatalogProduct[];
  machineAssignments: MachineContainerAssignment[];
  initialMachineId?: string;
  initialNewProduct?: boolean;
  loadError?: string;
};

type MachineSelectorContentProps = {
  machine: Machine;
  isSelected?: boolean;
};

function MachineSelectorContent({
  machine,
  isSelected = false,
}: MachineSelectorContentProps) {
  const previewUrl = getSmallestMediaUrl(machine.machine_type?.preview);
  const title = machine.title || `Machine #${machine.id}`;

  return (
    <HStack spacing="4" align="center" w="full" minW="0">
      <AspectRatio
        ratio={1}
        boxSize={{ base: "56px", sm: "64px" }}
        flex="0 0 auto"
        bg="bg.800"
        border="1px solid"
        borderColor="whiteAlpha.100"
        borderRadius="lg"
        overflow="hidden"
      >
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt={machine.machine_type?.name || machine.title || "Machine"}
            w="full"
            h="full"
            objectFit="contain"
            p="2"
          />
        ) : (
          <Box />
        )}
      </AspectRatio>

      <VStack spacing="1.5" align="stretch" flex="1" minW="0">
        <Text
          color="bg.50"
          fontWeight="800"
          fontSize={{ base: "md", sm: "lg" }}
          lineHeight="short"
          noOfLines={2}
        >
          {title}
        </Text>
        <HStack
          spacing="2"
          color="bg.300"
          fontSize="sm"
          flexWrap="wrap"
          rowGap="0"
        >
          <Text noOfLines={1}>
            Serial: {machine.serial_number || "Not set"}
          </Text>
          {machine.machine_type?.name ? (
            <Text
              noOfLines={1}
              _before={{
                content: '"\u2022"',
                mr: "2",
                color: "whiteAlpha.300",
              }}
            >
              Type: {machine.machine_type.name}
            </Text>
          ) : null}
        </HStack>
      </VStack>

      {isSelected ? (
        <Icon as={FiCheck} color="acid.300" boxSize="5" flex="0 0 auto" />
      ) : null}
    </HStack>
  );
}

export function ProductLinesPage({
  session,
  productLines,
  rootProductLines,
  orphanProducts,
  catalogProducts,
  machineAssignments,
  initialMachineId,
  initialNewProduct = false,
  loadError,
}: ProductLinesPageProps) {
  const router = useRouter();
  const productLineChooser = useDisclosure();
  const handledInitialNewProduct = useRef(false);
  const [selectedMachineId, setSelectedMachineId] = useState(
    machineAssignments.some(
      ({ machine }) => String(machine.id) === initialMachineId,
    )
      ? initialMachineId || ""
      : machineAssignments[0]
        ? String(machineAssignments[0].machine.id)
        : "",
  );
  const [machineCells, setMachineCells] = useState<
    Record<string, PortalMachineCell[]>
  >(() =>
    Object.fromEntries(
      machineAssignments.map(({ machine, cells }) => [
        String(machine.id),
        cells,
      ]),
    ),
  );
  const selectedAssignment =
    machineAssignments.find(
      ({ machine }) => String(machine.id) === selectedMachineId,
    ) || machineAssignments[0];
  const selectedCells = selectedAssignment
    ? machineCells[String(selectedAssignment.machine.id)] ||
      selectedAssignment.cells
    : [];
  const selectedContainerCount = selectedAssignment
    ? getMachineContainerCount(selectedAssignment.machine.machine_type)
    : null;
  const productLineOptions = useMemo(
    () =>
      [...rootProductLines].sort(
        (left, right) =>
          Number(Boolean(right.isPopular)) - Number(Boolean(left.isPopular)) ||
          left.name.localeCompare(right.name, undefined, {
            sensitivity: "base",
          }),
      ),
    [rootProductLines],
  );

  const replaceMachineCells = (
    machineId: string | number,
    cells: PortalMachineCell[],
  ) => {
    setMachineCells((current) => ({
      ...current,
      [String(machineId)]: cells,
    }));
  };

  const selectMachine = (machineId: string | number) => {
    const nextMachineId = String(machineId);
    setSelectedMachineId(nextMachineId);
    void router.replace(
      `/product-lines/machines/${encodeURIComponent(nextMachineId)}`,
      undefined,
      { shallow: true },
    );
  };

  const startNewProduct = () => {
    if (!productLineOptions.length) {
      void router.push("/product-lines/new");
      return;
    }
    productLineChooser.onOpen();
  };

  useEffect(() => {
    if (!initialNewProduct || handledInitialNewProduct.current) return;
    handledInitialNewProduct.current = true;
    startNewProduct();
  }, [initialNewProduct]);

  const selectProductLineForNewProduct = (rootLine: PortalProductLine) => {
    productLineChooser.onClose();
    const normalizedName = rootLine.name.trim().toLocaleLowerCase();
    const existingProductLine =
      productLines.find(
        (line) => String(line.base_product_line?.id) === String(rootLine.id),
      ) ||
      productLines.find(
        (line) => line.name.trim().toLocaleLowerCase() === normalizedName,
      );

    void router.push(
      existingProductLine
        ? `/product-lines/${existingProductLine.id}/products/new`
        : `/product-lines/new?baseProductLineId=${encodeURIComponent(rootLine.id)}`,
    );
  };

  return (
    <PortalShell
      title="Product lines"
      description="Manage your drink and flavour library, then assign products to physical machine containers."
      clientName={session.client.company}
      access={session.access}
      showSupportBanner={false}
      headerAction={
        <Button
          onClick={startNewProduct}
          variant="primary"
          size="md"
          px="5"
          fontWeight="700"
        >
          +&nbsp; New product
        </Button>
      }
    >
      <FormControl maxW="620px" my="5">
        <Menu matchWidth placement="bottom-start">
          <MenuButton
            as={Button}
            w="full"
            h="auto"
            minH={{ base: "80px", sm: "92px" }}
            p={{ base: "3", sm: "3.5" }}
            bg="bg.900"
            border="1px solid"
            borderColor="whiteAlpha.100"
            borderRadius="lg"
            textAlign="left"
            whiteSpace="normal"
            rightIcon={<FiChevronDown />}
            _hover={{ bg: "bg.800", borderColor: "whiteAlpha.300" }}
            _active={{ bg: "bg.800", borderColor: "acid.300" }}
            _expanded={{ bg: "bg.800", borderColor: "acid.300" }}
          >
            <MachineSelectorContent machine={selectedAssignment.machine} />
          </MenuButton>
          <MenuList
            bg="bg.900"
            borderColor="whiteAlpha.200"
            p="1.5"
            maxH="360px"
            overflowY="auto"
            zIndex="dropdown"
          >
            {machineAssignments.map(({ machine }) => {
              const isSelected =
                String(machine.id) === String(selectedAssignment.machine.id);

              return (
                <MenuItem
                  key={machine.id}
                  bg={isSelected ? "whiteAlpha.100" : "transparent"}
                  borderRadius="md"
                  p="3"
                  onClick={() => selectMachine(machine.id)}
                  _hover={{ bg: "whiteAlpha.100" }}
                  _focus={{ bg: "whiteAlpha.100" }}
                >
                  <MachineSelectorContent
                    machine={machine}
                    isSelected={isSelected}
                  />
                </MenuItem>
              );
            })}
          </MenuList>
        </Menu>
      </FormControl>
      {loadError ? (
        <Text color="orange.200" mb="5">
          {loadError}
        </Text>
      ) : null}

      <SimpleGrid columns={1} spacing="4">
        {productLines.map((productLine) => (
          <ProductLineCard
            key={productLine.id}
            productLine={productLine}
            onAddProduct={startNewProduct}
          />
        ))}
      </SimpleGrid>

      {!productLines.length && !loadError ? (
        <Text color="bg.300">No product lines are available yet.</Text>
      ) : null}

      <Box mt="10">
        {machineAssignments.length ? (
          <>
            <MachineCellsSection
              key={selectedAssignment.machine.id}
              machineId={selectedAssignment.machine.id}
              machineSerial={selectedAssignment.machine.serial_number || null}
              initialCells={selectedCells}
              catalogProducts={catalogProducts}
              loadError={selectedAssignment.loadError}
              containerCount={selectedContainerCount}
              onCellsSaved={(cells) =>
                replaceMachineCells(selectedAssignment.machine.id, cells)
              }
            />
            <Box mt="4">
              <MachineConsumptionSection
                machine={selectedAssignment.machine}
                initialCells={selectedCells}
              />
            </Box>
          </>
        ) : (
          <Text color="orange.200">
            Register a machine before assigning products to containers.
          </Text>
        )}
      </Box>

      {orphanProducts.length ? (
        <Box mt="10">
          <Heading as="h2" fontSize="xl" mb="2">
            Orphan products
          </Heading>
          <Text color="orange.200" mb="4">
            Legacy flavours detached by the old edit flow. Attach one to recover
            it, or delete it and its machine or preset container assignments.
            This section disappears when no orphan products remain.
          </Text>
          <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing="4">
            {orphanProducts.map((product) => (
              <OrphanProductCard
                key={product.id}
                product={product}
                productLines={productLines}
              />
            ))}
          </SimpleGrid>
        </Box>
      ) : null}

      <SupportContactBox
        hasKnownClient={
          session.access === "client" && Boolean(session.client.id)
        }
      />

      <Modal
        isOpen={productLineChooser.isOpen}
        onClose={productLineChooser.onClose}
        isCentered
        size="lg"
      >
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(4px)" />
        <ModalContent
          bg="bg.900"
          border="1px solid"
          borderColor="whiteAlpha.200"
        >
          <ModalHeader>Choose a product line</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text color="bg.300" mb="4">
              Existing lines open product creation. New lines open setup with
              your selection already filled in.
            </Text>
            <VStack align="stretch" spacing="2">
              {productLineOptions.map((rootLine) => {
                const normalizedName = rootLine.name.trim().toLocaleLowerCase();
                const existingProductLine =
                  productLines.find(
                    (line) =>
                      String(line.base_product_line?.id) ===
                      String(rootLine.id),
                  ) ||
                  productLines.find(
                    (line) =>
                      line.name.trim().toLocaleLowerCase() === normalizedName,
                  );
                return (
                  <Button
                    key={rootLine.id}
                    variant="ghost"
                    h="auto"
                    minH="50px"
                    px="2"
                    py="2"
                    justifyContent="flex-start"
                    onClick={() => selectProductLineForNewProduct(rootLine)}
                    _hover={{ bg: "whiteAlpha.100" }}
                  >
                    <HStack w="full" spacing="3" textAlign="left">
                      <Box
                        display="grid"
                        placeItems="center"
                        boxSize="34px"
                        flexShrink="0"
                        borderRadius="md"
                        bg="whiteAlpha.100"
                        color="acid.300"
                        fontSize="lg"
                      >
                        {getProductLineIcon(rootLine.name)}
                      </Box>
                      <Box flex="1" minW="0">
                        <Text color="bg.50" fontWeight="700" noOfLines={1}>
                          {capitalizeName(rootLine.name)}
                        </Text>
                        {rootLine.isPopular ? (
                          <Text color="green.300" fontSize="xs">
                            Popular
                          </Text>
                        ) : null}
                      </Box>
                      <Text color="bg.400" fontSize="xs" flexShrink="0">
                        {existingProductLine ? "Add product" : "Create line"}
                      </Text>
                    </HStack>
                  </Button>
                );
              })}
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </PortalShell>
  );
}

export { CupPreview } from "./CupPreview";
export { ContainersPreview } from "./ContainersPreview";
export type { ContainersPreviewProps } from "./ContainersPreview";
export { DeleteProductDialog } from "./DeleteProductDialog";
export { DeleteProductLineDialog } from "./DeleteProductLineDialog";
export { NewProductPage } from "./new-product";
export type { NewProductPageProps } from "./new-product";
export { NewProductLinePage } from "./NewProductLinePage";
export type { NewProductLinePageProps } from "./NewProductLinePage";
export { ProductLineCard } from "./ProductLineCard";
export { ProductCard } from "./ProductCard";
export { PowderContainer } from "./PowderContainer";
export type { PowderContainerProps } from "./PowderContainer";
export { OrphanProductCard } from "./OrphanProductCard";
export { ProductLineForm } from "./ProductLineForm";
export { SearchableImageSelect } from "./SearchableImageSelect";
export type {
  SearchableImageOption,
  SearchableImageSelectProps,
} from "./SearchableImageSelect";
