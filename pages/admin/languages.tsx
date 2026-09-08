import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Image,
  Input,
  NumberInput,
  NumberInputField,
  SimpleGrid,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import type { GetServerSideProps } from "next";
import { useEffect, useState } from "react";
import { AdminShell } from "../../components/admin";
import { requireAdminSession } from "../../lib/admin/auth";
import { getSmallestMediaUrl } from "../../lib/portal/media";
import Loader from "../../components/shared/Loader";

const empty = {
  id: "",
  code: "",
  name: "",
  nativeName: "",
  isDefault: false,
  isActive: true,
  sortOrder: "",
  flag: null as File | null,
  existingFlag: null as any,
};

const encode = (file: File) =>
  new Promise<{ name: string; type: string; data: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Flag could not be read."));
    reader.onload = () =>
      resolve({
        name: file.name,
        type: file.type,
        data: String(reader.result || "").split(",")[1] || "",
      });
    reader.readAsDataURL(file);
  });

export default function AdminLanguagesPage() {
  const toast = useToast();
  const [languages, setLanguages] = useState<any[]>([]);
  const [form, setForm] = useState(empty);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setIsLoading(true);
    const response = await fetch("/api/admin/languages");
    const payload = await response.json().catch(() => null);
    setIsLoading(false);
    if (!response.ok) {
      setError("Languages could not be loaded.");
      return;
    }
    setLanguages(payload.languages || []);
  };
  useEffect(() => {
    void load();
  }, []);

  const choose = (language: any) =>
    setForm({
      id: String(language.id),
      code: language.code || "",
      name: language.name || "",
      nativeName: language.native_name || "",
      isDefault: language.isDefault === true,
      isActive: language.isActive !== false,
      sortOrder:
        language.sort_order === null || language.sort_order === undefined
          ? ""
          : String(language.sort_order),
      flag: null,
      existingFlag: language.flag || null,
    });

  const save = async () => {
    setIsSaving(true);
    setError("");
    const body: any = {
      ...form,
      sortOrder: form.sortOrder === "" ? null : Number(form.sortOrder),
    };
    if (form.flag) body.flag = await encode(form.flag);
    else delete body.flag;
    delete body.existingFlag;
    const response = await fetch(
      form.id ? `/api/admin/languages/${form.id}` : "/api/admin/languages",
      {
        method: form.id ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const payload = await response.json().catch(() => null);
    setIsSaving(false);
    if (!response.ok) {
      const message = payload?.message || "Language could not be saved.";
      setError(message);
      toast({ title: "Save failed", description: message, status: "error" });
      return;
    }
    toast({ title: "Language saved", status: "success" });
    setForm(empty);
    await load();
  };

  const remove = async () => {
    if (!form.id || !window.confirm(`Delete language "${form.name}"?`)) return;
    const response = await fetch(`/api/admin/languages/${form.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast({ title: "Delete failed", status: "error" });
      return;
    }
    toast({ title: "Language deleted", status: "success" });
    setForm(empty);
    await load();
  };

  return (
    <AdminShell title="Languages">
      {isLoading ? <Loader size="lg" mb="5" /> : null}
      {error ? <Alert status="error" mb="5"><AlertIcon />{error}</Alert> : null}
      <SimpleGrid columns={{ base: 1, lg: 3 }} spacing="6">
        <VStack align="stretch" bg="bg.900" p="5" borderRadius="2xl">
          <Button variant="primary" onClick={() => setForm(empty)}>New language</Button>
          {languages.map((language) => (
            <Button key={language.id} variant={form.id === String(language.id) ? "primary" : "contrast"} onClick={() => choose(language)}>
              {language.name} ({language.code})
            </Button>
          ))}
        </VStack>
        <Box bg="bg.900" p="6" borderRadius="2xl" gridColumn={{ lg: "span 2" }}>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing="4">
            <FormControl isRequired><FormLabel>Code</FormLabel><Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></FormControl>
            <FormControl isRequired>
              <FormLabel>Name / CSV column header</FormLabel>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              <FormHelperText>Keep this exactly equal to the ShakerView Localization CSV header, for example English, Russian, or Français.</FormHelperText>
            </FormControl>
            <FormControl><FormLabel>Native name</FormLabel><Input value={form.nativeName} onChange={(event) => setForm({ ...form, nativeName: event.target.value })} /></FormControl>
            <FormControl><FormLabel>Sort order</FormLabel><NumberInput value={form.sortOrder}><NumberInputField onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} /></NumberInput></FormControl>
            <FormControl>
              <FormLabel>Flag image</FormLabel>
              <Input type="file" accept="image/png,image/jpeg,image/webp" p="1" onChange={(event) => setForm({ ...form, flag: event.target.files?.[0] || null })} />
              <FormHelperText>PNG, JPEG, or WebP; maximum 5 MB.</FormHelperText>
            </FormControl>
            {form.existingFlag ? <Image src={getSmallestMediaUrl(form.existingFlag)} alt={`${form.name} flag`} maxH="80px" objectFit="contain" /> : null}
          </SimpleGrid>
          <HStack mt="5">
            <Checkbox isChecked={form.isDefault} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })}>Default</Checkbox>
            <Checkbox isChecked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })}>Active</Checkbox>
          </HStack>
          <HStack mt="6">
            <Button variant="primary" onClick={save} isLoading={isSaving} isDisabled={!form.code.trim() || !form.name.trim()}>Save language</Button>
            {form.id ? <Button colorScheme="red" variant="outline" onClick={remove} isDisabled title="Support cannot delete records">Delete</Button> : null}
          </HStack>
        </Box>
      </SimpleGrid>
    </AdminShell>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const redirect = await requireAdminSession(context);
  return redirect || { props: {} };
};
