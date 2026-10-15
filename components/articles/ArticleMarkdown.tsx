import {
  Box,
  Code,
  Heading,
  Image,
  Link as ChakraLink,
  ListItem,
  OrderedList,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  UnorderedList,
} from "@chakra-ui/react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getStrapiBaseUrl } from "../../services/fetchers";

const toMediaUrl = (src?: string) => {
  if (!src) return "";
  if (src.startsWith("/guides/")) return src;
  if (/^(https?:)?\/\//i.test(src) || src.startsWith("data:")) return src;
  return `${getStrapiBaseUrl()}${src.startsWith("/") ? "" : "/"}${src}`;
};

const headingId = (children: unknown) =>
  String(children)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");

type MarkdownComponent = (props: any) => ReactNode;

const nodeContainsTag = (node: any, tagName: string): boolean =>
  Boolean(
    node?.tagName === tagName ||
      node?.children?.some((child: any) => nodeContainsTag(child, tagName)),
  );

const components: Record<string, MarkdownComponent> = {
  h1: ({ children }) => (
    <Heading as="h2" id={headingId(children)} size="xl" mt="12" mb="5" color="bg.50">
      {children}
    </Heading>
  ),
  h2: ({ children }) => (
    <Heading as="h2" id={headingId(children)} size="lg" mt="12" mb="5" color="bg.50">
      {children}
    </Heading>
  ),
  h3: ({ children }) => (
    <Heading as="h3" id={headingId(children)} size="md" mt="9" mb="4" color="acid.300">
      {children}
    </Heading>
  ),
  h4: ({ children }) => (
    <Heading as="h4" size="sm" mt="7" mb="3" color="bg.100">
      {children}
    </Heading>
  ),
  p: ({ children, node }) => {
    const containsMedia = nodeContainsTag(node, "img");

    return (
      <Text
        as={containsMedia ? "div" : "p"}
        fontSize={{ base: "md", md: "lg" }}
        lineHeight={{ base: "1.8", md: "1.9" }}
        color="bg.200"
        my="5"
      >
        {children}
      </Text>
    );
  },
  strong: ({ children }) => (
    <Box as="strong" color="bg.50" fontWeight="800">
      {children}
    </Box>
  ),
  a: ({ href, children }) => {
    if (!href || href.trim().toLowerCase().startsWith("javascript:")) return <>{children}</>;
    const internal = href.startsWith("/");
    return (
      <ChakraLink
        as={internal ? NextLink : "a"}
        href={href}
        color="acid.300"
        fontWeight="700"
        textDecoration="underline !important"
        textUnderlineOffset="3px"
        {...(!internal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </ChakraLink>
    );
  },
  img: ({ src, alt, title }) => {
    const mediaUrl = toMediaUrl(src);
    const isVideo = /\.(mp4|webm|ogg)(?:[?#].*)?$/i.test(mediaUrl);

    return (
      <Box as="figure" my={{ base: "8", md: "10" }}>
        {isVideo ? (
          <Box
            as="video"
            src={mediaUrl}
            aria-label={alt || "Article video"}
            controls
            playsInline
            preload="metadata"
            w="100%"
            maxH="680px"
            bg="black"
            border="1px solid"
            borderColor="whiteAlpha.100"
            borderRadius={{ base: "xl", md: "2xl" }}
            boxShadow="0 24px 70px rgba(0, 0, 0, 0.35)"
          />
        ) : (
          <Image
            src={mediaUrl}
            alt={alt || "Article image"}
            title={title || undefined}
            w="100%"
            maxH="680px"
            objectFit="contain"
            bg="blackAlpha.300"
            border="1px solid"
            borderColor="whiteAlpha.100"
            borderRadius={{ base: "xl", md: "2xl" }}
            boxShadow="0 24px 70px rgba(0, 0, 0, 0.35)"
          />
        )}
        {title || alt ? (
          <Text as="figcaption" color="bg.400" fontSize="sm" textAlign="center" mt="3">
            {title || alt}
          </Text>
        ) : null}
      </Box>
    );
  },
  blockquote: ({ children }) => (
    <Box
      as="blockquote"
      my="8"
      px={{ base: "5", md: "7" }}
      py="4"
      bg="whiteAlpha.50"
      borderLeft="4px solid"
      borderColor="acid.300"
      borderRadius="0 16px 16px 0"
      sx={{ "& > p": { my: 0, color: "bg.100" } }}
    >
      {children}
    </Box>
  ),
  ul: ({ children }) => <UnorderedList spacing="3" my="6" pl="5">{children}</UnorderedList>,
  ol: ({ children }) => <OrderedList spacing="3" my="6" pl="5">{children}</OrderedList>,
  li: ({ children }) => <ListItem color="bg.200" fontSize={{ base: "md", md: "lg" }} lineHeight="1.75">{children}</ListItem>,
  hr: () => <Box as="hr" border="0" borderTop="1px solid" borderColor="whiteAlpha.200" my="12" />,
  pre: ({ children }) => (
    <Box
      as="pre"
      overflowX="auto"
      bg="bg.1000"
      border="1px solid"
      borderColor="whiteAlpha.200"
      borderRadius="xl"
      p="5"
      my="7"
    >
      {children}
    </Box>
  ),
  code: ({ inline, children, ...props }: any) =>
    inline ? (
      <Code colorScheme="green" px="1.5" py="0.5" borderRadius="md" {...props}>{children}</Code>
    ) : (
      <Code display="block" bg="transparent" color="acid.100" whiteSpace="pre" {...props}>{children}</Code>
    ),
  table: ({ children }) => <Table variant="simple">{children}</Table>,
  thead: ({ children }) => <Thead>{children}</Thead>,
  tbody: ({ children }) => <Tbody>{children}</Tbody>,
  tr: ({ children }) => <Tr>{children}</Tr>,
  th: ({ children }) => <Th color="acid.300" borderColor="whiteAlpha.200">{children}</Th>,
  td: ({ children }) => <Td color="bg.200" borderColor="whiteAlpha.100">{children}</Td>,
};

export function ArticleMarkdown({ markdown }: { markdown: string }) {
  if (!markdown.trim()) return null;

  return (
    <Box
      className="article-markdown"
      sx={{
        "& > :first-child": { mt: 0 },
        "& > :last-child": { mb: 0 },
        "& .contains-task-list": { listStyleType: "none", pl: 0 },
        "& .task-list-item input": { mr: 3, accentColor: "#76f85f" },
        "& table": { minW: "560px" },
      }}
    >
      <TableContainer whiteSpace="normal" overflowX="auto">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {markdown}
        </ReactMarkdown>
      </TableContainer>
    </Box>
  );
}
