import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Box,
  Button,
  HStack,
  Icon,
  Text,
} from "@chakra-ui/react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { FiAlertTriangle, FiInfo } from "react-icons/fi";

export type CustomDialogTone = "info" | "warning" | "danger";

export type CustomDialogOptions = {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: CustomDialogTone;
};

type CustomDialogProps = CustomDialogOptions & {
  isOpen: boolean;
  showCancel?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const toneStyles = {
  info: { color: "acid.300", scheme: undefined, icon: FiInfo },
  warning: { color: "orange.300", scheme: "orange", icon: FiAlertTriangle },
  danger: { color: "red.300", scheme: "red", icon: FiAlertTriangle },
} as const;

export function CustomDialog({
  isOpen,
  title,
  message,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  tone = "info",
  showCancel = false,
  onClose,
  onConfirm,
}: CustomDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const style = toneStyles[tone];

  return (
    <AlertDialog
      isOpen={isOpen}
      leastDestructiveRef={showCancel ? cancelRef : confirmRef}
      onClose={onClose}
      isCentered
    >
      <AlertDialogOverlay bg="blackAlpha.700" backdropFilter="blur(6px)">
        <AlertDialogContent
          bg="bg.900"
          border="1px solid"
          borderColor="whiteAlpha.200"
          boxShadow="2xl"
          mx="4"
          overflow="hidden"
        >
          <Box h="3px" bg={style.color} />
          <AlertDialogHeader color="bg.50" fontSize="xl" fontWeight="800">
            <HStack spacing="3">
              <Icon as={style.icon} color={style.color} boxSize="5" />
              <Text>{title}</Text>
            </HStack>
          </AlertDialogHeader>
          <AlertDialogBody pb="2">
            {typeof message === "string" ? (
              <Text color="bg.300" whiteSpace="pre-wrap">
                {message}
              </Text>
            ) : (
              message
            )}
          </AlertDialogBody>
          <AlertDialogFooter>
            <HStack spacing="3">
              {showCancel ? (
                <Button ref={cancelRef} onClick={onClose}>
                  {cancelLabel}
                </Button>
              ) : null}
              <Button
                ref={confirmRef}
                colorScheme={style.scheme}
                variant={tone === "info" ? "primary" : undefined}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </HStack>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
}

type DialogRequest = CustomDialogOptions & {
  id: number;
  kind: "alert" | "confirm";
  resolve: (result: boolean) => void;
};

type CustomDialogContextValue = {
  showAlert: (options: CustomDialogOptions) => Promise<void>;
  showConfirm: (options: CustomDialogOptions) => Promise<boolean>;
};

const CustomDialogContext = createContext<CustomDialogContextValue | null>(
  null,
);

export function CustomDialogProvider({ children }: { children: ReactNode }) {
  const nextId = useRef(0);
  const [requests, setRequests] = useState<DialogRequest[]>([]);
  const activeRequest = requests[0];

  const enqueue = useCallback(
    (kind: DialogRequest["kind"], options: CustomDialogOptions) =>
      new Promise<boolean>((resolve) => {
        nextId.current += 1;
        setRequests((current) => [
          ...current,
          { ...options, id: nextId.current, kind, resolve },
        ]);
      }),
    [],
  );

  const showAlert = useCallback(
    async (options: CustomDialogOptions) => {
      await enqueue("alert", options);
    },
    [enqueue],
  );

  const showConfirm = useCallback(
    (options: CustomDialogOptions) => enqueue("confirm", options),
    [enqueue],
  );

  const settle = useCallback(
    (result: boolean) => {
      if (!activeRequest) return;
      activeRequest.resolve(result);
      setRequests((current) =>
        current.filter((request) => request.id !== activeRequest.id),
      );
    },
    [activeRequest],
  );

  const value = useMemo(
    () => ({ showAlert, showConfirm }),
    [showAlert, showConfirm],
  );

  return (
    <CustomDialogContext.Provider value={value}>
      {children}
      {activeRequest ? (
        <CustomDialog
          {...activeRequest}
          isOpen
          showCancel={activeRequest.kind === "confirm"}
          onClose={() => settle(false)}
          onConfirm={() => settle(true)}
        />
      ) : null}
    </CustomDialogContext.Provider>
  );
}

export function useCustomDialog() {
  const context = useContext(CustomDialogContext);
  if (!context) {
    throw new Error("useCustomDialog must be used inside CustomDialogProvider.");
  }
  return context;
}
