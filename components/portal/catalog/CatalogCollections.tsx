import { Alert, AlertIcon, AspectRatio, Box, Button, Heading, Image, SimpleGrid, Text, VStack } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useState } from "react";
import { canManageCatalogAsset } from "../../../lib/portal/catalogAssets";
import { getSmallestMediaUrl } from "../../../lib/portal/media";
import type { PortalBrand, PortalTaste } from "../../../types/portal";

type Props = { tastes: PortalTaste[]; brands: PortalBrand[]; clientId: string | number };
export function CatalogCollections({ tastes, brands, clientId }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState("");
  const [message, setMessage] = useState("");
  const remove = async (collection: "tastes" | "brands", id: string | number) => {
    setDeleting(`${collection}/${id}`);
    setMessage("");
    try {
      const response = await fetch(`/api/portal/${collection}/${id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || "Deletion failed.");
      await router.replace(router.asPath, undefined, { scroll: false });
    } catch (error) { setMessage(error instanceof Error ? error.message : "Deletion failed."); }
    finally { setDeleting(""); }
  };
  const sections = [
    { title: "Your tastes", collection: "tastes" as const, items: tastes.filter((item) => canManageCatalogAsset(item.author, clientId)), owned: true },
    { title: "Your brands", collection: "brands" as const, items: brands.filter((item) => canManageCatalogAsset(item.author, clientId)), owned: true },
    { title: "Shared tastes", collection: "tastes" as const, items: tastes.filter((item) => !canManageCatalogAsset(item.author, clientId)), owned: false },
    { title: "Shared brands", collection: "brands" as const, items: brands.filter((item) => !canManageCatalogAsset(item.author, clientId)), owned: false },
  ];
  return (
    <VStack align="stretch" spacing="7" mb="10">
      {message ? <Alert status="error" borderRadius="xl"><AlertIcon />{message}</Alert> : null}
      {sections.map(({ title, collection, items, owned }) => (
        <Box key={title}>
          <Heading as="h2" size="md" mb="4" color="bg.50">{title}</Heading>
          {!owned ? <Text color="bg.300" mb="4">Shared and root items are read-only.</Text> : null}
          {!items.length ? <Text color="bg.300">{owned ? `You have not added any ${collection} yet.` : `No shared ${collection} available.`}</Text> : null}
          <SimpleGrid columns={{ base: 2, sm: 3, lg: 6 }} spacing="4">
            {items.map((item) => {
              const media = "main" in item ? item.main : (item as PortalBrand).logo;
              return (
                <Box key={item.id} bg="bg.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="2xl" overflow="hidden">
                  <AspectRatio ratio={1} bg="bg.800">
                    <Image loading="lazy" decoding="async" src={getSmallestMediaUrl(media) || undefined} alt={item.name} objectFit="contain" p="3" />
                  </AspectRatio>
                  <VStack p="4" spacing="2" align="stretch">
                    <Text color="bg.50" fontWeight="800">{item.name}</Text>
                    {owned ? <Button type="button" size="sm" colorScheme="red" variant="outline" aria-label={`Delete ${item.name}`} isLoading={deleting === `${collection}/${item.id}`} isDisabled={Boolean(deleting)} onClick={() => remove(collection, item.id)}>Delete</Button> : null}
                  </VStack>
                </Box>
              );
            })}
          </SimpleGrid>
        </Box>
      ))}
    </VStack>
  );
}
