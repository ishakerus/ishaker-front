import { HStack, IconButton, Switch, Text } from "@chakra-ui/react";
import Link from "next/link";
import { FiInfo } from "react-icons/fi";

type MachineSettingToggleHeaderProps = {
  title: string;
  switchLabel: string;
  isChecked: boolean;
  isDisabled?: boolean;
  onChange: (isChecked: boolean) => void;
  articleHref?: string;
  articleLabel?: string;
  switchId?: string;
};

export function MachineSettingToggleHeader({
  title,
  switchLabel,
  isChecked,
  isDisabled = false,
  onChange,
  articleHref,
  articleLabel,
  switchId,
}: MachineSettingToggleHeaderProps) {
  return (
    <HStack justify="space-between" align="center" spacing="4">
      <HStack spacing="1" minW="0">
        <Text color="acid.300" fontWeight="800" fontSize="lg">
          {title}
        </Text>
        {articleHref ? (
          <IconButton
            as={Link}
            href={articleHref}
            aria-label={articleLabel || `Learn about ${title}`}
            icon={<FiInfo size="1.2rem" />}
            variant="ghost"
            size="xs"
            color="acid.300"
            flexShrink={0}
          />
        ) : null}
      </HStack>
      <Switch
        id={switchId}
        aria-label={switchLabel}
        colorScheme="green"
        size="lg"
        isChecked={isChecked}
        isDisabled={isDisabled}
        onChange={(event) => onChange(event.target.checked)}
        flexShrink={0}
      />
    </HStack>
  );
}
