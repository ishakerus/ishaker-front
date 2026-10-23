import { Box, Button, HStack, Input, Text, useFormControl } from "@chakra-ui/react";
import { useRef, type ChangeEventHandler } from "react";

type EnglishFileInputProps = {
  accept?: string;
  multiple?: boolean;
  selectedFiles: readonly File[];
  onChange: ChangeEventHandler<HTMLInputElement>;
};

export function EnglishFileInput({ accept, multiple = false, selectedFiles, onChange }: EnglishFileInputProps) {
  const input = useRef<HTMLInputElement>(null);
  const control = useFormControl({});
  const selection = selectedFiles.length
    ? selectedFiles.map((file) => file.name).join(", ")
    : multiple ? "No files chosen" : "No file chosen";

  return (
    <Box>
      <Input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        display="none"
        onChange={onChange}
      />
      <HStack spacing="3" border="1px solid" borderColor="whiteAlpha.200" borderRadius="md" p="1" bg="bg.800" minW="0">
        <Button
          type="button"
          size="sm"
          variant="default"
          flexShrink="0"
          isDisabled={control.disabled}
          aria-describedby={control["aria-describedby"]}
          aria-labelledby={control.id ? `${control.id}-label ${control.id}-choose` : undefined}
          id={control.id ? `${control.id}-choose` : undefined}
          onClick={() => input.current?.click()}
        >
          {multiple ? "Choose files" : "Choose file"}
        </Button>
        <Text fontSize="sm" color={selectedFiles.length ? "bg.100" : "bg.300"} noOfLines={1} title={selection} aria-live="polite">
          {selection}
        </Text>
      </HStack>
    </Box>
  );
}
