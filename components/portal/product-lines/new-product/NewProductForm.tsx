import {
  Alert,
  AlertIcon,
  Box,
  Divider,
  FormControl,
  FormLabel,
  FormHelperText,
  HStack,
  Switch,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import type { FormEventHandler } from "react";
import type {
  PortalComponent,
  PortalProductPurpose,
  PortalProductType,
} from "../../../../types/portal";
import type { Currency } from "../../../../types/strapi";
import {
  ProductComponentsTable,
  type ProductComponentRow,
  type ProductDosageValue,
} from "./ProductComponentsTable";
import { ProductNameSelect, type ProductNameOption } from "./ProductNameSelect";
import {
  SearchableImageSelect,
  type SearchableImageOption,
} from "../SearchableImageSelect";
import { Help } from "../../../Help";
import {
  RelationMultiSelect,
  type RelationMultiSelectOption,
} from "../RelationMultiSelect";

type NewProductFormProps = {
  brandId: string;
  brandOptions: SearchableImageOption[];
  canEditMachineCurrency: boolean;
  currencies: Currency[];
  componentRows: ProductComponentRow[];
  components: PortalComponent[];
  description: string;
  dosage: ProductDosageValue;
  error: string;
  formId: string;
  mainImageId: string;
  mainImageOptions: SearchableImageOption[];
  name: string;
  onBrandChange: (value: string) => void;
  onComponentRowsChange: (rows: ProductComponentRow[]) => void;
  onCreateCustomProduct: () => void;
  onDescriptionChange: (value: string) => void;
  onDosageChange: (value: ProductDosageValue) => void;
  onNameChange: (value: string) => void;
  onProductSelect: (product: ProductNameOption) => void;
  onProductPurposeChange: (value: PortalProductPurpose) => void;
  onProductTypeChange: (value: PortalProductType) => void;
  onServingQuantityChange: (value: string) => void;
  onServingUnitChange: (value: "g" | "ml") => void;
  onShowMoreMainImages: () => void;
  onShowMoreSplashes: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onVisualChange: {
    circle: (value: string) => void;
    mainImage: (value: string) => void;
    splash: (value: string) => void;
  };
  productLineName: string;
  priceCurrencyId: string;
  isCurrencySaving: boolean;
  onPriceCurrencyChange: (value: string) => void;
  productOptions: ProductNameOption[];
  productPurpose: PortalProductPurpose;
  productType: PortalProductType;
  servingQuantity: string;
  servingUnit: "g" | "ml";
  splashId: string;
  splashOptions: SearchableImageOption[];
  circleId: string;
  circleOptions: SearchableImageOption[];
  cupId: string;
  cupOptions: SearchableImageOption[];
  defaultCup?: SearchableImageOption;
  onCupChange: (value: string) => void;
  isDependent: boolean;
  onIsDependentChange: (value: boolean) => void;
  canBeAddedToIds: string[];
  canBeAddedToOptions: RelationMultiSelectOption[];
  onCanBeAddedToChange: (value: string[]) => void;
  mixAllowlistEmpty: boolean;
  mixPreview?: string[];
};

export function NewProductForm({
  brandId,
  brandOptions,
  canEditMachineCurrency,
  currencies,
  componentRows,
  components,
  description,
  dosage,
  error,
  formId,
  mainImageId,
  mainImageOptions,
  name,
  onBrandChange,
  onComponentRowsChange,
  onCreateCustomProduct,
  onDescriptionChange,
  onDosageChange,
  onNameChange,
  onProductSelect,
  onProductPurposeChange,
  onProductTypeChange,
  onServingQuantityChange,
  onServingUnitChange,
  onShowMoreMainImages,
  onShowMoreSplashes,
  onSubmit,
  onVisualChange,
  productLineName,
  priceCurrencyId,
  isCurrencySaving,
  onPriceCurrencyChange,
  productOptions,
  productPurpose,
  productType,
  servingQuantity,
  servingUnit,
  splashId,
  splashOptions,
  circleId,
  circleOptions,
  cupId,
  cupOptions,
  defaultCup,
  onCupChange,
  isDependent,
  onIsDependentChange,
  canBeAddedToIds,
  canBeAddedToOptions,
  onCanBeAddedToChange,
  mixAllowlistEmpty,
  mixPreview = [],
}: NewProductFormProps) {
  return (
    <Box
      as="form"
      id={formId}
      onSubmit={onSubmit}
      autoComplete="off"
      bg="bg.900"
      border="1px solid"
      borderColor="whiteAlpha.100"
      borderRadius="2xl"
      px={{ base: "2", sm: "4", md: "7" }}
      py={{ base: "5", md: "7" }}
    >
      <VStack spacing="5" align="stretch">
        <Box>
          <Text color="bg.300" fontSize="sm">
            Product line
          </Text>
          <Text color="bg.50" fontSize="xl" fontWeight="800">
            {productLineName}
          </Text>
        </Box>

        <FormControl isRequired>
          <FormLabel>Brand</FormLabel>
          <SearchableImageSelect
            ariaLabel="Select a brand"
            emptyLabel="No brands found"
            options={brandOptions}
            placeholder="Select a brand"
            value={brandId}
            onChange={onBrandChange}
          />
        </FormControl>

        <FormControl isRequired>
          <FormLabel>Name</FormLabel>
          <ProductNameSelect
            value={name}
            options={productOptions}
            onNameChange={onNameChange}
            onProductSelect={onProductSelect}
            onCreateCustom={onCreateCustomProduct}
          />
          {!brandId ? (
            <Text color="bg.400" fontSize="sm" mt="2">
              Select a brand first to see matching root products.
            </Text>
          ) : null}
        </FormControl>

        <FormControl isRequired>
          <FormLabel>Splash</FormLabel>
          <SearchableImageSelect
            ariaLabel="Select a splash"
            emptyLabel="No splashes found"
            options={splashOptions}
            placeholder="Select a splash"
            value={splashId}
            onChange={onVisualChange.splash}
            onShowMore={onShowMoreSplashes}
          />
        </FormControl>

        <FormControl isRequired>
          <FormLabel>Circle</FormLabel>
          <SearchableImageSelect
            ariaLabel="Select a circle"
            emptyLabel="No circles found"
            options={circleOptions}
            placeholder="Select a circle"
            value={circleId}
            onChange={onVisualChange.circle}
          />
        </FormControl>

        <FormControl isRequired>
          <FormLabel>Taste main image</FormLabel>
          <SearchableImageSelect
            ariaLabel="Select a taste main image"
            emptyLabel="No taste main images found"
            options={mainImageOptions}
            placeholder="Select a taste main image"
            value={mainImageId}
            onChange={onVisualChange.mainImage}
            onShowMore={onShowMoreMainImages}
          />
        </FormControl>

        <FormControl>
          <FormLabel>Custom cup</FormLabel>
          <SearchableImageSelect
            ariaLabel="Select a custom cup"
            emptyLabel="No cups are available for this product line"
            options={cupOptions}
            placeholder="Select a cup"
            value={cupId}
            onChange={onCupChange}
            clearLabel="Use product-line default cup"
            isSearchable={false}
            optionLayout="tiles"
            fallbackOption={defaultCup}
          />
          <Text color="bg.400" fontSize="sm" mt="2">
            Optional. Only cups belonging to this product line are available.
          </Text>
        </FormControl>

        <FormControl>
          <FormLabel>Description</FormLabel>
          <Textarea
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            maxLength={2000}
            placeholder="Optional product description"
            bg="bg.800"
          />
        </FormControl>

        <Divider />

        <FormControl>
          <HStack justify="space-between" align="center">
            <HStack spacing="1">
              <FormLabel mb="0">Not a drink on its own (add-on only)</FormLabel>
              <Help text="Shown on the kiosk only as an addition to other drinks, at its full dose." />
            </HStack>
            <Switch
              aria-label="Not a drink on its own (add-on only)"
              isChecked={isDependent}
              onChange={(event) => onIsDependentChange(event.target.checked)}
              colorScheme="green"
            />
          </HStack>
        </FormControl>

        <FormControl>
          <FormLabel>Can be added to</FormLabel>
          {mixAllowlistEmpty ? (
            <Box
              border="1px dashed"
              borderColor="whiteAlpha.300"
              borderRadius="lg"
              px="4"
              py="3"
            >
              <Text color="bg.300" fontSize="sm">
                This product line can&apos;t be added to other drinks. Ask iShaker support.
              </Text>
            </Box>
          ) : (
            <RelationMultiSelect
              ariaLabel="Select drinks this product can be added to"
              emptyLabel="No eligible drinks are available yet."
              options={canBeAddedToOptions}
              value={canBeAddedToIds}
              onChange={onCanBeAddedToChange}
              placeholder="Select base drinks"
            />
          )}
          <FormHelperText>
            Only eligible drinks from your own library are shown.
          </FormHelperText>
          {mixPreview.length ? (
            <Box mt="3" bg="whiteAlpha.50" borderRadius="lg" p="3">
              <Text color="bg.200" fontSize="sm" fontWeight="700" mb="1">
                Mix preview
              </Text>
              {mixPreview.map((line) => (
                <Text key={line} color="bg.300" fontSize="sm">
                  {line}
                </Text>
              ))}
              <Text color="acid.300" fontSize="sm" mt="1">
                Price: same as the base drink
              </Text>
            </Box>
          ) : null}
        </FormControl>

        <Divider />

        <ProductComponentsTable
          components={components}
          dosage={dosage}
          rows={componentRows}
          onChange={onComponentRowsChange}
          onDosageChange={onDosageChange}
          onProductPurposeChange={onProductPurposeChange}
          onProductTypeChange={onProductTypeChange}
          onServingQuantityChange={onServingQuantityChange}
          onServingUnitChange={onServingUnitChange}
          servingQuantity={servingQuantity}
          servingUnit={servingUnit}
          productPurpose={productPurpose}
          productType={productType}
          currencies={currencies}
          canEditMachineCurrency={canEditMachineCurrency}
          priceCurrencyId={priceCurrencyId}
          isCurrencySaving={isCurrencySaving}
          onPriceCurrencyChange={onPriceCurrencyChange}
          isDependent={isDependent}
        />

        {error ? (
          <Alert status="error" borderRadius="xl">
            <AlertIcon />
            {error}
          </Alert>
        ) : null}
      </VStack>
    </Box>
  );
}
