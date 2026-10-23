import { EnglishFileInput } from "../../shared/EnglishFileInput";
import { Alert, AlertIcon, Box, Button, FormControl, FormHelperText, FormLabel, Image, Input, Link, Text, VStack } from "@chakra-ui/react";
import NextLink from "next/link";
import { useRouter } from "next/router";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { validateCatalogFile } from "../../../lib/portal/catalogAssets";

export function BrandCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selection = useRef(0);
  useEffect(() => {
    if (!logo) { setPreview(""); return; }
    const url = URL.createObjectURL(logo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logo]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!logo || name.trim().length < 2) return;
    const form = event.currentTarget;
    setIsSubmitting(true);
    setMessage("");
    try {
      await validateCatalogFile(logo, "brand", "Brand logo");
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Could not read the brand logo."));
        reader.readAsDataURL(logo);
      });
      const response = await fetch("/api/portal/brands", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, logo: { name: logo.name, type: logo.type, data } }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || "Brand creation failed.");
      setName("");
      setLogo(null);
      form.reset();
      setIsError(false);
      setMessage("Brand created. You can find it under Your brands.");
      await router.replace(router.asPath, undefined, { scroll: false }).catch(() => undefined);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Brand creation failed.");
    } finally { setIsSubmitting(false); }
  };
  return (
    <Box as="form" onSubmit={submit} bg="bg.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="2xl" p={{ base: "5", md: "7" }} maxW="1200px" my="6">
      <VStack spacing="5" align="stretch">
        <Box>
          <Text color="bg.50" fontSize="2xl" fontWeight="800">Add a custom brand</Text>
          <Link as={NextLink} href="/articles/create-brand" color="acid.300">How to create a brand</Link>
        </Box>
        <FormControl isRequired isDisabled={isSubmitting}>
          <FormLabel>Brand name</FormLabel>
          <Input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} bg="bg.800" />
        </FormControl>
        <FormControl isRequired isDisabled={isSubmitting}>
          <FormLabel>Brand logo</FormLabel>
          <EnglishFileInput selectedFiles={logo ? [logo] : []} accept=".png,image/png" onChange={async (event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            const version = ++selection.current;
            setLogo(null);
            setMessage("");
            if (!file) return;
            try {
              await validateCatalogFile(file, "brand", "Brand logo");
              if (version === selection.current) setLogo(file);
            } catch (error) {
              if (version !== selection.current) return;
              input.value = "";
              setIsError(true);
              setMessage(error instanceof Error ? error.message : "Invalid logo.");
            }
          }} />
          <FormHelperText>PNG only, exactly 500 × 330 px, maximum 5 MB. Use a transparent background.</FormHelperText>
        </FormControl>
        {preview ? <Image src={preview} alt="New brand logo preview" maxW="250px" aspectRatio={500 / 330} objectFit="contain" bg="bg.800" borderRadius="xl" p="3" /> : null}
        {message ? <Alert status={isError ? "error" : "success"} borderRadius="xl"><AlertIcon />{message}</Alert> : null}
        <Button type="submit" variant="primary" alignSelf="flex-start" isLoading={isSubmitting} isDisabled={!logo || name.trim().length < 2}>Create brand</Button>
      </VStack>
    </Box>
  );
}
