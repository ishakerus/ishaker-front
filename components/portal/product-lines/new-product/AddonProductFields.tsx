import {
  Box,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  NumberInput,
  NumberInputField,
  Text,
} from "@chakra-ui/react";
import { ADDON_NAME_MAX_LENGTH } from "../../../../lib/portal/addonName";
import {
  SearchableImageSelect,
  type SearchableImageOption,
} from "../SearchableImageSelect";

type AddonProductFieldsProps = {
  brandId: string;
  brandOptions: SearchableImageOption[];
  dosage: string;
  price: string;
  currencyCode: string;
  name: string;
  onBrandChange: (value: string) => void;
  onDosageChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onPriceChange: (value: string) => void;
};

export function AddonProductFields({
  brandId,
  brandOptions,
  dosage,
  price,
  currencyCode,
  name,
  onBrandChange,
  onDosageChange,
  onNameChange,
  onPriceChange,
}: AddonProductFieldsProps) {
  return (
    <>
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
        <FormLabel htmlFor="addon-name">Name</FormLabel>
        <Input
          id="addon-name"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          minLength={2}
          maxLength={ADDON_NAME_MAX_LENGTH}
          placeholder="e.g. Creatine"
          bg="bg.800"
        />
        <FormHelperText>Maximum {ADDON_NAME_MAX_LENGTH} characters.</FormHelperText>
      </FormControl>

      <FormControl isRequired>
        <FormLabel htmlFor="addon-dosage">Dosage (g)</FormLabel>
        <NumberInput
          min={0.01}
          precision={2}
          value={dosage}
          onChange={onDosageChange}
        >
          <NumberInputField id="addon-dosage" bg="bg.800" />
        </NumberInput>
        <FormHelperText>
          Fixed amount added to one drink, regardless of cup size.
        </FormHelperText>
      </FormControl>

      <FormControl isRequired>
        <FormLabel htmlFor="addon-price">Add-on price</FormLabel>
        <Box position="relative">
          <Input
            id="addon-price"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={price}
            onChange={(event) => onPriceChange(event.target.value)}
            bg="bg.800"
            pr="24"
          />
          <Text
            position="absolute"
            right="4"
            top="50%"
            transform="translateY(-50%)"
            color="acid.300"
            fontWeight="800"
            pointerEvents="none"
          >
            {currencyCode}
          </Text>
        </Box>
        <FormHelperText>
          Added to the base drink price for one full dose, regardless of cup size.
          Enter 0 for a free add-on, or at least 0.02 for a paid add-on.
        </FormHelperText>
      </FormControl>
    </>
  );
}
