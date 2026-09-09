import {
  Box,
  ListItem,
  OrderedList,
  Text,
  UnorderedList,
} from "@chakra-ui/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function PatchDescription({
  description,
}: {
  description?: string | null;
}) {
  if (!description?.trim()) {
    return <Text color="bg.500">No description provided.</Text>;
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <Text color="bg.200" lineHeight="1.7" mb="3" _last={{ mb: 0 }}>
            {children}
          </Text>
        ),
        strong: ({ children }) => (
          <Box as="strong" color="bg.50" fontWeight="800">
            {children}
          </Box>
        ),
        ul: ({ children }) => (
          <UnorderedList color="bg.200" spacing="2" pl="4" mb="3">
            {children}
          </UnorderedList>
        ),
        ol: ({ children }) => (
          <OrderedList color="bg.200" spacing="2" pl="4" mb="3">
            {children}
          </OrderedList>
        ),
        li: ({ children }) => <ListItem>{children}</ListItem>,
      }}
    >
      {description}
    </ReactMarkdown>
  );
}
