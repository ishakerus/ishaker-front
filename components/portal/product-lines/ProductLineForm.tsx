import {
  Alert,
  AlertIcon,
  Box,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { FormEventHandler, ReactNode } from "react";
import {
  SearchableImageSelect,
  type SearchableImageOption,
} from "./SearchableImageSelect";
import {
  RelationMultiSelect,
  type RelationMultiSelectOption,
} from "./RelationMultiSelect";

type ProductLineFormProps = {
  baseOptions: SearchableImageOption[];
  baseProductLineId: string;
  isBaseSelectionDisabled?: boolean;
  canSubmit: boolean;
  customSplashId: string;
  cupSelector?: ReactNode;
  duplicateSuggestion?: ReactNode;
  error?: string;
  canBeAddedToHint?: string;
  canBeAddedToIds?: string[];
  canBeAddedToOptions?: RelationMultiSelectOption[];
  canEditMixRules?: boolean;
  isSubmitting: boolean;
  onBaseProductLineChange: (value: string) => void;
  onCanBeAddedToChange?: (value: string[]) => void;
  onCustomSplashChange: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  splashOptions: SearchableImageOption[];
  submitLabel?: string;
};

export function ProductLineForm({
  baseOptions,
  baseProductLineId,
  isBaseSelectionDisabled = false,
  canSubmit,
  customSplashId,
  cupSelector,
  duplicateSuggestion,
  error,
  canBeAddedToHint,
  canBeAddedToIds = [],
  canBeAddedToOptions = [],
  canEditMixRules = false,
  isSubmitting,
  onBaseProductLineChange,
  onCanBeAddedToChange,
  onCustomSplashChange,
  onSubmit,
  splashOptions,
  submitLabel = "Create product line",
}: ProductLineFormProps) {
  return (
    <Box
      as="form"
      onSubmit={onSubmit}
      autoComplete="off"
      bg="bg.900"
      border="1px solid"
      borderColor="whiteAlpha.100"
      borderRadius="2xl"
      p={{ base: "5", md: "7" }}
    >
      <VStack spacing="5" align="stretch">
        <FormControl isRequired>
          <FormLabel>Product line</FormLabel>
          <SearchableImageSelect
            ariaLabel="Select a product line"
            emptyLabel="No root product lines found"
            options={baseOptions}
            placeholder="Select a product line"
            value={baseProductLineId}
            onChange={onBaseProductLineChange}
            isSearchable={false}
            isDisabled={isBaseSelectionDisabled}
          />
        </FormControl>

        {duplicateSuggestion}

        {canEditMixRules ? (
          <FormControl>
            <FormLabel>Can be added to</FormLabel>
            <RelationMultiSelect
              ariaLabel="Select product lines this line can be added to"
              emptyLabel="No other template product lines are available."
              options={canBeAddedToOptions}
              value={canBeAddedToIds}
              onChange={(value) => onCanBeAddedToChange?.(value)}
              placeholder="Select destination product lines"
            />
            <FormHelperText>
              Products from this line may be poured into products from the selected lines.
            </FormHelperText>
          </FormControl>
        ) : canBeAddedToHint ? (
          <HStack align="start" spacing="2">
            <Text color="bg.300" fontSize="sm">
              Can be added to: {canBeAddedToHint}
            </Text>
          </HStack>
        ) : null}

        <FormControl>
          <FormLabel>Custom splash</FormLabel>
          <SearchableImageSelect
            ariaLabel="Select a custom splash"
            emptyLabel="No splashes found"
            options={splashOptions}
            value={customSplashId}
            placeholder={
              baseProductLineId
                ? "Select a custom splash"
                : "Select a product line first"
            }
            onChange={onCustomSplashChange}
            clearLabel="Clear selected splash"
            isDisabled={!baseProductLineId}
            isSearchable
          />
          <FormHelperText>
            {baseProductLineId
              ? "Solid color splashes are suggested first; all splashes are available."
              : "Custom splash becomes available after selecting a product line."}
          </FormHelperText>
        </FormControl>

        {error ? (
          <Alert status="error" borderRadius="xl">
            <AlertIcon />
            {error}
          </Alert>
        ) : null}

        {cupSelector}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isSubmitting}
          isDisabled={!canSubmit}
        >
          {submitLabel}
        </Button>
      </VStack>
    </Box>
  );
}
