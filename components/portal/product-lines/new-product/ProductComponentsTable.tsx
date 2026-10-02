import {
  Box,
  Button,
  Collapse,
  Divider,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Grid,
  HStack,
  Icon,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  NumberInput,
  NumberInputField,
  Portal,
  Select,
  SimpleGrid,
  Switch,
  Text,
  VStack,
} from "@chakra-ui/react";
import { type DragEvent, useEffect, useState } from "react";
import {
  FaCoins,
  FaChevronDown,
  FaGlassWhiskey,
  FaGripVertical,
  FaPlus,
} from "react-icons/fa";
import { FaWhiskeyGlass } from "react-icons/fa6";
import type {
  PortalComponent,
  PortalProductPurpose,
  PortalProductType,
} from "../../../../types/portal";
import type { Currency } from "../../../../types/strapi";
import { Help } from "../../../Help";
import { RxCross2 } from "react-icons/rx";
import { ComponentNameSelect } from "./ComponentNameSelect";

export type ProductComponentRow = {
  componentId: string;
  id: string;
  isCustom: boolean;
  name: string;
  quantity: string;
  unit: string;
};

export type ProductDosageValue = {
  conversionFactor: string;
  drinkVolume: string;
  fullDrinkPrice: string;
  product: string;
  smallDrinkPrice: string;
  smallDrinkVolume: string;
  water: string;
};

type ProductComponentsTableProps = {
  canEditMachineCurrency: boolean;
  components: PortalComponent[];
  currencies: Currency[];
  dosage: ProductDosageValue;
  onChange: (rows: ProductComponentRow[]) => void;
  onDosageChange: (value: ProductDosageValue) => void;
  onProductPurposeChange: (value: PortalProductPurpose) => void;
  onProductTypeChange: (value: PortalProductType) => void;
  onServingQuantityChange: (value: string) => void;
  onServingUnitChange: (value: "g" | "ml") => void;
  rows: ProductComponentRow[];
  productPurpose: PortalProductPurpose;
  productType: PortalProductType;
  priceCurrencyId: string;
  isCurrencySaving: boolean;
  onPriceCurrencyChange: (value: string) => void;
  servingQuantity: string;
  servingUnit: "g" | "ml";
  isDependent?: boolean;
};

const MAX_COMPONENTS = 50;
const componentUnits = ["mg", "g", "mcg", "kJ", "kcal"];

export function ProductComponentsTable({
  canEditMachineCurrency,
  components,
  currencies,
  dosage,
  onChange,
  onDosageChange,
  onProductPurposeChange,
  onProductTypeChange,
  onServingQuantityChange,
  onServingUnitChange,
  rows,
  productPurpose,
  productType,
  priceCurrencyId,
  isCurrencySaving,
  onPriceCurrencyChange,
  servingQuantity,
  servingUnit,
  isDependent = false,
}: ProductComponentsTableProps) {
  const [draggedRowId, setDraggedRowId] = useState("");
  const [focusedRowId, setFocusedRowId] = useState("");
  const [isSmallDrinkEnabled, setIsSmallDrinkEnabled] = useState(() =>
    Boolean(dosage.smallDrinkVolume.trim() || dosage.smallDrinkPrice.trim()),
  );
  useEffect(() => {
    if (dosage.smallDrinkVolume.trim() || dosage.smallDrinkPrice.trim()) {
      setIsSmallDrinkEnabled(true);
    }
  }, [dosage.smallDrinkPrice, dosage.smallDrinkVolume]);
  const fullDrinkVolume = Number(dosage.drinkVolume);
  const smallDrinkVolume = Number(dosage.smallDrinkVolume);
  const waterAmount = Number(dosage.water);
  const productAmount = Number(dosage.product);
  const exceedsFullDrinkVolume =
    fullDrinkVolume > 0 && waterAmount + productAmount > fullDrinkVolume;
  const smallDrinkVolumeError = dosage.smallDrinkVolume.trim()
    ? smallDrinkVolume < 100
      ? "Small drink volume must be at least 100ml."
      : fullDrinkVolume > 0 && smallDrinkVolume >= fullDrinkVolume
        ? "Small drink volume must be less than full drink volume."
        : ""
    : "";
  const waterError =
    dosage.water.trim() && (waterAmount < 50 || waterAmount > 500)
      ? "Water must be between 50ml and 500ml."
      : "";
  const selectedCurrency = currencies.find(
    (currency) => String(currency.id) === priceCurrencyId,
  );
  const currencyMenu = (ariaLabel: string) => (
    <Text
      aria-label={ariaLabel}
      position="absolute"
      right="4"
      top="50%"
      transform="translateY(-50%)"
      color="acid.300"
      fontWeight="800"
      pointerEvents="none"
    >
      {selectedCurrency?.code || "Currency"}
    </Text>
  );

  const addRow = () => {
    if (rows.length >= MAX_COMPONENTS) return;
    const rowId = `component-${Date.now()}-${rows.length}`;
    setFocusedRowId(rowId);
    onChange([
      ...rows,
      {
        id: rowId,
        componentId: "",
        isCustom: false,
        name: "",
        quantity: "",
        unit: "g",
      },
    ]);
  };
  const updateRow = (rowId: string, updates: Partial<ProductComponentRow>) =>
    onChange(
      rows.map((row) => (row.id === rowId ? { ...row, ...updates } : row)),
    );
  const moveRow = (rowId: string, targetIndex: number) => {
    const currentIndex = rows.findIndex((row) => row.id === rowId);
    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= rows.length ||
      currentIndex === targetIndex
    ) {
      return;
    }
    const reorderedRows = [...rows];
    const [movedRow] = reorderedRows.splice(currentIndex, 1);
    reorderedRows.splice(targetIndex, 0, movedRow);
    onChange(reorderedRows);
  };
  const handleDragOver = (
    event: DragEvent<HTMLDivElement>,
    targetIndex: number,
  ) => {
    event.preventDefault();
    if (draggedRowId) moveRow(draggedRowId, targetIndex);
  };

  return (
    <Box>
      <VStack spacing="4" mb="5">
        <HStack w="full" align="flex-start" spacing="2">
          <FormControl isRequired flex="1" minW="0">
            <HStack h="24px" mb="2" align="center">
              <FormLabel mb="0">Product type</FormLabel>
              <Help text="Base type of the product — Powder (protein/mix, dispensed by weight) or Concentrate/Syrup (liquid flavoring, dispensed by volume). This determines how the pump is calibrated (grams/sec vs ml/sec)." />
            </HStack>
            <Select
              value={productType}
              onChange={(event) =>
                onProductTypeChange(event.target.value as PortalProductType)
              }
              bg="bg.800"
            >
              <option value="powder">Powder</option>
              <option value="concentrate">Concentrate</option>
            </Select>
          </FormControl>

          <FormControl isRequired flex="1" minW="0">
            <HStack h="24px" mb="2" align="center">
              <FormLabel mb="0">Product purpose</FormLabel>
            </HStack>
            <Select
              value={productPurpose}
              onChange={(event) =>
                onProductPurposeChange(
                  event.target.value as PortalProductPurpose,
                )
              }
              bg="bg.800"
            >
              <option value="milkshake">Milkshake</option>
              <option value="sport nutrition">Sport nutrition</option>
            </Select>
          </FormControl>
        </HStack>

        <HStack w="full" align="flex-start" spacing="2">
          <FormControl isRequired flex="1" minW="0">
            <HStack h="24px" mb="2" align="center">
              <Text as="span">Serving quantity</Text>
              <Help
                text="The reference amount of powder. It's not the amount customer gets in a cup. Might be per 100g or per scoop ~20g or whatever is written on the package.
               Fill up nutrition facts as written on the package below. Then it will automatically recalculated to the amount of powder you give per real cup."
              />
            </HStack>

            <NumberInput min={0.01} precision={2} value={servingQuantity}>
              <NumberInputField
                onChange={(event) =>
                  onServingQuantityChange(event.target.value)
                }
                bg="bg.800"
              />
            </NumberInput>
            <FormHelperText>Written on package</FormHelperText>
          </FormControl>

          <FormControl isRequired flex="1" minW="0">
            <HStack h="24px" mb="2" align="center">
              <FormLabel mb="0">Unit</FormLabel>
              <Help text="Depends on if it's powder or liquid." />
            </HStack>
            <Select
              value={servingUnit}
              onChange={(event) =>
                onServingUnitChange(event.target.value as "g" | "ml")
              }
              bg="bg.800"
            >
              <option value="g">g</option>
              <option value="ml">ml</option>
            </Select>
            <FormHelperText>grams, milliliters</FormHelperText>
          </FormControl>
        </HStack>
      </VStack>

      <HStack justify="space-between" mb="3">
        <Box>
          <HStack>
            <FormLabel mb="0">Components</FormLabel>
            <Help text="Nutrition facts for one Serving quantity above (e.g. per 100g): calories, protein, fat, carbs, and any other nutrients with their amount and unit." />
          </HStack>
          <Text color="bg.300" fontSize="sm">
            Up to {MAX_COMPONENTS} components per product.
          </Text>
        </Box>
        <Text color="bg.300" fontSize="sm">
          {rows.length} / {MAX_COMPONENTS}
        </Text>
      </HStack>

      <VStack
        spacing="4"
        align="stretch"
        bgColor="bg.1000"
        px={{ base: "1", sm: "2", md: "4" }}
        py={{ base: "3", md: "4" }}
        borderRadius="md"
      >
        {rows.map((row, index) => {
          return (
            <Grid
              key={row.id}
              templateColumns={{
                base: "40px minmax(0, 1fr) 96px 40px",
                md: "40px minmax(0, 1fr) 96px 92px 40px",
              }}
              templateRows={{ base: "40px 40px", md: "40px" }}
              columnGap={{ base: "2", md: "3" }}
              rowGap="2"
              alignItems="center"
              bg="whiteAlpha.50"
              border="1px solid"
              borderColor="whiteAlpha.100"
              borderRadius="lg"
              px={{ base: "1", md: "2" }}
              py="2"
              onDragOver={(event) => handleDragOver(event, index)}
            >
              <IconButton
                aria-label={`Drag component ${index + 1} to reorder`}
                title="Drag to reorder"
                icon={<FaGripVertical />}
                cursor="grab"
                gridColumn="1"
                gridRow="1"
                draggable
                onDragStart={(event) => {
                  setDraggedRowId(row.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", row.id);
                }}
                onDragEnd={() => setDraggedRowId("")}
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    moveRow(row.id, index - 1);
                  }
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    moveRow(row.id, index + 1);
                  }
                }}
              />
              <Box minW="0" gridColumn={{ base: "2 / 4", md: "2" }} gridRow="1">
                <ComponentNameSelect
                  autoFocusCustomName={row.id === focusedRowId}
                  components={components}
                  value={row.name}
                  onCreateCustom={(name) =>
                    updateRow(row.id, {
                      componentId: "",
                      isCustom: true,
                      name,
                    })
                  }
                  onSelect={(component) =>
                    updateRow(row.id, {
                      componentId: String(component.id),
                      isCustom: false,
                      name: component.name,
                      quantity:
                        component.default_value !== undefined &&
                        component.default_value !== null
                          ? String(component.default_value)
                          : row.quantity,
                      unit: component.unit || row.unit,
                    })
                  }
                />
              </Box>
              <Box
                minW="0"
                gridColumn={{ base: "1 / 3", md: "3" }}
                gridRow={{ base: "2", md: "1" }}
              >
                <NumberInput min={0.001} precision={3} value={row.quantity}>
                  <NumberInputField
                    aria-label={`Quantity for component ${index + 1}`}
                    onChange={(event) =>
                      updateRow(row.id, { quantity: event.target.value })
                    }
                    h="40px"
                    borderColor="whiteAlpha.200"
                  />
                </NumberInput>
              </Box>
              <Select
                aria-label={`Unit for component ${index + 1}`}
                value={row.unit}
                onChange={(event) =>
                  updateRow(row.id, { unit: event.target.value })
                }
                gridColumn={{ base: "3 / 5", md: "4" }}
                gridRow={{ base: "2", md: "1" }}
                w="full"
                h="40px"
                borderColor="whiteAlpha.200"
              >
                {componentUnits.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </Select>
              <IconButton
                color="red.300"
                aria-label={`Remove component ${index + 1}`}
                icon={<RxCross2 />}
                variant="ghost"
                maxW="40px "
                ml="auto"
                gridColumn={{ base: "4", md: "5" }}
                gridRow="1"
                onClick={() =>
                  onChange(rows.filter((item) => item.id !== row.id))
                }
              />
            </Grid>
          );
        })}
        <Button
          mt="4"
          leftIcon={<FaPlus />}
          variant="outline"
          onClick={addRow}
          border="3px dashed"
          borderColor="whiteAlpha.300"
          bg="bg.900"
          color="bg.400"
          _hover={{ bg: "bg.800" }}
          _active={{ bg: "bg.700" }}
          isDisabled={rows.length >= MAX_COMPONENTS}
        >
          Add component
        </Button>
      </VStack>

      <Divider my="4" />
      <Box mt="7">
        <HStack justify="space-between" align="center" mb="1">
          <FormLabel mb="0">Dosage</FormLabel>
          {!isDependent ? <HStack as="label" spacing="2" cursor="pointer">
            <Text color="bg.200" fontSize="sm">
              Small drink option
            </Text>
            <Switch
              aria-label="Enable small drink fields"
              colorScheme="acid"
              isChecked={isSmallDrinkEnabled}
              onChange={(event) => {
                const isEnabled = event.target.checked;
                setIsSmallDrinkEnabled(isEnabled);
                if (!isEnabled) {
                  onDosageChange({
                    ...dosage,
                    smallDrinkPrice: "",
                    smallDrinkVolume: "",
                  });
                }
              }}
            />
          </HStack> : null}
        </HStack>
        <Text color="bg.300" fontSize="sm" mb="3">
          Machine recipe for one drink.
        </Text>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing="4">
          <FormControl isRequired isInvalid={exceedsFullDrinkVolume}>
            <HStack>
              <Icon as={FaWhiskeyGlass} color="acid.300" />
              <Text as="span">Full drink volume</Text>
              <Help text="Total size of the large cup drink, in ml (e.g. 300). Water, Product and Conversion factor below are set for this size; smaller cup sizes are calculated automatically." />
            </HStack>
            <NumberInput min={50} precision={2} value={dosage.drinkVolume}>
              <NumberInputField
                onChange={(event) =>
                  onDosageChange({
                    ...dosage,
                    drinkVolume: event.target.value,
                  })
                }
                bg="bg.800"
              />
            </NumberInput>
          </FormControl>

          {!isDependent ? <FormControl>
            <HStack flexWrap="wrap">
              <Icon as={FaCoins} color="acid.300" />
              <Text as="span">Full drink price</Text>
              <Help text="Default library price for the large cup. A container can override it." />
            </HStack>
            <NumberInput
              min={0.01}
              precision={2}
              value={dosage.fullDrinkPrice}
              position="relative"
            >
              <NumberInputField
                onChange={(event) =>
                  onDosageChange({
                    ...dosage,
                    fullDrinkPrice: event.target.value,
                  })
                }
                bg="bg.800"
                pr="24"
              />
              {currencyMenu("Full drink price currency")}
            </NumberInput>
            <FormHelperText>
              This is the library default. A container can override the price.
            </FormHelperText>
          </FormControl> : null}
        </SimpleGrid>

        <Collapse in={!isDependent && isSmallDrinkEnabled}>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing="4" mt="4">
            <FormControl isInvalid={Boolean(smallDrinkVolumeError)}>
              <HStack>
                <Icon as={FaGlassWhiskey} color="acid.300" />
                <Text as="span">Small drink volume</Text>
                <Help text="Size of the small cup option, in ml. Leave blank if this product is only sold in one size. Must be at least 100ml. Water and Product amounts are computed automatically." />
              </HStack>
              <NumberInput
                min={100}
                precision={2}
                value={dosage.smallDrinkVolume}
              >
                <NumberInputField
                  onChange={(event) =>
                    onDosageChange({
                      ...dosage,
                      smallDrinkVolume: event.target.value,
                    })
                  }
                  bg="bg.800"
                />
              </NumberInput>
              <FormErrorMessage>{smallDrinkVolumeError}</FormErrorMessage>
            </FormControl>

            <FormControl>
              <HStack flexWrap="wrap">
                <Icon as={FaCoins} color="acid.300" />
                <Text as="span">Small drink price</Text>
                <Help text="Default library price for the small cup. A container can override it." />
              </HStack>
              <NumberInput
                min={0}
                precision={2}
                value={dosage.smallDrinkPrice}
                position="relative"
              >
                <NumberInputField
                  onChange={(event) =>
                    onDosageChange({
                      ...dosage,
                      smallDrinkPrice: event.target.value,
                    })
                  }
                  bg="bg.800"
                  pr="24"
                />
                {currencyMenu("Small drink price currency")}
              </NumberInput>
              <FormHelperText>
                This is the library default. A container can override the price.
              </FormHelperText>
            </FormControl>
          </SimpleGrid>
        </Collapse>

        <HStack spacing={{ base: "2", md: "4" }} align="flex-start" mt="4">
          <FormControl
            isRequired
            flex="1"
            minW="0"
            isInvalid={Boolean(waterError) || exceedsFullDrinkVolume}
          >
            <HStack>
              <Text as="span" fontSize={["xs", "md"]}>
                Water
              </Text>
              <Help text="Amount of water (ml) added to the Full drink volume above. Must be between 50–500ml." />
            </HStack>
            <NumberInput min={50} max={500} precision={2} value={dosage.water}>
              <NumberInputField
                onChange={(event) =>
                  onDosageChange({ ...dosage, water: event.target.value })
                }
                bg="bg.800"
              />
            </NumberInput>
            <FormErrorMessage>{waterError}</FormErrorMessage>
          </FormControl>

          <FormControl
            isRequired
            flex="1"
            minW="0"
            isInvalid={exceedsFullDrinkVolume}
          >
            <HStack>
              <Text as="span" fontSize={["xs", "md"]}>
                Product
              </Text>
              <Help text="Amount of this product dispensed into the Full drink volume above — grams for Powder or milliliters for Concentrate/Syrup." />
            </HStack>
            <NumberInput min={0.01} precision={2} value={dosage.product}>
              <NumberInputField
                onChange={(event) =>
                  onDosageChange({ ...dosage, product: event.target.value })
                }
                bg="bg.800"
              />
            </NumberInput>
            <FormErrorMessage>
              {exceedsFullDrinkVolume
                ? "Water + Product can't exceed the drink volume."
                : ""}
            </FormErrorMessage>
          </FormControl>

          <FormControl isRequired flex="1" minW="0">
            <HStack>
              <Text as="span" fontSize={["xs", "md"]}>
                Conversion
              </Text>
              <Help text="How fast this machine's pump physically dispenses the product — not a recipe ratio. Starting values are 4 for Powder and 1.5 for Concentrate, but the real number must come from calibrating the machine before the product goes live." />
            </HStack>
            <NumberInput
              min={0.01}
              precision={2}
              value={dosage.conversionFactor}
            >
              <NumberInputField
                onChange={(event) =>
                  onDosageChange({
                    ...dosage,
                    conversionFactor: event.target.value,
                  })
                }
                bg="bg.800"
              />
            </NumberInput>
          </FormControl>
        </HStack>
      </Box>
    </Box>
  );
}
