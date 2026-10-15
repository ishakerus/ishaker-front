import {
  Badge,
  Box,
  Button,
  HStack,
  Image,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  IconButton,
  Portal,
  SimpleGrid,
  VStack,
  Text,
} from "@chakra-ui/react";
import NextLink from "next/link";
import {
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { FaChevronDown, FaImages, FaTimes } from "react-icons/fa";

export type SearchableImageOption = {
  id: string;
  name: string;
  imageUrl?: string;
  color?: string;
  icon?: ReactNode;
  subtitle?: string;
  subtitleColor?: string;
  badge?: string;
  badgeColorScheme?: string;
  isDisabled?: boolean;
  disabledReason?: string;
};

export type SearchableImageSelectProps = {
  ariaLabel: string;
  emptyLabel: string;
  options: SearchableImageOption[];
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  clearLabel?: string;
  isDisabled?: boolean;
  isSearchable?: boolean;
  onShowMore?: () => void;
  showMoreLabel?: string;
  createHref?: string;
  optionLayout?: "list" | "tiles";
  fallbackOption?: SearchableImageOption;
};

export function SearchableImageSelect({
  ariaLabel,
  emptyLabel,
  options,
  placeholder,
  value,
  onChange,
  clearLabel,
  isDisabled = false,
  isSearchable = true,
  onShowMore,
  showMoreLabel = "Show images",
  createHref,
  optionLayout = "list",
  fallbackOption,
}: SearchableImageSelectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLInputElement | HTMLButtonElement>(null);
  const inputName = `portal-combobox-${useId().replace(/:/g, "")}`;
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const selected = options.find((option) => option.id === value);
  const displayedOption = selected || fallbackOption;
  const effectiveValue = value || fallbackOption?.id || "";
  const listboxId = `${ariaLabel.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}-options`;
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) =>
      option.name.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [options, query]);

  const closeAndBlur = () => {
    setIsOpen(false);
    setMenuPosition(null);
    setQuery("");
    triggerRef.current?.blur();
  };

  useEffect(() => {
    if (!isOpen) return;

    const updateMenuPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportMargin = 16;
      const menuGap = 8;
      const preferredHeight = optionLayout === "tiles" ? 560 : 360;
      const spaceBelow =
        window.innerHeight - rect.bottom - menuGap - viewportMargin;
      const spaceAbove = rect.top - menuGap - viewportMargin;
      const openAbove = spaceBelow < 220 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(
        120,
        Math.min(
          preferredHeight,
          openAbove ? spaceAbove : spaceBelow,
        ),
      );

      setMenuPosition({
        left: Math.max(
          viewportMargin,
          Math.min(rect.left, window.innerWidth - rect.width - viewportMargin),
        ),
        top: openAbove
          ? rect.top - menuGap - maxHeight
          : rect.bottom + menuGap,
        width: rect.width,
        maxHeight,
      });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen, optionLayout]);

  const listOptions = filteredOptions.map((option) => (
    <Button
      key={option.id}
      type="button"
      role="option"
      aria-selected={option.id === effectiveValue}
      variant={option.id === effectiveValue ? "primary" : "default"}
      isDisabled={option.isDisabled && option.id !== value}
      h="52px"
      px="3"
      justifyContent="flex-start"
      flex="0 0 auto"
      onClick={() => {
        onChange(option.id);
        closeAndBlur();
      }}
    >
      {option.imageUrl ? (
        <Image
          src={option.imageUrl}
          alt=""
          boxSize="36px"
          objectFit="contain"
          borderRadius="md"
          bg="whiteAlpha.100"
          mr="3"
        />
      ) : option.color ? (
        <Box
          aria-hidden="true"
          boxSize="36px"
          borderRadius="md"
          bg={option.color}
          border="1px solid"
          borderColor="whiteAlpha.300"
          mr="3"
          flex="0 0 auto"
        />
      ) : option.icon ? (
        <Box
          aria-hidden="true"
          boxSize="36px"
          borderRadius="md"
          bg="whiteAlpha.100"
          color="acid.300"
          display="flex"
          alignItems="center"
          justifyContent="center"
          fontSize="18px"
          mr="3"
          flex="0 0 auto"
        >
          {option.icon}
        </Box>
      ) : (
        <Box
          boxSize="36px"
          borderRadius="md"
          bg="whiteAlpha.100"
          mr="3"
          flex="0 0 auto"
        />
      )}
      <VStack spacing="0" minW="0" textAlign="left" align="stretch">
        <Box display="flex" alignItems="center" gap="2" minW="0">
          <Text noOfLines={1}>{option.name}</Text>
          {option.badge ? (
            <Badge
              colorScheme={option.badgeColorScheme || "gray"}
              flex="0 0 auto"
            >
              {option.badge}
            </Badge>
          ) : null}
        </Box>
        {option.disabledReason || option.subtitle ? (
          <Text
            fontSize="xs"
            color={
              option.disabledReason
                ? "orange.200"
                : option.subtitleColor || "bg.300"
            }
          >
            {option.disabledReason || option.subtitle}
          </Text>
        ) : null}
      </VStack>
    </Button>
  ));

  const tileOptions = filteredOptions.map((option) => (
    <Button
      key={option.id}
      type="button"
      role="option"
      aria-label={option.name}
      aria-selected={option.id === effectiveValue}
      isDisabled={option.isDisabled && option.id !== value}
      variant="unstyled"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minW="0"
      h={{ base: "150px", md: "190px" }}
      p="2"
      border="2px solid"
      borderColor={
        option.id === effectiveValue ? "acid.300" : "whiteAlpha.200"
      }
      borderRadius="xl"
      bg={option.id === effectiveValue ? "whiteAlpha.100" : "bg.800"}
      boxShadow={
        option.id === effectiveValue
          ? "0 0 0 1px var(--chakra-colors-acid-300)"
          : "none"
      }
      _hover={{
        borderColor:
          option.id === effectiveValue ? "acid.300" : "whiteAlpha.400",
      }}
      _focusVisible={{ boxShadow: "outline" }}
      onClick={() => {
        onChange(option.id);
        closeAndBlur();
      }}
    >
      {option.imageUrl ? (
        <Image
          src={option.imageUrl}
          alt=""
          w="full"
          h={{ base: "112px", md: "150px" }}
          objectFit="contain"
          draggable={false}
        />
      ) : (
        <Box flex="1" />
      )}
      <Text mt="1" w="full" fontSize="sm" fontWeight="700" noOfLines={1}>
        {option.name}
      </Text>
    </Button>
  ));

  const optionList = (maxHeight: string) => (
    <VStack spacing="1" maxH={maxHeight} overflowY="auto" align="stretch">
      {clearLabel && value ? (
        <Button
          type="button"
          variant="default"
          h="52px"
          px="3"
          justifyContent="flex-start"
          color="bg.300"
          flex="0 0 auto"
          onClick={() => {
            onChange("");
            closeAndBlur();
          }}
        >
          {clearLabel}
        </Button>
      ) : null}
      {optionLayout === "tiles" ? (
        <SimpleGrid columns={{ base: 2, md: 3 }} spacing="3">
          {tileOptions}
        </SimpleGrid>
      ) : (
        listOptions
      )}
      {!filteredOptions.length ? (
        <Text color="bg.300" py="4" textAlign="center">
          {emptyLabel}
        </Text>
      ) : null}
    </VStack>
  );

  const selectorActions = onShowMore || createHref ? (
    <HStack spacing="3" my={{ base: "3", md: "4" }}>
      {onShowMore ? (
        <Button
          type="button"
          variant="no_contrast"
          flex="1"
          leftIcon={<FaImages size="1rem" />}
          onClick={() => {
            onShowMore();
            closeAndBlur();
          }}
        >
          {showMoreLabel}
        </Button>
      ) : null}
      {createHref ? (
        <Button as={NextLink} href={createHref} variant="no_contrast">
          Create
        </Button>
      ) : null}
    </HStack>
  ) : null;

  return (
    <Box
      ref={containerRef}
      position="relative"
      w="full"
      pointerEvents={isDisabled ? "none" : "auto"}
    >
      {isSearchable ? (
        <InputGroup size="lg">
          {displayedOption?.imageUrl ? (
            <InputLeftElement h="56px" w="52px" pointerEvents="none">
              <Image
                src={displayedOption.imageUrl}
                alt=""
                boxSize="34px"
                objectFit="contain"
                borderRadius="md"
                bg="whiteAlpha.100"
              />
            </InputLeftElement>
          ) : displayedOption?.color ? (
            <InputLeftElement h="56px" w="52px" pointerEvents="none">
              <Box
                aria-hidden="true"
                boxSize="28px"
                borderRadius="md"
                bg={displayedOption.color}
                border="1px solid"
                borderColor="whiteAlpha.300"
              />
            </InputLeftElement>
          ) : displayedOption?.icon ? (
            <InputLeftElement
              h="56px"
              w="52px"
              pointerEvents="none"
              color="acid.300"
              fontSize="18px"
            >
              {displayedOption.icon}
            </InputLeftElement>
          ) : null}
          <Input
            ref={triggerRef as React.RefObject<HTMLInputElement>}
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={isOpen}
            aria-label={ariaLabel}
            name={inputName}
            autoComplete="one-time-code"
            data-1p-ignore
            data-form-type="other"
            data-lpignore="true"
            spellCheck={false}
            value={isOpen ? query : displayedOption?.name || ""}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              if (!isOpen) setQuery("");
              setIsOpen(true);
            }}
            onClick={() => setIsOpen(true)}
            onBlur={() => {
              window.setTimeout(() => {
                if (!containerRef.current?.contains(document.activeElement)) {
                  setIsOpen(false);
                  setMenuPosition(null);
                  setQuery("");
                }
              }, 0);
            }}
            placeholder={placeholder}
            isDisabled={isDisabled}
            h="56px"
            pl={
              displayedOption?.imageUrl ||
              displayedOption?.color ||
              displayedOption?.icon
                ? "52px"
                : "4"
            }
            pr="44px"
            bg="bg.800"
            borderColor="whiteAlpha.200"
            color="bg.50"
            _placeholder={{ color: "bg.300" }}
            _hover={{ borderColor: "whiteAlpha.400" }}
            _focusVisible={{
              borderColor: "acid.300",
              boxShadow: "0 0 0 1px var(--chakra-colors-acid-300)",
            }}
          />
          <InputRightElement h="56px" pointerEvents="none" color="bg.300">
            <Box
              as={FaChevronDown}
              transform={isOpen ? "rotate(180deg)" : "rotate(0deg)"}
              transition="transform 160ms ease"
            />
          </InputRightElement>
        </InputGroup>
      ) : (
        <Button
          ref={triggerRef as React.RefObject<HTMLButtonElement>}
          type="button"
          role="combobox"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-label={ariaLabel}
          isDisabled={isDisabled}
          w="full"
          h="56px"
          px="4"
          bg="bg.800"
          border="1px solid"
          borderColor="whiteAlpha.200"
          color={displayedOption ? "bg.50" : "bg.300"}
          justifyContent="space-between"
          fontWeight="normal"
          _hover={{ borderColor: "whiteAlpha.400", bg: "bg.800" }}
          _focusVisible={{
            borderColor: "acid.300",
            boxShadow: "0 0 0 1px var(--chakra-colors-acid-300)",
          }}
          onClick={() => {
            if (isOpen) {
              setIsOpen(false);
              setMenuPosition(null);
              return;
            }
            setIsOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => {
              if (!containerRef.current?.contains(document.activeElement)) {
                setIsOpen(false);
                setMenuPosition(null);
              }
            }, 0);
          }}
        >
          <Box display="flex" alignItems="center" gap="3" minW="0">
            {displayedOption?.imageUrl ? (
              <Image
                src={displayedOption.imageUrl}
                alt=""
                boxSize="34px"
                objectFit="contain"
                borderRadius="md"
                bg="whiteAlpha.100"
              />
            ) : displayedOption?.color ? (
              <Box
                aria-hidden="true"
                boxSize="28px"
                borderRadius="md"
                bg={displayedOption.color}
                border="1px solid"
                borderColor="whiteAlpha.300"
              />
            ) : displayedOption?.icon ? (
              <Box
                aria-hidden="true"
                boxSize="34px"
                borderRadius="md"
                bg="whiteAlpha.100"
                color="acid.300"
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontSize="18px"
                flex="0 0 auto"
              >
                {displayedOption.icon}
              </Box>
            ) : null}
            <Text noOfLines={1}>{displayedOption?.name || placeholder}</Text>
          </Box>
          <Box
            as={FaChevronDown}
            flex="0 0 auto"
            color="bg.300"
            transform={isOpen ? "rotate(180deg)" : "rotate(0deg)"}
            transition="transform 160ms ease"
          />
        </Button>
      )}
      {displayedOption?.subtitle && !isOpen ? (
        <Text
          mt="1"
          ml="1"
          fontSize="xs"
          color={displayedOption.subtitleColor || "bg.300"}
        >
          {displayedOption.subtitle}
        </Text>
      ) : null}

      {isOpen ? (
        <>
          <Portal>
            <Box
              id={listboxId}
              role="listbox"
              display={{ base: "none", md: "block" }}
              position="fixed"
              zIndex="popover"
              left={`${menuPosition?.left ?? 0}px`}
              top={`${menuPosition?.top ?? 0}px`}
              w={`${menuPosition?.width ?? 0}px`}
              maxH={`${menuPosition?.maxHeight ?? 0}px`}
              visibility={menuPosition ? "visible" : "hidden"}
              overflow="hidden"
              bg="bg.800"
              border="1px solid"
              borderColor="whiteAlpha.200"
              borderRadius="md"
              boxShadow="xl"
              p="3"
              onMouseDown={(event) => event.preventDefault()}
            >
              {selectorActions}
              {optionList(
                `${Math.max(
                  80,
                  (menuPosition?.maxHeight ?? 0) -
                    (onShowMore || createHref ? 100 : 24),
                )}px`,
              )}
            </Box>
          </Portal>

          <Box
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            display={{ base: "flex", md: "none" }}
            position="fixed"
            inset="0"
            zIndex="modal"
            bg="bg.900"
            flexDirection="column"
            p="4"
            pt="max(1rem, env(safe-area-inset-top))"
            pb="max(1rem, env(safe-area-inset-bottom))"
          >
            <HStack
              justify="space-between"
              pb="4"
              borderBottom="1px solid"
              borderColor="whiteAlpha.200"
            >
              <Text color="bg.50" fontSize="xl" fontWeight="800">
                {ariaLabel}
              </Text>
              <IconButton
                aria-label="Close selector"
                icon={<FaTimes />}
                variant="ghost"
                size="lg"
                onClick={closeAndBlur}
              />
            </HStack>

            {isSearchable ? (
              <Input
                mt="4"
                mb="3"
                size="lg"
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={placeholder}
                bg="bg.800"
                borderColor="whiteAlpha.200"
              />
            ) : null}
            {selectorActions}
            <Box flex="1" minH="0" pt="3">
              {optionList("full")}
            </Box>
          </Box>
        </>
      ) : null}
    </Box>
  );
}
