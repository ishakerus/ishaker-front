import {
  Alert,
  AlertIcon,
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Text,
  Textarea,
  VStack,
  type ButtonProps,
} from "@chakra-ui/react";
import { FormEvent, useState } from "react";
import { FiMessageCircle } from "react-icons/fi";

type TicketStatus = "suggestion" | "question" | "bug";

type TicketButtonProps = Omit<
  ButtonProps,
  "children" | "onClick" | "title"
> & {
  title: string;
  hasKnownClient?: boolean;
};

export function TicketButton({
  title,
  hasKnownClient = false,
  ...buttonProps
}: TicketButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [requiresEmail, setRequiresEmail] = useState(!hasKnownClient);
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TicketStatus>("suggestion");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const openDialog = () => {
    setIsOpen(true);
    setRequiresEmail(!hasKnownClient);
    setSubmitted(false);
    setError("");
  };

  const closeDialog = () => {
    if (!isSubmitting) setIsOpen(false);
  };

  const submit = async (event: FormEvent<HTMLDivElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          email,
          status,
          useClient: hasKnownClient,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        if (payload?.error === "email_required") setRequiresEmail(true);
        throw new Error(
          payload?.message || "Your message could not be sent. Please try again.",
        );
      }

      setSubmitted(true);
      setDescription("");
      setEmail("");
      setStatus("suggestion");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Your message could not be sent. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button
        variant="contrast"
        rightIcon={<FiMessageCircle />}
        onClick={openDialog}
        {...buttonProps}
      >
        {title}
      </Button>

      <Modal isOpen={isOpen} onClose={closeDialog} isCentered size="lg">
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(4px)" />
        <ModalContent
          as="form"
          onSubmit={submit}
          bg="bg.900"
          color="bg.50"
        >
          <ModalHeader pr="12">{title}</ModalHeader>
          <ModalCloseButton isDisabled={isSubmitting} />
          <ModalBody>
            {submitted ? (
              <Alert
                status="success"
                borderRadius="xl"
                alignItems="flex-start"
              >
                <AlertIcon mt="0.5" />
                <Box>
                  <Text fontWeight="800">Thank you for your message.</Text>
                  <Text mt="1">
                    We’ll read it and use your feedback to make the interface
                    easier to use.
                  </Text>
                </Box>
              </Alert>
            ) : (
              <VStack spacing="5" align="stretch">
                <Text color="bg.300" lineHeight="1.7">
                  We read every message. With your help, we’ll keep improving
                  the interface to make iShaker easier to use.
                </Text>

                <FormControl isRequired>
                  <FormLabel>What is this about?</FormLabel>
                  <Select
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as TicketStatus)
                    }
                    bg="bg.800"
                    borderColor="whiteAlpha.200"
                  >
                    <option value="suggestion">Suggestion</option>
                    <option value="question">Question</option>
                    <option value="bug">Something isn’t working</option>
                  </Select>
                </FormControl>

                {requiresEmail ? (
                  <FormControl isRequired>
                    <FormLabel>Email</FormLabel>
                    <Input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      maxLength={254}
                      bg="bg.800"
                      borderColor="whiteAlpha.200"
                    />
                  </FormControl>
                ) : null}

                <FormControl isRequired>
                  <FormLabel>Message</FormLabel>
                  <Textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Tell us what you need or what we could improve…"
                    minH="150px"
                    maxLength={5000}
                    bg="bg.800"
                    borderColor="whiteAlpha.200"
                  />
                  <Text
                    mt="1.5"
                    color="bg.400"
                    fontSize="xs"
                    textAlign="right"
                  >
                    {description.length}/5000
                  </Text>
                </FormControl>

                {error ? (
                  <Alert status="error" borderRadius="xl">
                    <AlertIcon />
                    {error}
                  </Alert>
                ) : null}
              </VStack>
            )}
          </ModalBody>

          <ModalFooter gap="3">
            <Button variant="ghost" onClick={closeDialog}>
              {submitted ? "Close" : "Cancel"}
            </Button>
            {!submitted ? (
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                loadingText="Sending"
                isDisabled={
                  !description.trim() ||
                  (requiresEmail && !email.trim())
                }
              >
                Send message
              </Button>
            ) : null}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
