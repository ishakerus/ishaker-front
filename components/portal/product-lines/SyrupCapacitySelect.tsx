import { FormControl, FormLabel, Select } from "@chakra-ui/react";
import { SYRUP_CAPACITY_OPTIONS } from "../../../lib/portal/syrupVolume";

export function SyrupCapacitySelect({
  capacity,
  onChange,
}: {
  capacity: number;
  onChange: (litres: number) => void;
}) {
  return (
    <FormControl maxW="280px">
      <FormLabel fontSize="sm">Maximum volume (all bags)</FormLabel>
      <Select
        aria-label="Maximum volume for all syrup bags"
        value={capacity}
        onChange={(event) => onChange(Number(event.target.value))}
        bg="bg.900"
      >
        {!SYRUP_CAPACITY_OPTIONS.some(
          (option) => option.litres === capacity,
        ) ? (
          <option value={capacity}>{capacity} litres</option>
        ) : null}
        {SYRUP_CAPACITY_OPTIONS.map((option) => (
          <option key={option.litres} value={option.litres}>
            {option.label}
          </option>
        ))}
      </Select>
    </FormControl>
  );
}
