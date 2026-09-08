import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  Link,
  Select,
  SimpleGrid,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import type { GetServerSideProps } from "next";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "../../components/admin";
import { requireAdminSession } from "../../lib/admin/auth";
import { getMediaUrl } from "../../lib/portal/media";
import Loader from "../../components/shared/Loader";

const categories = ["event", "screen", "cup", "payment", "button"];
const statuses = ["draft", "reviewed", "approved"];
const emptyForm = {
  id: "",
  languageId: "",
  category: "event",
  key: "",
  cupId: "",
  status: "draft",
  audio: null as File | null,
  existingAudio: null as any,
};

export default function AdminVoiceClipsPage() {
  const toast = useToast();
  const [clips, setClips] = useState<any[]>([]);
  const [languages, setLanguages] = useState<any[]>([]);
  const [cups, setCups] = useState<any[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState({
    languageId: "",
    category: "",
    key: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setIsLoading(true);
    setError("");
    const response = await fetch("/api/admin/voice-clips");
    const payload = await response.json().catch(() => null);
    setIsLoading(false);
    if (!response.ok) {
      setError(payload?.message || "Voice clips could not be loaded.");
      return;
    }
    setClips(payload.voiceClips || []);
    setLanguages(payload.languages || []);
    setCups(payload.cups || []);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(
    () =>
      clips.filter((clip) => {
        const token =
          clip.category === "cup" ? clip.cup?.name || "" : clip.key || "";
        return (
          (!filters.languageId ||
            String(clip.language?.id) === filters.languageId) &&
          (!filters.category || clip.category === filters.category) &&
          (!filters.key ||
            token.toLowerCase().includes(filters.key.toLowerCase()))
        );
      }),
    [clips, filters],
  );

  const selectedLanguage = languages.find(
    (language) => String(language.id) === form.languageId,
  );
  const selectedCup = cups.find((cup) => String(cup.id) === form.cupId);
  const code = String(selectedLanguage?.code || "").toUpperCase();
  const token = form.category === "cup" ? selectedCup?.name || "" : form.key;
  const derivedPath =
    code && token ? `Media/Audio/${code}/${token}${code}.wav` : "—";

  const choose = (clip: any) =>
    setForm({
      id: String(clip.id),
      languageId: String(clip.language?.id || ""),
      category: clip.category || "event",
      key: clip.key || "",
      cupId: String(clip.cup?.id || ""),
      status: clip.status || "draft",
      audio: null,
      existingAudio: clip.audio || null,
    });

  const save = async () => {
    setIsSaving(true);
    setError("");
    const body = new FormData();
    if (form.id) body.append("id", form.id);
    body.append("languageId", form.languageId);
    body.append("category", form.category);
    body.append("key", form.key.trim());
    body.append("cupId", form.cupId);
    body.append("status", form.status);
    if (form.audio) body.append("audio", form.audio);
    const response = await fetch("/api/admin/voice-clips", {
      method: "POST",
      body,
    });
    const payload = await response.json().catch(() => null);
    setIsSaving(false);
    if (!response.ok) {
      const message = payload?.message || "Voice clip could not be saved.";
      setError(message);
      toast({ title: "Save failed", description: message, status: "error" });
      return;
    }
    toast({ title: "Voice clip saved", status: "success" });
    setForm(emptyForm);
    await load();
  };

  const remove = async () => {
    if (!form.id || !window.confirm(`Delete voice clip at ${derivedPath}?`)) {
      return;
    }
    const response = await fetch(`/api/admin/voice-clips/${form.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast({ title: "Delete failed", status: "error" });
      return;
    }
    toast({ title: "Voice clip deleted", status: "success" });
    setForm(emptyForm);
    await load();
  };

  const valid =
    form.languageId &&
    (form.category === "cup" ? form.cupId : form.key.trim()) &&
    (form.id || form.audio);

  return (
    <AdminShell title="Voice clips">
      {isLoading ? <Loader size="lg" mb="5" /> : null}
      {error ? (
        <Alert status="error" mb="5">
          <AlertIcon />
          {error}
        </Alert>
      ) : null}
      <SimpleGrid columns={{ base: 1, xl: 3 }} spacing="6">
        <VStack align="stretch" bg="bg.900" p="5" borderRadius="2xl">
          <Button variant="primary" onClick={() => setForm(emptyForm)}>
            New voice clip
          </Button>
          <SimpleGrid columns={2} spacing="2">
            <Select
              placeholder="All languages"
              value={filters.languageId}
              onChange={(event) =>
                setFilters({ ...filters, languageId: event.target.value })
              }
            >
              {languages.map((language) => (
                <option key={language.id} value={language.id}>
                  {language.name}
                </option>
              ))}
            </Select>
            <Select
              placeholder="All categories"
              value={filters.category}
              onChange={(event) =>
                setFilters({ ...filters, category: event.target.value })
              }
            >
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </Select>
          </SimpleGrid>
          <Input
            placeholder="Filter by key or cup"
            value={filters.key}
            onChange={(event) =>
              setFilters({ ...filters, key: event.target.value })
            }
          />
          {filtered.map((clip) => (
            <Button
              key={clip.id}
              variant={form.id === String(clip.id) ? "primary" : "contrast"}
              height="auto"
              py="3"
              justifyContent="space-between"
              onClick={() => choose(clip)}
            >
              <Text noOfLines={1}>
                {clip.language?.code} · {clip.category} ·{" "}
                {clip.category === "cup" ? clip.cup?.name : clip.key}
              </Text>
              <Badge ml="2">{clip.status}</Badge>
            </Button>
          ))}
          <Button
            as={Link}
            href="/api/admin/voice-clips/export"
            variant="outline"
          >
            Download approved manifest
          </Button>
        </VStack>

        <Box
          bg="bg.900"
          p="6"
          borderRadius="2xl"
          gridColumn={{ xl: "span 2" }}
        >
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing="4">
            <FormControl isRequired>
              <FormLabel>Language</FormLabel>
              <Select
                placeholder="Select language"
                value={form.languageId}
                onChange={(event) =>
                  setForm({ ...form, languageId: event.target.value })
                }
              >
                {languages.map((language) => (
                  <option key={language.id} value={language.id}>
                    {language.name} ({language.code})
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Category</FormLabel>
              <Select
                value={form.category}
                onChange={(event) =>
                  setForm({
                    ...form,
                    category: event.target.value,
                    key: "",
                    cupId: "",
                  })
                }
              >
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </Select>
            </FormControl>
            {form.category === "cup" ? (
              <FormControl isRequired>
                <FormLabel>Cup</FormLabel>
                <Select
                  placeholder="Select cup"
                  value={form.cupId}
                  onChange={(event) =>
                    setForm({ ...form, cupId: event.target.value })
                  }
                >
                  {cups.map((cup) => (
                    <option key={cup.id} value={cup.id}>
                      {cup.name}
                    </option>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <FormControl isRequired>
                <FormLabel>Key</FormLabel>
                <Input
                  value={form.key}
                  onChange={(event) =>
                    setForm({ ...form, key: event.target.value })
                  }
                />
                <FormHelperText>
                  A key cannot contain a slash or backslash.
                </FormHelperText>
              </FormControl>
            )}
            <FormControl isRequired>
              <FormLabel>Status</FormLabel>
              <Select
                value={form.status}
                onChange={(event) =>
                  setForm({ ...form, status: event.target.value })
                }
              >
                {statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </Select>
            </FormControl>
            <FormControl isRequired={!form.id}>
              <FormLabel>{form.id ? "Replace WAV" : "WAV file"}</FormLabel>
              <Input
                type="file"
                accept=".wav,audio/wav,audio/x-wav"
                p="1"
                onChange={(event) =>
                  setForm({ ...form, audio: event.target.files?.[0] || null })
                }
              />
              <FormHelperText>
                16-bit PCM, mono, 44.1 kHz; maximum 20 MB.
              </FormHelperText>
            </FormControl>
          </SimpleGrid>

          <Box mt="5" p="4" borderWidth="1px" borderRadius="lg">
            <Text fontSize="sm" color="bg.400">
              On-machine path
            </Text>
            <Text fontFamily="mono">{derivedPath}</Text>
            {form.existingAudio?.url ? (
              <Link
                href={getMediaUrl(form.existingAudio)}
                isExternal
                color="accent.500"
              >
                Open current WAV
              </Link>
            ) : null}
          </Box>

          <HStack mt="6">
            <Button
              variant="primary"
              onClick={save}
              isLoading={isSaving}
              isDisabled={!valid || /[\\/]/.test(form.key)}
            >
              Save voice clip
            </Button>
            {form.id ? (
              <Button colorScheme="red" variant="outline" onClick={remove} isDisabled title="Support cannot delete records">
                Delete
              </Button>
            ) : null}
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
