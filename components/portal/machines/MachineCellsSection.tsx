import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  FormControl,
  FormErrorMessage,
  Grid,
  HStack,
  IconButton,
  Image,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Select,
  SimpleGrid,
  Switch,
  Text,
  Tooltip,
  useToast,
  VStack,
} from "@chakra-ui/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FiCheck, FiChevronDown, FiPlus, FiSave } from "react-icons/fi";
import { GiPowder } from "react-icons/gi";
import { IoWaterSharp } from "react-icons/io5";
import {
  clampContainerAmountKg,
  getContainerMaxAmountKg,
  getDuplicateContainerSlots,
  isValidContainerSlot,
} from "../../../lib/portal/containerSlots";
import { getSmallestMediaUrl } from "../../../lib/portal/media";
import {
  canAssignProduct,
  getProductAssignmentProblems,
} from "../../../lib/portal/productAssignment";
import type {
  PortalCatalogProduct,
  PortalMachineCell,
} from "../../../types/portal";
import { ContainersPreview } from "../product-lines/ContainersPreview";
import { CONTAINER_WIDTH } from "../product-lines/PowderContainer";

type MachineCellsSectionProps = {
  machineId: string | number;
  machineSerial: string | null;
  initialCells: PortalMachineCell[];
  catalogProducts: PortalCatalogProduct[];
  loadError?: string | null;
  containerCount: number | null;
  onCellsSaved?: (cells: PortalMachineCell[]) => void;
};

type CellDraft = Omit<PortalMachineCell, "id"> & {
  id: number | null;
  productId: string;
  cellCategory: "powder" | "concentrate";
};

type PlanogramItem = {
  cell_id?: string | number | null;
  position?: number | null;
  product?: string | number | null;
  code?: string;
  detail?: string;
};

type PlanogramFeedback = {
  source: string | null;
  problems: PlanogramItem[];
  skipped: PlanogramItem[];
  warnings: string[];
  mediaKeys: {
    checked: number | null;
    missing: string[];
  } | null;
  validationError: string | null;
};

const hydrateCell = (cell: PortalMachineCell): CellDraft => ({
  ...cell,
  id: Number(cell.id),
  productId: cell.product ? String(cell.product.id) : "",
  cellCategory: cell.cell_category || "powder",
});

const emptySlot = (position: number): CellDraft => ({
  id: null,
  position,
  isActive: true,
  cell_category: "powder",
  cellCategory: "powder",
  product: null,
  productId: "",
});

const buildDrafts = (
  initialCells: PortalMachineCell[],
  containerCount: number | null,
) => {
  const existing = initialCells.map((cell) => {
    const hydrated = hydrateCell(cell);
    return containerCount
      ? {
          ...hydrated,
          amount_kg: clampContainerAmountKg(
            hydrated.amount_kg,
            containerCount,
          ),
        }
      : hydrated;
  });
  if (!containerCount) return existing;

  return Array.from({ length: containerCount }, (_, index) => {
    const position = index + 1;
    const savedAtPosition = existing
      .filter((cell) => cell.position === position)
      .sort((left, right) => Number(right.id) - Number(left.id));

    // If legacy data contains duplicates, keep the newest saved assignment as
    // the visible value for this one physical slot. Saving removes the extras.
    return savedAtPosition[0] || emptySlot(position);
  });
};

const productLabel = (product: PortalCatalogProduct) => {
  const line = product.product_line?.name?.trim();
  const taste = product.taste?.name?.trim() || product.name;
  return line ? `${line} — ${taste}` : `Orphan — ${taste}`;
};

const productImageUrl = (product?: PortalCatalogProduct) =>
  getSmallestMediaUrl(product?.custom_main || product?.taste?.main);

export function MachineCellsSection({
  machineId,
  machineSerial,
  initialCells,
  catalogProducts,
  loadError,
  containerCount,
  onCellsSaved,
}: MachineCellsSectionProps) {
  const toast = useToast();
  const [cells, setCells] = useState(() =>
    buildDrafts(initialCells, containerCount),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [deletingCellId, setDeletingCellId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState("");
  const [planogram, setPlanogram] = useState<PlanogramFeedback | null>(null);
  const productsById = useMemo(
    () =>
      new Map(catalogProducts.map((product) => [String(product.id), product])),
    [catalogProducts],
  );
  const duplicatePositions = useMemo(
    () =>
      getDuplicateContainerSlots(
        cells
          .filter((cell) => cell.id !== null || cell.productId)
          .map((cell) => cell.position),
      ),
    [cells],
  );
  const invalidLegacyCells = cells.filter(
    (cell) =>
      cell.id !== null &&
      (!isValidContainerSlot(cell.position, containerCount) ||
        duplicatePositions.has(cell.position)),
  );
  const selectedProductProblems = cells.flatMap((cell) => {
    if (!cell.productId) return [];
    const product = productsById.get(cell.productId);
    if (!product)
      return [`Container ${cell.position}: product is not in this library.`];
    const problems = getProductAssignmentProblems(product);
    if (product.product_type && product.product_type !== cell.cellCategory) {
      problems.push({
        code: "no_product_type",
        detail: `This is a ${product.product_type} product, not ${cell.cellCategory}.`,
      });
    }
    return problems.map(
      (problem) => `Container ${cell.position}: ${problem.detail}`,
    );
  });
  const emptyAssignedContainers = cells.filter(
    (cell) => cell.productId && (Number(cell.amount_kg) || 0) <= 0,
  );
  const defaultAssignedAmountKg = containerCount
    ? getContainerMaxAmountKg(containerCount) * 0.7
    : 0;
  const hasValidationError =
    containerCount === null ||
    invalidLegacyCells.length > 0 ||
    duplicatePositions.size > 0 ||
    selectedProductProblems.length > 0;

  const updateCell = (
    target: CellDraft,
    patch: Partial<
      Pick<
        CellDraft,
        "position" | "productId" | "isActive" | "cellCategory" | "amount_kg"
      >
    >,
  ) => {
    setCells((current) => {
      const nextPosition = patch.position;
      const withoutEmptyDestination =
        nextPosition === undefined
          ? current
          : current.filter(
              (cell) =>
                !(
                  cell !== target &&
                  cell.id === null &&
                  !cell.productId &&
                  cell.position === nextPosition
                ),
            );
      return withoutEmptyDestination.map((cell) =>
        cell === target
          ? {
              ...cell,
              ...patch,
              ...(patch.productId !== undefined &&
              patch.productId !== cell.productId
                ? { amount_kg: patch.productId ? defaultAssignedAmountKg : 0 }
                : {}),
            }
          : cell,
      );
    });
    setSaveError("");
    setPlanogram(null);
  };

  const validatePlanogram = async () => {
    if (!machineSerial) return;
    try {
      const response = await fetch(
        `/api/portal/machines/${machineId}/planogram`,
      );
      const payload = await response.json().catch(() => ({}));
      const body = payload?.data || payload;
      const mediaKeys =
        body?.media_keys ||
        body?.fleet_status?.media_keys ||
        body?.body?.media_keys;
      const validationError =
        response.ok || response.status === 422
          ? null
          : payload?.message ||
            payload?.error?.message ||
            "The planogram validator is unavailable.";
      const feedback: PlanogramFeedback = {
        source: response.headers.get("x-planogram-source"),
        problems: Array.isArray(body?.problems) ? body.problems : [],
        skipped: Array.isArray(body?.skipped) ? body.skipped : [],
        warnings: Array.isArray(body?.warnings)
          ? body.warnings.map((warning: any) =>
              String(warning?.detail || warning?.message || warning),
            )
          : [],
        mediaKeys: mediaKeys
          ? {
              checked: Number.isFinite(Number(mediaKeys.checked))
                ? Number(mediaKeys.checked)
                : null,
              missing: Array.isArray(mediaKeys.missing)
                ? mediaKeys.missing.map(String)
                : [],
            }
          : null,
        validationError,
      };
      setPlanogram(feedback);
      if (validationError) {
        toast({
          title: "Assignments saved; validation unavailable",
          description: validationError,
          status: "warning",
          duration: 7000,
          isClosable: true,
        });
      }
    } catch {
      const validationError = "The planogram validator could not be reached.";
      setPlanogram({
        source: null,
        problems: [],
        skipped: [],
        warnings: [],
        mediaKeys: null,
        validationError,
      });
      toast({
        title: "Assignments saved; validation unavailable",
        description: validationError,
        status: "warning",
        duration: 7000,
        isClosable: true,
      });
    }
  };

  const save = async () => {
    if (hasValidationError) return;
    setIsSaving(true);
    setSaveError("");
    setPlanogram(null);
    try {
      const response = await fetch(`/api/portal/machines/${machineId}/cells`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assignments: cells.map((cell) => ({
            cellId: cell.id,
            position: cell.position,
            productId: cell.productId ? Number(cell.productId) : null,
            isActive: cell.isActive,
            cellCategory: cell.cellCategory,
            amountKg: Number(cell.amount_kg) || 0,
          })),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload?.message || "Container assignments could not be saved.",
        );
      }
      const refreshed = (
        Array.isArray(payload) ? payload : payload?.cells || []
      ) as PortalMachineCell[];
      setCells(buildDrafts(refreshed, containerCount));
      onCellsSaved?.(refreshed);
      toast(
        emptyAssignedContainers.length
          ? {
              title:
                emptyAssignedContainers.length === 1
                  ? `Container ${emptyAssignedContainers[0].position} has a product but is empty.`
                  : `Containers ${emptyAssignedContainers
                      .map((cell) => cell.position)
                      .join(", ")} have products but are empty.`,
              description: "Click on container to set powder volume",
              status: "warning",
              duration: 7000,
              isClosable: true,
            }
          : {
              title: "Container assignments saved",
              status: "success",
              duration: 5000,
              isClosable: true,
            },
      );
      await validatePlanogram();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Container assignments could not be saved.";
      setSaveError(message);
      toast({ title: "Save failed", description: message, status: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteInvalidCell = async (cell: CellDraft) => {
    if (cell.id === null) return;
    if (
      !window.confirm(
        `Delete the duplicate assignment for container ${cell.position}? This cannot be undone.`,
      )
    ) {
      return;
    }

    setDeletingCellId(cell.id);
    setSaveError("");
    try {
      const response = await fetch(`/api/portal/machines/${machineId}/cells`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cellId: cell.id }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload?.message || "The duplicate assignment could not be deleted.",
        );
      }
      const refreshed = (payload?.cells || []) as PortalMachineCell[];
      setCells(buildDrafts(refreshed, containerCount));
      onCellsSaved?.(refreshed);
      toast({
        title: "Duplicate assignment deleted",
        status: "success",
        duration: 4000,
        isClosable: true,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The duplicate assignment could not be deleted.";
      setSaveError(message);
      toast({ title: "Delete failed", description: message, status: "error" });
    } finally {
      setDeletingCellId(null);
    }
  };

  const renderSlot = (cell: CellDraft, isLegacy = false) => {
    const selectedProduct = productsById.get(cell.productId);
    const productProblems = selectedProduct
      ? getProductAssignmentProblems(selectedProduct)
      : [];
    const categoryMismatch = Boolean(
      selectedProduct?.product_type &&
      selectedProduct.product_type !== cell.cellCategory,
    );
    return (
      <Box
        key={`${cell.id ?? "empty"}-${cell.position}`}
        bg="bg.800"
        border="1px solid"
        borderColor={isLegacy ? "red.500" : "whiteAlpha.200"}
        borderRadius="xl"
        p="4"
      >
        <HStack justify="space-between" mb="4">
          <HStack
            spacing="1"
            flexShrink={0}
            bg="bg.900"
            border="1px solid"
            borderColor="whiteAlpha.200"
            borderRadius="md"
            p="0.5"
          >
            <Tooltip label="Powder">
              <IconButton
                aria-label={`Powder container ${cell.position}`}
                aria-pressed={cell.cellCategory === "powder"}
                icon={<GiPowder size="1.5rem" />}
                size="sm"
                maxH="6"
                p="0"
                minW="8"
                variant={cell.cellCategory === "powder" ? "solid" : "ghost"}
                bg={cell.cellCategory === "powder" ? "#D8C3A5" : "transparent"}
                color={cell.cellCategory === "powder" ? "#3B2F24" : "bg.300"}
                _hover={{
                  bg:
                    cell.cellCategory === "powder"
                      ? "#CBB28F"
                      : "whiteAlpha.100",
                }}
                onClick={() => updateCell(cell, { cellCategory: "powder" })}
              />
            </Tooltip>
            <Tooltip label="Concentrate">
              <IconButton
                aria-label={`Concentrate container ${cell.position}`}
                aria-pressed={cell.cellCategory === "concentrate"}
                icon={<IoWaterSharp size="1.5rem" />}
                size="sm"
                maxH="6"
                p="0"
                minW="8"
                variant={
                  cell.cellCategory === "concentrate" ? "solid" : "ghost"
                }
                colorScheme={
                  cell.cellCategory === "concentrate" ? "blue" : "gray"
                }
                onClick={() =>
                  updateCell(cell, { cellCategory: "concentrate" })
                }
              />
            </Tooltip>
          </HStack>
          <Text fontWeight="800" fontSize="lg">
            {isLegacy ? "Invalid container" : `Container ${cell.position}`}
          </Text>
          <HStack spacing="3">
            <Switch
              isChecked={cell.isActive}
              onChange={(event) =>
                updateCell(cell, { isActive: event.target.checked })
              }
              isDisabled={!cell.productId}
              colorScheme="green"
            />
            <Text color="bg.300" fontSize="sm">
              {cell.isActive ? "On" : "Off"}
            </Text>
          </HStack>
        </HStack>
        <VStack align="stretch" spacing="3">
          {isLegacy ? (
            <FormControl isInvalid>
              <Select
                value={
                  isValidContainerSlot(cell.position, containerCount)
                    ? cell.position
                    : ""
                }
                placeholder={`Invalid saved position (${cell.position})`}
                bg="bg.900"
                onChange={(event) =>
                  updateCell(cell, { position: Number(event.target.value) })
                }
              >
                {Array.from(
                  { length: containerCount || 0 },
                  (_, index) => index + 1,
                )
                  .filter(
                    (position) =>
                      !cells.some(
                        (other) =>
                          other !== cell &&
                          (other.id !== null || other.productId) &&
                          other.position === position,
                      ),
                  )
                  .map((position) => (
                    <option key={position} value={position}>
                      Container {position}
                    </option>
                  ))}
              </Select>
              <FormErrorMessage>
                Choose one unoccupied physical container.
              </FormErrorMessage>
            </FormControl>
          ) : null}
          <FormControl
            isInvalid={productProblems.length > 0 || categoryMismatch}
          >
            <Menu matchWidth placement="bottom-start">
              <MenuButton
                as={Button}
                w="full"
                minH="45px"
                h="auto"
                px="3"
                py="1.5"
                bg="bg.900"
                border="1px solid"
                borderColor={
                  productProblems.length > 0 || categoryMismatch
                    ? "red.300"
                    : "whiteAlpha.200"
                }
                borderRadius="md"
                fontWeight="normal"
                textAlign="left"
                rightIcon={<FiChevronDown />}
                aria-label={`Product for container ${cell.position}`}
                _hover={{ bg: "bg.900", borderColor: "whiteAlpha.400" }}
                _expanded={{ bg: "bg.900", borderColor: "acid.300" }}
              >
                <HStack spacing="3" minW="0">
                  {productImageUrl(selectedProduct) ? (
                    <Image
                      src={productImageUrl(selectedProduct)}
                      alt=""
                      boxSize="32px"
                      objectFit="contain"
                      borderRadius="md"
                      bg="whiteAlpha.100"
                      flexShrink={0}
                    />
                  ) : (
                    <Box
                      boxSize="32px"
                      borderRadius="md"
                      bg="whiteAlpha.100"
                      flexShrink={0}
                    />
                  )}
                  <Text noOfLines={1}>
                    {selectedProduct
                      ? productLabel(selectedProduct)
                      : "— Empty —"}
                  </Text>
                </HStack>
              </MenuButton>
              <MenuList
                bg="bg.900"
                borderColor="whiteAlpha.200"
                p="1.5"
                maxH="420px"
                overflowY="auto"
                zIndex="popover"
              >
                <MenuItem
                  bg="transparent"
                  borderRadius="md"
                  minH="48px"
                  onClick={() => updateCell(cell, { productId: "" })}
                  _hover={{ bg: "whiteAlpha.100" }}
                  _focus={{ bg: "whiteAlpha.100" }}
                >
                  <Box boxSize="36px" mr="3" flexShrink={0} />
                  <Text flex="1">— Empty —</Text>
                  {!cell.productId ? <FiCheck /> : null}
                </MenuItem>
                {catalogProducts.map((product) => {
                  const unavailable = !canAssignProduct(product);
                  const isSelected = String(product.id) === cell.productId;
                  const imageUrl = productImageUrl(product);
                  return (
                    <MenuItem
                      key={product.id}
                      isDisabled={unavailable && !isSelected}
                      bg={isSelected ? "whiteAlpha.100" : "transparent"}
                      borderRadius="md"
                      minH="56px"
                      onClick={() =>
                        updateCell(cell, { productId: String(product.id) })
                      }
                      _hover={{ bg: "whiteAlpha.100" }}
                      _focus={{ bg: "whiteAlpha.100" }}
                    >
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt=""
                          boxSize="40px"
                          objectFit="contain"
                          borderRadius="md"
                          bg="whiteAlpha.100"
                          mr="3"
                          flexShrink={0}
                        />
                      ) : (
                        <Box
                          boxSize="40px"
                          borderRadius="md"
                          bg="whiteAlpha.100"
                          mr="3"
                          flexShrink={0}
                        />
                      )}
                      <Box flex="1" minW="0">
                        <Text noOfLines={1}>{productLabel(product)}</Text>
                        {unavailable ? (
                          <Text color="orange.200" fontSize="xs">
                            Unavailable
                          </Text>
                        ) : null}
                      </Box>
                      {isSelected ? <FiCheck /> : null}
                    </MenuItem>
                  );
                })}
                <MenuDivider borderColor="whiteAlpha.200" />
                <MenuItem
                  as={Link}
                  href="/product-lines/new"
                  bg="transparent"
                  color="acid.300"
                  borderRadius="md"
                  minH="48px"
                  icon={<FiPlus />}
                  _hover={{ bg: "whiteAlpha.100" }}
                  _focus={{ bg: "whiteAlpha.100" }}
                >
                  Add new product line
                </MenuItem>
              </MenuList>
            </Menu>
            <FormErrorMessage>
              {categoryMismatch
                ? `Choose a ${cell.cellCategory} product.`
                : productProblems[0]?.detail}
            </FormErrorMessage>
          </FormControl>
          {isLegacy ? (
            <Button
              colorScheme="red"
              variant="outline"
              size="sm"
              alignSelf="start"
              isLoading={deletingCellId === cell.id}
              onClick={() => void deleteInvalidCell(cell)}
            >
              Delete duplicate assignment
            </Button>
          ) : null}
        </VStack>
      </Box>
    );
  };

  const slots = Array.from(
    { length: containerCount || 0 },
    (_, index) => index + 1,
  );
  const primaryCells = slots.map((position) => {
    const matches = cells.filter(
      (cell) =>
        cell.position === position && !invalidLegacyCells.includes(cell),
    );
    return matches[0] || emptySlot(position);
  });
  const previewCells: PortalMachineCell[] = primaryCells.map((cell) => ({
    id: cell.id || -cell.position,
    position: cell.position,
    isActive: cell.isActive,
    cell_category: cell.cellCategory,
    product: productsById.get(cell.productId) || null,
    price: cell.price,
    amount_kg: cell.amount_kg,
  }));
  const containersPreview = containerCount !== null ? (
    <ContainersPreview
      containerCount={containerCount}
      cells={previewCells}
      onAmountChange={(position, amountKg) => {
        const cell = primaryCells.find(
          (candidate) => candidate.position === position,
        );
        if (cell) updateCell(cell, { amount_kg: amountKg });
      }}
    />
  ) : null;
  const assignmentCards = (
    <SimpleGrid
      columns={{ base: 1, xl: containerCount === 4 ? 1 : 3 }}
      spacing="4"
    >
      {primaryCells.map((cell) => renderSlot(cell))}
    </SimpleGrid>
  );

  return (
    <Box
      bg="bg.1000"
      border="1px solid"
      borderColor="whiteAlpha.100"
      borderRadius="2xl"
      p={{ base: "5", md: "6" }}
      gridColumn={{ xl: "1 / -1" }}
    >
      <VStack spacing="4" align="stretch">
        <HStack justify="space-between" align="flex-start" spacing="4">
          <Box>
            <Text color="acid.300" fontWeight="800" fontSize="lg">
              Container assignment
            </Text>
            <Text color="bg.300" mt="1" fontSize="sm">
              Click and hold a container powder level to edit it.
            </Text>
          </Box>
          <IconButton
            aria-label="Save container assignment"
            icon={<FiSave />}
            variant="primary"
            isLoading={isSaving}
            isDisabled={hasValidationError}
            onClick={() => void save()}
            flexShrink={0}
          />
        </HStack>
        {loadError ? (
          <Alert status="error">
            <AlertIcon />
            {loadError}
          </Alert>
        ) : null}
        {containerCount === null ? (
          <Alert status="error">
            <AlertIcon />
            This machine type has no container count.
          </Alert>
        ) : null}
        {invalidLegacyCells.length ? (
          <Alert status="error">
            <AlertIcon />
            Repair the saved invalid or duplicate positions below. Positions are
            never shifted automatically.
          </Alert>
        ) : null}
        {selectedProductProblems.length ? (
          <Alert status="error">
            <AlertIcon />
            <VStack align="start" spacing="0">
              {selectedProductProblems.map((problem, index) => (
                <Text key={`${problem}-${index}`}>{problem}</Text>
              ))}
            </VStack>
          </Alert>
        ) : null}
        {saveError ? (
          <Alert status="error">
            <AlertIcon />
            {saveError}
          </Alert>
        ) : null}
        {planogram?.source ? (
          <Text color="bg.300">
            Planogram source: <Badge>{planogram.source}</Badge>
          </Text>
        ) : null}
        {planogram?.validationError ? (
          <Alert status="warning">
            <AlertIcon />
            Assignments are saved, but validation could not run:{" "}
            {planogram.validationError}
          </Alert>
        ) : null}
        {planogram?.problems.length ? (
          <Alert status="error">
            <AlertIcon />
            <VStack align="start" spacing="1">
              {planogram.problems.map((problem, index) => (
                <Text key={`${problem.cell_id}-${problem.code}-${index}`}>
                  Container {problem.position ?? "?"}:{" "}
                  {problem.detail || problem.code}
                </Text>
              ))}
            </VStack>
          </Alert>
        ) : null}
        {planogram?.mediaKeys ? (
          <Alert
            status={planogram.mediaKeys.missing.length ? "error" : "success"}
          >
            <AlertIcon />
            <VStack align="start" spacing="1">
              <Text>
                Machine artwork checked: {planogram.mediaKeys.checked ?? "?"}{" "}
                key(s).
              </Text>
              {planogram.mediaKeys.missing.length ? (
                <Text>
                  Missing artwork: {planogram.mediaKeys.missing.join(", ")}
                </Text>
              ) : null}
            </VStack>
          </Alert>
        ) : null}
        {planogram?.warnings.length ? (
          <Alert status="warning">
            <AlertIcon />
            <VStack align="start" spacing="1">
              {planogram.warnings.map((warning, index) => (
                <Text key={`${warning}-${index}`}>{warning}</Text>
              ))}
            </VStack>
          </Alert>
        ) : null}
        {planogram?.skipped.length ? (
          <Alert status="info">
            <AlertIcon />
            <VStack align="start" spacing="1">
              {planogram.skipped.map((item, index) => (
                <Text key={`${item.cell_id}-${item.code}-${index}`}>
                  Container {item.position ?? "?"}: {item.detail || item.code}
                </Text>
              ))}
            </VStack>
          </Alert>
        ) : null}
        {containerCount === 4 ? (
          <Grid
            templateColumns={{
              base: "minmax(0, 1fr)",
              xl: "minmax(0, 1fr) minmax(360px, 440px)",
            }}
            gap="6"
            alignItems="start"
          >
            <Box
              w="full"
              minW="0"
              maxW={{ xl: `${CONTAINER_WIDTH * 4 + 48}px` }}
              mx="auto"
            >
              {containersPreview}
            </Box>
            {assignmentCards}
          </Grid>
        ) : (
          <>
            {containersPreview}
            {assignmentCards}
          </>
        )}
        {invalidLegacyCells.length ? (
          <Box>
            <Text fontWeight="800" color="red.200" mb="3">
              Saved rows requiring repair
            </Text>
            <SimpleGrid columns={{ base: 1, xl: 2 }} spacing="4">
              {invalidLegacyCells.map((cell) => renderSlot(cell, true))}
            </SimpleGrid>
          </Box>
        ) : null}
      </VStack>
    </Box>
  );
}
