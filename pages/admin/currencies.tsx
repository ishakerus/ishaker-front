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
  Input,
  NumberInput,
  NumberInputField,
  Select,
  SimpleGrid,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import type { GetServerSideProps } from "next";
import { useEffect, useState } from "react";
import { AdminShell } from "../../components/admin";
import { requireAdminSession } from "../../lib/admin/auth";
import { formatMoney } from "../../lib/portal/currency";
import type { Currency } from "../../types/strapi";
import Loader from "../../components/shared/Loader";

const emptyForm = {
  id: "",
  code: "",
  name: "",
  symbol: "",
  symbolPosition: "before",
  decimalDigits: "2",
  rounding: "0",
  thousandsSeparator: ",",
  decimalSeparator: ".",
  isActive: true,
};

export default function AdminCurrenciesPage() {
  const toast = useToast();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setIsLoading(true);
    setError("");
    const response = await fetch("/api/admin/currencies", {
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    setIsLoading(false);
    if (!response.ok) {
      setError("Currencies could not be loaded.");
      return;
    }
    setCurrencies(payload.currencies || []);
  };

  useEffect(() => {
    void load();
  }, []);

  const choose = (currency: Currency) =>
    setForm({
      id: String(currency.id),
      code: currency.code || "",
      name: currency.name || "",
      symbol: currency.symbol || "",
      symbolPosition: currency.symbol_position || "before",
      decimalDigits: String(currency.decimal_digits ?? 2),
      rounding: String(currency.rounding ?? 0),
      thousandsSeparator: currency.thousands_separator ?? ",",
      decimalSeparator: currency.decimal_separator ?? ".",
      isActive: currency.isActive !== false,
    });

  const save = async () => {
    setIsSaving(true);
    setError("");
    const response = await fetch(
      form.id ? `/api/admin/currencies/${form.id}` : "/api/admin/currencies",
      {
        method: form.id ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      },
    );
    const payload = await response.json().catch(() => null);
    setIsSaving(false);
    if (!response.ok) {
      const message = payload?.message || "Currency could not be saved.";
      setError(message);
      toast({ title: "Save failed", description: message, status: "error" });
      return;
    }
    toast({ title: "Currency saved", status: "success" });
    setForm(emptyForm);
    await load();
  };

  const remove = async () => {
    if (!form.id || !window.confirm(`Delete currency "${form.code}"?`)) return;
    const response = await fetch(`/api/admin/currencies/${form.id}`, {
      method: "DELETE",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      toast({
        title: "Delete failed",
        description:
          payload?.message || "The currency may still be assigned to records.",
        status: "error",
      });
      return;
    }
    toast({ title: "Currency deleted", status: "success" });
    setForm(emptyForm);
    await load();
  };

  const preview: Currency = {
    id: form.id || 0,
    code: form.code || "USD",
    name: form.name,
    symbol: form.symbol,
    symbol_position: form.symbolPosition as "before" | "after",
    decimal_digits: Number(form.decimalDigits),
    rounding: form.rounding,
    thousands_separator: form.thousandsSeparator,
    decimal_separator: form.decimalSeparator,
  };

  return (
    <AdminShell title="Currencies">
      {isLoading ? <Loader size="lg" mb="5" /> : null}
      {error ? (
        <Alert status="error" mb="5">
          <AlertIcon />
          {error}
        </Alert>
      ) : null}
      <SimpleGrid columns={{ base: 1, lg: 3 }} spacing="6">
        <VStack align="stretch" bg="bg.900" p="5" borderRadius="2xl">
          <Button variant="primary" onClick={() => setForm(emptyForm)}>
            New currency
          </Button>
          {currencies.map((currency) => (
            <Button
              key={currency.id}
              variant={
                form.id === String(currency.id) ? "primary" : "contrast"
              }
              justifyContent="space-between"
              onClick={() => choose(currency)}
            >
              {currency.code}
              <Text as="span">{currency.symbol}</Text>
            </Button>
          ))}
        </VStack>
        <Box bg="bg.900" p="6" borderRadius="2xl" gridColumn={{ lg: "span 2" }}>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing="4">
            <FormControl isRequired>
              <FormLabel>ISO code</FormLabel>
              <Input
                maxLength={3}
                value={form.code}
                onChange={(event) =>
                  setForm({ ...form, code: event.target.value.toUpperCase() })
                }
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Name</FormLabel>
              <Input
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Symbol</FormLabel>
              <Input
                value={form.symbol}
                onChange={(event) =>
                  setForm({ ...form, symbol: event.target.value })
                }
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Symbol position</FormLabel>
              <Select
                value={form.symbolPosition}
                onChange={(event) =>
                  setForm({ ...form, symbolPosition: event.target.value })
                }
              >
                <option value="before">Before amount</option>
                <option value="after">After amount</option>
              </Select>
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Decimal digits</FormLabel>
              <NumberInput min={0} max={6} precision={0} value={form.decimalDigits}>
                <NumberInputField
                  onChange={(event) =>
                    setForm({ ...form, decimalDigits: event.target.value })
                  }
                />
              </NumberInput>
            </FormControl>
            <FormControl>
              <FormLabel>Rounding increment</FormLabel>
              <NumberInput min={0} value={form.rounding}>
                <NumberInputField
                  onChange={(event) =>
                    setForm({ ...form, rounding: event.target.value })
                  }
                />
              </NumberInput>
            </FormControl>
            <FormControl>
              <FormLabel>Thousands separator</FormLabel>
              <Input
                maxLength={4}
                value={form.thousandsSeparator}
                onChange={(event) =>
                  setForm({ ...form, thousandsSeparator: event.target.value })
                }
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Decimal separator</FormLabel>
              <Input
                maxLength={4}
                value={form.decimalSeparator}
                onChange={(event) =>
                  setForm({ ...form, decimalSeparator: event.target.value })
                }
              />
            </FormControl>
          </SimpleGrid>
          <FormControl mt="4">
            <Checkbox
              isChecked={form.isActive}
              onChange={(event) =>
                setForm({ ...form, isActive: event.target.checked })
              }
            >
              Active
            </Checkbox>
            <FormHelperText>
              Inactive currencies are hidden from client machine settings.
            </FormHelperText>
          </FormControl>
          <Box bg="bg.800" borderRadius="lg" p="4" mt="5">
            <Text color="bg.300" fontSize="sm">
              Preview
            </Text>
            <Text color="bg.50" fontWeight="800" fontSize="2xl">
              {formatMoney(1234567.89, preview)}
            </Text>
          </Box>
          <HStack mt="6">
            <Button
              variant="primary"
              onClick={save}
              isLoading={isSaving}
              isDisabled={!form.code || !form.name || !form.symbol}
            >
              Save currency
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
