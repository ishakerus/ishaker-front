import {
  Badge,
  Box,
  Button,
  Checkbox,
  HStack,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
  VStack,
} from "@chakra-ui/react";
import { FiChevronDown } from "react-icons/fi";

export type RelationMultiSelectOption = {
  id: string;
  label: string;
  note?: string;
  isDisabled?: boolean;
};

type RelationMultiSelectProps = {
  ariaLabel: string;
  emptyLabel: string;
  options: RelationMultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
};

export function RelationMultiSelect({
  ariaLabel,
  emptyLabel,
  options,
  value,
  onChange,
  placeholder = "Select products",
}: RelationMultiSelectProps) {
  const selected = options.filter((option) => value.includes(option.id));
  const toggle = (id: string) =>
    onChange(
      value.includes(id)
        ? value.filter((selectedId) => selectedId !== id)
        : [...value, id],
    );

  return (
    <Menu closeOnSelect={false} matchWidth placement="bottom-start">
      <MenuButton
        as={Button}
        aria-label={ariaLabel}
        rightIcon={<FiChevronDown />}
        w="full"
        minH="44px"
        h="auto"
        py="2"
        px="3"
        bg="bg.800"
        border="1px solid"
        borderColor="whiteAlpha.200"
        textAlign="left"
        whiteSpace="normal"
        fontWeight="normal"
        _hover={{ borderColor: "whiteAlpha.400" }}
        _expanded={{ borderColor: "acid.300" }}
      >
        {selected.length ? (
          <HStack spacing="1.5" flexWrap="wrap">
            {selected.map((option) => (
              <Badge key={option.id} colorScheme="green" variant="subtle">
                {option.label}
              </Badge>
            ))}
          </HStack>
        ) : (
          <Text color="bg.400">{placeholder}</Text>
        )}
      </MenuButton>
      <MenuList
        bg="bg.900"
        borderColor="whiteAlpha.200"
        p="1.5"
        maxH="360px"
        overflowY="auto"
        zIndex="popover"
      >
        {options.length ? (
          options.map((option) => (
            <MenuItem
              key={option.id}
              isDisabled={option.isDisabled}
              bg="transparent"
              borderRadius="md"
              py="2.5"
              onClick={() => !option.isDisabled && toggle(option.id)}
              _hover={{ bg: "whiteAlpha.100" }}
              _focus={{ bg: "whiteAlpha.100" }}
            >
              <Checkbox
                isChecked={value.includes(option.id)}
                isDisabled={option.isDisabled}
                pointerEvents="none"
                colorScheme="green"
                mr="3"
              />
              <VStack align="start" spacing="0" minW="0">
                <Text noOfLines={1}>{option.label}</Text>
                {option.note ? (
                  <Text color="orange.200" fontSize="xs">
                    {option.note}
                  </Text>
                ) : null}
              </VStack>
            </MenuItem>
          ))
        ) : (
          <Box px="3" py="2">
            <Text color="bg.400" fontSize="sm">
              {emptyLabel}
            </Text>
          </Box>
        )}
      </MenuList>
    </Menu>
  );
}
