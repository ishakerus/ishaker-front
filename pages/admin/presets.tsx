import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  Input,
  NumberInput,
  NumberInputField,
  Select,
  SimpleGrid,
  Switch,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  VStack,
  useDisclosure,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
} from "@chakra-ui/react";
import type { GetServerSideProps } from "next";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "../../components/admin";
import Loader from "../../components/shared/Loader";
import { SearchableImageSelect } from "../../components/portal/product-lines";
import { requireAdminSession } from "../../lib/admin/auth";
import { formatMoney } from "../../lib/portal/currency";
import { getSmallestMediaUrl } from "../../lib/portal/media";
import {
  getDuplicateContainerSlots,
  getMachineContainerCount,
  isValidContainerSlot,
} from "../../lib/portal/containerSlots";
import {
  canAssignProduct,
  getProductAssignmentProblems,
} from "../../lib/portal/productAssignment";

type Row = {
  id?: number;
  position: number;
  cellCategory: "powder" | "concentrate";
  productId: string;
  price: string;
  isActive: boolean;
};

const DEFAULT_PRICE = "5.49";

const emptyForm = () => ({
  id: "",
  name: "",
  slug: "",
  description: "",
  isDefault: false,
  isActive: true,
  isTemplate: false,
  machineTypeId: "",
  currencyId: "",
  languageId: "",
  productLineId: "",
  cells: [] as Row[],
});

const fillPhysicalSlots = (cells: Row[], containerCount: number | null) => {
  if (!containerCount) return cells;
  const assignedCells = cells.filter((cell) => cell.productId);
  const occupied = new Set(
    assignedCells
      .map((cell) => cell.position)
      .filter((position) => isValidContainerSlot(position, containerCount)),
  );
  return [
    ...assignedCells,
    ...Array.from({ length: containerCount }, (_, index) => index + 1)
      .filter((position) => !occupied.has(position))
      .map((position) => ({
        position,
        cellCategory: "powder" as const,
        productId: "",
        price: DEFAULT_PRICE,
        isActive: true,
      })),
  ].sort((left, right) => left.position - right.position);
};

export default function AdminPresetsPage() {
  const toast = useToast();
  const confirm = useDisclosure();
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [targetMachineId, setTargetMachineId] = useState("");
  const [applyMode, setApplyMode] = useState<"merge" | "replaceAll">("merge");
  const [replacePrices, setReplacePrices] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [isApplying, setIsApplying] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setError("");
    const response = await fetch("/api/admin/presets", { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    setIsLoading(false);
    if (!response.ok) {
      setError("Presets could not be loaded.");
      return;
    }
    setData(payload);
  };

  useEffect(() => {
    void load();
  }, []);

  const choosePreset = (id: string) => {
    const preset = data?.presets?.find((item: any) => String(item.id) === id);
    if (!preset) {
      setForm(emptyForm());
      return;
    }
    const presetMachineType = preset.machine_type;
    setForm({
      id: String(preset.id),
      name: preset.name || "",
      slug: preset.slug || "",
      description: preset.description || "",
      isDefault: preset.isDefault === true,
      isActive: preset.isActive !== false,
      isTemplate: preset.is_template === true,
      machineTypeId: preset.machine_type?.id
        ? String(preset.machine_type.id)
        : "",
      currencyId: preset.currency?.id ? String(preset.currency.id) : "",
      languageId: preset.language?.id ? String(preset.language.id) : "",
      productLineId: preset.product_line?.id
        ? String(preset.product_line.id)
        : "",
      cells: fillPhysicalSlots((preset.cells || [])
        .sort((a: any, b: any) => Number(a.position) - Number(b.position))
        .map((cell: any) => ({
          id: Number(cell.id),
          position: Number(cell.position),
          cellCategory: cell.cell_category || "powder",
          productId: cell.product?.id ? String(cell.product.id) : "",
          price:
            cell.price === null || cell.price === undefined
              ? DEFAULT_PRICE
              : String(cell.price),
          isActive: cell.isActive !== false,
        })), getMachineContainerCount(presetMachineType)),
    });
  };

  const products = useMemo(
    () =>
      data?.options?.products || [],
    [data],
  );
  const productOptions = useMemo(
    () =>
      products.map((product: any) => {
        const problems = getProductAssignmentProblems(product);
        return {
          id: String(product.id),
          name: `${product.product_line?.name || "Orphan"} — ${product.taste?.name || product.name || `Product ${product.id}`}`,
          imageUrl: getSmallestMediaUrl(
            product.custom_main || product.taste?.main,
          ),
          subtitle: product.brand?.name,
          isDisabled: problems.length > 0,
          disabledReason: problems[0]?.detail,
        };
      }),
    [products],
  );
  const selectedCurrency = data?.options?.currencies?.find(
    (currency: any) => String(currency.id) === form.currencyId,
  );
  const selectedMachineType = data?.options?.machineTypes?.find(
    (machineType: any) => String(machineType.id) === form.machineTypeId,
  );
  const containerCount = getMachineContainerCount(selectedMachineType);
  const duplicatePositions = useMemo(
    () =>
      getDuplicateContainerSlots(
        form.cells
          .filter((cell) => cell.productId)
          .map((cell) => cell.position),
      ),
    [form.cells],
  );
  const hasInvalidPosition = form.cells.filter((cell) => cell.productId).some(
    (cell) => !isValidContainerSlot(cell.position, containerCount),
  );
  const hasInvalidProduct = form.cells.some((cell) => {
    if (!cell.productId) return false;
    const product = products.find(
      (item: any) => String(item.id) === cell.productId,
    );
    return (
      !product ||
      !canAssignProduct(product) ||
      product.product_type !== cell.cellCategory
    );
  });
  const hasInvalidPrice = form.cells.some(
    (cell) =>
      cell.price !== "" &&
      (!Number.isFinite(Number(cell.price)) || Number(cell.price) <= 0),
  );
  const hasContainerPositionError =
    containerCount === null ||
    hasInvalidPosition ||
    duplicatePositions.size > 0 ||
    hasInvalidProduct ||
    hasInvalidPrice;

  const save = async () => {
    if (hasContainerPositionError) {
      setError(
        containerCount === null
          ? "The selected machine model must define its powder container count."
          : "Choose a unique physical container slot from the available range for every preset cell.",
      );
      return;
    }
    setIsSaving(true);
    setError("");
    const response = await fetch(
      form.id ? `/api/admin/presets/${form.id}` : "/api/admin/presets",
      {
        method: form.id ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          cells: form.cells.filter((cell) => cell.productId),
        }),
      },
    );
    const payload = await response.json().catch(() => null);
    setIsSaving(false);
    if (!response.ok) {
      const message = payload?.message || "Preset could not be saved.";
      setError(message);
      toast({ title: "Save failed", description: message, status: "error" });
      return;
    }
    toast({ title: "Preset saved", status: "success" });
    setForm(emptyForm());
    await load();
  };

  const remove = async () => {
    if (!form.id || !window.confirm(`Delete preset "${form.name}"?`)) return;
    const response = await fetch(`/api/admin/presets/${form.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast({ title: "Delete failed", status: "error" });
      return;
    }
    toast({ title: "Preset deleted", status: "success" });
    setForm(emptyForm());
    await load();
  };

  const previewApply = async () => {
    if (!form.id || !targetMachineId) return;
    setIsApplying(true);
    const response = await fetch(`/api/admin/presets/${form.id}/apply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        machineId: targetMachineId,
        mode: applyMode,
        replacePrices,
        confirm: false,
      }),
    });
    const payload = await response.json().catch(() => null);
    setIsApplying(false);
    if (!response.ok) {
      toast({
        title: "Preview failed",
        description: payload?.message || "Apply diff could not be created.",
        status: "error",
      });
      return;
    }
    setPreview(payload);
    confirm.onOpen();
  };

  const apply = async () => {
    if (!preview) return;
    setIsApplying(true);
    const response = await fetch(`/api/admin/presets/${form.id}/apply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        machineId: targetMachineId,
        mode: applyMode,
        replacePrices,
        confirm: true,
        expectedHash: preview.hash,
      }),
    });
    const payload = await response.json().catch(() => null);
    setIsApplying(false);
    if (!response.ok) {
      setPreview(payload?.diff ? { hash: payload.hash, diff: payload.diff } : preview);
      toast({
        title: "Apply failed",
        description: payload?.message || "Preset could not be applied.",
        status: "error",
      });
      return;
    }
    confirm.onClose();
    const planogramPayload = payload?.planogram?.data || payload?.planogram;
    const problems = Array.isArray(planogramPayload?.problems)
      ? planogramPayload.problems
      : [];
    const skipped = Array.isArray(planogramPayload?.skipped)
      ? planogramPayload.skipped
      : [];
    toast({
      title: problems.length
        ? "Preset applied with planogram errors"
        : "Preset applied",
      description: problems.length
        ? problems
            .map(
              (problem: any) =>
                `Container ${problem.position ?? "?"}: ${problem.detail || problem.code}`,
            )
            .join(" · ")
        : skipped.length
          ? `${skipped.length} disabled item(s) skipped. Source: ${payload.planogramSource || "unknown"}.`
          : `Planogram source: ${payload.planogramSource || "unknown"}.`,
      status: problems.length ? "error" : skipped.length ? "info" : "success",
      duration: 9000,
      isClosable: true,
    });
    await load();
  };

  return (
    <AdminShell title="Presets">
      {isLoading ? <Loader size="lg" mb="5" /> : null}
      {error ? (
        <Alert status="error" mb="5"><AlertIcon />{error}</Alert>
      ) : null}
      <SimpleGrid columns={{ base: 1, xl: 3 }} spacing="6">
        <Box bg="bg.900" p="5" borderRadius="2xl">
          <Button mb="4" variant="primary" onClick={() => setForm(emptyForm())}>
            New preset
          </Button>
          <VStack align="stretch">
            {(data?.presets || []).map((preset: any) => (
              <Button
                key={preset.id}
                variant={form.id === String(preset.id) ? "primary" : "contrast"}
                justifyContent="space-between"
                onClick={() => choosePreset(String(preset.id))}
              >
                {preset.name}
                {preset.isDefault ? <Badge>Default</Badge> : null}
              </Button>
            ))}
          </VStack>
        </Box>

        <Box bg="bg.900" p="6" borderRadius="2xl" gridColumn={{ xl: "span 2" }}>
          <VStack align="stretch" spacing="4">
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing="4">
              <FormControl isRequired>
                <FormLabel>Name</FormLabel>
                <Input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                      ...(!current.id
                        ? {
                            slug: event.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9]+/g, "-")
                              .replace(/^-|-$/g, ""),
                          }
                        : {}),
                    }))
                  }
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Slug</FormLabel>
                <Input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} />
              </FormControl>
              {[
                ["Machine type", "machineTypeId", data?.options?.machineTypes, "name"],
                ["Currency", "currencyId", data?.options?.currencies, "code"],
                ["Language", "languageId", data?.options?.languages, "name"],
              ].map(([label, key, options, display]: any) => (
                <FormControl isRequired key={key}>
                  <FormLabel>{label}</FormLabel>
                  <Select
                    value={(form as any)[key]}
                    onChange={(event) => {
                      const value = event.target.value;
                      const nextCount =
                        key === "machineTypeId"
                          ? getMachineContainerCount(
                              (options || []).find(
                                (option: any) => String(option.id) === value,
                              ),
                            )
                          : containerCount;
                      setForm({
                        ...form,
                        [key]: value,
                        ...(key === "machineTypeId"
                          ? { cells: fillPhysicalSlots(form.cells, nextCount) }
                          : {}),
                      });
                    }}
                    placeholder={`Select ${String(label).toLowerCase()}`}
                  >
                    {(options || []).map((option: any) => (
                      <option key={option.id} value={option.id}>{option[display]}</option>
                    ))}
                  </Select>
                </FormControl>
              ))}
            </SimpleGrid>
            <FormControl>
              <FormLabel>Description</FormLabel>
              <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </FormControl>
            <HStack>
              <Checkbox isChecked={form.isDefault} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })}>Default</Checkbox>
              <Checkbox isChecked={form.isTemplate} onChange={(event) => setForm({ ...form, isTemplate: event.target.checked })}>Template</Checkbox>
              <Checkbox isChecked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })}>Active</Checkbox>
            </HStack>

            <Text color="acid.300" fontWeight="800">Container assignment</Text>
            {form.machineTypeId && containerCount === null ? (
              <Alert status="error" borderRadius="xl">
                <AlertIcon />
                This machine model has no container count configured.
                Configure it before editing or saving its preset.
              </Alert>
            ) : null}
            {duplicatePositions.size ? (
              <Alert status="error" borderRadius="xl">
                <AlertIcon />
                Each physical container slot can be used only once.
              </Alert>
            ) : null}
            {hasInvalidProduct ? (
              <Alert status="error" borderRadius="xl">
                <AlertIcon />
                Every assigned product must be complete and match its container category.
              </Alert>
            ) : null}
            {hasInvalidPrice ? (
              <Alert status="error" borderRadius="xl">
                <AlertIcon />
                Price overrides must be greater than zero.
              </Alert>
            ) : null}
            <TableContainer>
              <Table minW="840px">
                <Thead><Tr><Th>Container slot</Th><Th>Category</Th><Th>Product</Th><Th>Price</Th><Th>Active</Th><Th /></Tr></Thead>
                <Tbody>
                  {form.cells.map((cell, index) => {
                    const selectedProduct = products.find(
                      (product: any) => String(product.id) === cell.productId,
                    );
                    const dosagePrice =
                      selectedProduct?.dosage?.full_drink_price ?? null;
                    const effectivePrice =
                      cell.price === "" ? dosagePrice : cell.price;
                    const hasDuplicatePosition =
                      duplicatePositions.has(cell.position);
                    const hasInvalidSlot = !isValidContainerSlot(
                      cell.position,
                      containerCount,
                    );
                    const occupiedByAnotherCell = new Set(
                      form.cells
                        .filter(
                          (otherCell, cellIndex) =>
                            cellIndex !== index && Boolean(otherCell.productId),
                        )
                        .map((otherCell) => otherCell.position),
                    );
                    return (
                    <Tr key={`preset-cell-${index}`}>
                      <Td minW="180px">
                        <FormControl
                          isInvalid={hasDuplicatePosition || hasInvalidSlot}
                        >
                          {hasDuplicatePosition || hasInvalidSlot ? <Select
                            aria-label={`Physical container slot for preset row ${index + 1}`}
                            value={String(cell.position)}
                            onChange={(event) => {
                              const nextPosition = Number(event.target.value);
                              const cells = form.cells
                                .filter(
                                  (otherCell, cellIndex) =>
                                    cellIndex === index ||
                                    Boolean(otherCell.productId) ||
                                    otherCell.position !== nextPosition,
                                )
                                .map((otherCell) =>
                                  otherCell === cell
                                    ? { ...cell, position: nextPosition }
                                    : otherCell,
                                );
                              setForm({ ...form, cells });
                            }}
                          >
                            {hasInvalidSlot ? (
                              <option value={String(cell.position)} disabled>
                                Invalid slot ({String(cell.position)})
                              </option>
                            ) : null}
                            {Array.from(
                              { length: containerCount || 0 },
                              (_, slotIndex) => slotIndex + 1,
                            ).map((slot) => (
                              <option
                                key={slot}
                                value={slot}
                                disabled={occupiedByAnotherCell.has(slot)}
                              >
                                Slot {slot}
                              </option>
                            ))}
                          </Select> : (
                            <Text fontWeight="800">Container {cell.position}</Text>
                          )}
                          <FormErrorMessage>
                            {hasDuplicatePosition
                              ? `Slot ${cell.position} is already assigned.`
                              : `Choose a slot from 1 to ${containerCount || "N"}.`}
                          </FormErrorMessage>
                        </FormControl>
                      </Td>
                      <Td><Select value={cell.cellCategory} onChange={(event) => {
                        const cells = [...form.cells]; cells[index] = { ...cell, cellCategory: event.target.value as Row["cellCategory"] }; setForm({ ...form, cells });
                      }}><option value="powder">Powder</option><option value="concentrate">Concentrate</option></Select></Td>
                      <Td minW="320px">
                        <SearchableImageSelect
                          ariaLabel={`Product for preset position ${cell.position}`}
                          emptyLabel="No library products found"
                          options={productOptions}
                          placeholder="Empty container"
                          clearLabel="Empty container"
                          value={cell.productId}
                          onChange={(value) => {
                            const cells = [...form.cells];
                            cells[index] = { ...cell, productId: value };
                            setForm({ ...form, cells });
                          }}
                        />
                      </Td>
                      <Td>
                        <NumberInput min={0.01} precision={2} value={cell.price}>
                          <NumberInputField placeholder="Inherit dosage" onChange={(event) => {
                            const cells = [...form.cells]; cells[index] = { ...cell, price: event.target.value }; setForm({ ...form, cells });
                          }} />
                        </NumberInput>
                        <HStack mt="1">
                          <Text fontSize="xs" color="bg.400">
                            {effectivePrice === null
                              ? "No dosage price"
                              : formatMoney(effectivePrice, selectedCurrency)}
                          </Text>
                          <Badge>
                            {cell.price === "" ? "Inherited" : "Override"}
                          </Badge>
                        </HStack>
                      </Td>
                      <Td><Switch isChecked={cell.isActive} onChange={(event) => {
                        const cells = [...form.cells]; cells[index] = { ...cell, isActive: event.target.checked }; setForm({ ...form, cells });
                      }} /></Td>
                      <Td><Text color="bg.400">Physical slot {cell.position}</Text></Td>
                    </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </TableContainer>
            <HStack>
              <Button
                variant="primary"
                onClick={save}
                isLoading={isSaving}
                isDisabled={hasContainerPositionError}
              >
                Save preset
              </Button>
              {form.id ? <Button colorScheme="red" variant="outline" onClick={remove} isDisabled title="Support cannot delete records">Delete</Button> : null}
            </HStack>

            {form.id ? (
              <Box borderTop="1px solid" borderColor="whiteAlpha.200" pt="5">
                <Text color="acid.300" fontWeight="800" mb="3">Apply to machine</Text>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing="3">
                  <Select value={targetMachineId} onChange={(event) => setTargetMachineId(event.target.value)} placeholder="Target machine">
                    {(data?.options?.machines || []).map((machine: any) => <option key={machine.id} value={machine.id}>{machine.serial_number}</option>)}
                  </Select>
                  <Select value={applyMode} onChange={(event) => setApplyMode(event.target.value as any)}>
                    <option value="merge">Merge listed positions</option>
                    <option value="replaceAll">Replace all cells</option>
                  </Select>
                  <Checkbox isChecked={replacePrices} onChange={(event) => setReplacePrices(event.target.checked)}>
                    Replace prices too
                  </Checkbox>
                </SimpleGrid>
                <Button
                  mt="3"
                  onClick={previewApply}
                  isLoading={isApplying}
                  isDisabled={!targetMachineId || hasContainerPositionError}
                >
                  Preview apply diff
                </Button>
              </Box>
            ) : null}
          </VStack>
        </Box>
      </SimpleGrid>

      <Modal isOpen={confirm.isOpen} onClose={confirm.onClose} size="4xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Confirm preset changes</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text mb="3">
              Currency and language will be set from the preset. Review every cell operation before writing.
            </Text>
            <TableContainer maxH="55vh" overflowY="auto">
              <Table size="sm">
                <Thead><Tr><Th>Action</Th><Th>Position</Th><Th>Before</Th><Th>After</Th><Th>Price rule</Th></Tr></Thead>
                <Tbody>
                  {(preview?.diff?.cells || []).map((cell: any) => (
                    <Tr key={`${cell.action}-${cell.position}`}>
                      <Td><Badge>{cell.action}</Badge></Td>
                      <Td>{cell.position}</Td>
                      <Td>{cell.before?.productName || "Empty"} / {cell.before?.price ?? "inherit"}</Td>
                      <Td>{cell.after?.productName || "Empty"} / {cell.after?.price ?? "inherit"}</Td>
                      <Td>{cell.priceDecision || "removed"}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          </ModalBody>
          <ModalFooter>
            <Button mr="3" onClick={confirm.onClose}>Cancel</Button>
            <Button colorScheme="red" onClick={apply} isLoading={isApplying}>
              Apply confirmed diff
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </AdminShell>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const redirect = await requireAdminSession(context);
  return redirect || { props: {} };
};
