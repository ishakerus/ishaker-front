import { withSupportPortalApi } from "../../../lib/admin/access";
import type { NextApiRequest, NextApiResponse } from "next";
import {
  fetchMachineBySerialAsService,
  getPortalSessionFromApiRequest,
  setPortalSession,
} from "../../../lib/portal/auth";
import {
  isValidNickname,
  normalizeNickname,
} from "../../../lib/portal/nickname";
import { getStrapiBaseUrl } from "../../../services/fetchers";
import {
  registerPortalUserAsService,
  requestStrapiRestAsService,
} from "../../../services/server/strapiClient";
import {
  changeTelemetryMachineOrganization,
  createTelemetryOrganization,
  findTelemetryMachineBySerial,
  getMissingTelemetryEnvKeys,
  getTelemetryUserUuid,
  isTelemetryConfigured,
  provisionTelemetryMachineSetup,
  resolveTelemetryOrganizationId,
} from "../../../services/server/telemetryClient";
import type { Client, Currency, Machine } from "../../../types/strapi";
import { updateMachineRegistrationData } from "../../../services/server/machineRegistration";
import {
  getMachineSerialBase,
  MachineSerialIssueError,
} from "../../../lib/portal/machineSerial";
import { WHATSAPP_SUPPORT_URL } from "../../../lib/portal/support";
import {
  getIsoCodeFromVirtualId,
  getIsoCurrency,
} from "../../../lib/portal/isoCurrencies";

const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const WHATSAPP_COUNTRY_CODE_REGEX = /^\+[1-9]\d{0,3}$/;
const WHATSAPP_LOCAL_NUMBER_REGEX = /^[0-9 ]{6,20}$/;
const getErrorPayload = (error: unknown) => {
  const apiError = error as {
    status?: number;
    response?: {
      error?: {
        message?: string;
        details?: unknown;
        name?: string;
      };
    };
    message?: string;
  };

  return {
    status: apiError.status || 500,
    message:
      apiError.response?.error?.message ||
      apiError.response?.error?.name ||
      apiError.message ||
      "Registration submission failed.",
    details: apiError.response?.error?.details || null,
  };
};

const getTelemetryErrorPayload = (error: unknown) => {
  const apiError = error as {
    status?: number;
    response?: unknown;
    message?: string;
  };

  return {
    status: apiError.status && apiError.status >= 400 ? apiError.status : 502,
    message: apiError.message || "Telemetry sync failed.",
    details: apiError.response || null,
  };
};

const getId = (value: unknown) => {
  const id = (value as { id?: string | number } | null)?.id;
  return id === undefined || id === null ? null : id;
};

const getTelemetryId = (value: unknown): number | null => {
  const id = getId(value);
  if (typeof id === "number") return id;
  if (typeof id === "string" && /^\d+$/.test(id)) return Number(id);

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const nestedId =
      getTelemetryId(record.machine) ||
      getTelemetryId(record.organization) ||
      getTelemetryId(record.data);
    if (nestedId) return nestedId;

    const explicitId = record.machineId || record.organizationId;
    if (typeof explicitId === "number") return explicitId;
    if (typeof explicitId === "string" && /^\d+$/.test(explicitId)) return Number(explicitId);
  }

  return null;
};

const getRegistrationCode = (payload: any) =>
  asString(payload?.registrationKey) ||
  asString(payload?.registrationCode) ||
  asString(payload?.registration_code) ||
  asString(payload?.qrPayload?.registrationKey) ||
  asString(payload?.qrPayload?.registrationCode) ||
  asString(payload?.machine?.registrationKey) ||
  asString(payload?.machine?.registrationCode) ||
  asString(payload?.key) ||
  asString(payload?.machineKey);

const contactLabel = (params: {
  messengerType: string;
  messengerCountryCode: string;
  messengerValue: string;
  email: string;
}) => {
  if (params.messengerType === "whatsapp") {
    return `${params.messengerCountryCode} ${params.messengerValue}`.trim();
  }

  return params.email;
};

const buildClientContact = (params: {
  messengerType: string;
  messengerCountryCode: string;
  messengerValue: string;
  email: string;
}) => {
  const contacts = [
    {
      __component: "email.email",
      email: params.email,
    },
  ];

  if (params.messengerType === "whatsapp") {
    contacts.push({
      __component: "whatsapp.whatsapp",
      whatsapp: contactLabel(params),
    } as any);
  }

  return contacts;
};

const fetchClientByPortalEmail = async (email: string) => {
  const params = new URLSearchParams();
  params.set("filters[portal_email][$eqi]", email.toLowerCase());
  params.set("pagination[pageSize]", "2000");

  const clients = await requestStrapiRestAsService<Client[]>(
    `/api/clients?${params.toString()}`,
  );

  return clients[0] || null;
};

const fetchClientByCompany = async (company: string) => {
  const params = new URLSearchParams();
  params.set("filters[company][$eqi]", company);
  params.set("pagination[pageSize]", "2000");

  const clients = await requestStrapiRestAsService<Client[]>(
    `/api/clients?${params.toString()}`,
  );

  return clients[0] || null;
};

const fetchCurrencyByCode = async (code: string) => {
  const params = new URLSearchParams();
  params.set("filters[code][$eqi]", code);
  params.set("pagination[pageSize]", "1");
  const currencies = await requestStrapiRestAsService<Currency[]>(
    `/api/currencies?${params.toString()}`,
  );
  return currencies[0] || null;
};

const resolveRegistrationCurrency = async (currencyId: string) => {
  const isoCode = getIsoCodeFromVirtualId(currencyId);
  if (!isoCode) {
    return requestStrapiRestAsService<Currency>(
      `/api/currencies/${currencyId}`,
    ).catch(() => null);
  }

  const definition = getIsoCurrency(isoCode);
  if (!definition) return null;

  const existing = await fetchCurrencyByCode(isoCode);
  if (existing?.isActive === false) {
    return requestStrapiRestAsService<Currency>(
      `/api/currencies/${existing.id}`,
      {
        method: "PUT",
        body: JSON.stringify({ data: { isActive: true } }),
      },
    );
  }
  if (existing) return existing;

  const { id: _virtualId, ...data } = definition;
  try {
    return await requestStrapiRestAsService<Currency>("/api/currencies", {
      method: "POST",
      body: JSON.stringify({ data }),
    });
  } catch {
    // A concurrent registration may have created the unique currency first.
    return fetchCurrencyByCode(isoCode).catch(() => null);
  }
};

const createClient = async (params: {
  nickname: string;
  email: string;
  messengerType: string;
  messengerCountryCode: string;
  messengerValue: string;
  country: string;
  state: string;
  city: string;
  currencyId: string | number;
}) =>
  requestStrapiRestAsService<Client>("/api/clients", {
    method: "POST",
    body: JSON.stringify({
      data: {
        company: params.nickname,
        portal_email: params.email,
        portal_access_enabled: true,
        portal_auth_provider: "local",
        status: "client",
        country: params.country,
        state: params.state,
        city: params.city,
        currency: params.currencyId,
        contact: buildClientContact(params),
      },
    }),
  });

const updateClientLocation = async (
  clientId: string | number,
  location: { country: string; state: string; city: string },
) =>
  requestStrapiRestAsService<Client>(`/api/clients/${clientId}`, {
    method: "PUT",
    body: JSON.stringify({ data: location }),
  });

const updateClientPortalAccess = async (
  clientId: string | number,
  email: string,
  telemetryOrganizationId?: number | null,
) =>
  requestStrapiRestAsService<Client>(`/api/clients/${clientId}`, {
    method: "PUT",
    body: JSON.stringify({
      data: {
        portal_email: email,
        portal_access_enabled: true,
        portal_auth_provider: "local",
        ...(telemetryOrganizationId ? { telemetry_organization_id: telemetryOrganizationId } : {}),
      },
    }),
  });


const syncTelemetry = async (params: {
  client: Client;
  machine: Machine;
  company: string;
  contactName: string;
  email: string;
  messengerType: string;
  messengerCountryCode: string;
  messengerValue: string;
  currency: Currency;
}) => {
  if (!isTelemetryConfigured()) {
    const missing = getMissingTelemetryEnvKeys();
    throw new Error(
      `Telemetry environment is not configured. Missing: ${missing.join(", ")}`,
    );
  }

  const userUuid = await getTelemetryUserUuid();
  if (!userUuid) {
    throw new Error("Telemetry root user UUID could not be read.");
  }

  const existingOrganizationId = await resolveTelemetryOrganizationId(params.client);
  let organizationId = existingOrganizationId;

  if (!organizationId) {
    const created = await createTelemetryOrganization({
      name: params.company,
      description: `Created from iShaker portal for ${params.email}.`,
      currency: params.currency.code,
      isTest: false,
      enabledModules: [],
      isUsedLocalProductBase: false,
      isDocumentUploadEnabled: false,
      contacts: [
        {
          name: params.contactName,
          contact: contactLabel(params),
        },
      ],
    });

    organizationId = getTelemetryId(created) || (await resolveTelemetryOrganizationId({
      company: params.company,
    }));
  }

  if (!organizationId) {
    throw new Error("Telemetry organization was not resolved after create.");
  }

  let telemetryNoteSuffix = "";
  if (params.client.telemetry_organization_id !== organizationId) {
    await updateClientPortalAccess(params.client.id, params.email, organizationId).catch((error) => {
      console.error("[portal/register-machine] telemetry org id save failed:", error);
      telemetryNoteSuffix =
        " Strapi telemetry organization id was not saved; check that the client.telemetry_organization_id field is deployed.";
    });
  }

  const existingMachine = await findTelemetryMachineBySerial(params.machine.serial_number);

  if (existingMachine?.machine?.id) {
    if (existingMachine.organizationId !== organizationId) {
      await changeTelemetryMachineOrganization(
        existingMachine.machine.id,
        organizationId,
        userUuid,
      );

      return {
        status: "moved",
        organizationId,
        machineId: existingMachine.machine.id,
        note: `Telemetry machine moved from organization ${existingMachine.organizationId} to ${organizationId}.${telemetryNoteSuffix}`,
      };
    }

    return {
      status: "exists",
      organizationId,
      machineId: existingMachine.machine.id,
      note: `Telemetry machine already exists in organization ${organizationId}.${telemetryNoteSuffix}`,
    };
  }

  const provisioned = await provisionTelemetryMachineSetup(userUuid, {
    organizationId,
    serialNumber: params.machine.serial_number,
    shipmentDate: new Date().toISOString().slice(0, 10),
  });
  const registrationCode = getRegistrationCode(provisioned);

  if (registrationCode) {
    await requestStrapiRestAsService(`/api/machines/${params.machine.id}`, {
      method: "PUT",
      body: JSON.stringify({
        data: {
          telemetry_reg_code: registrationCode,
        },
      }),
    });
  }

  return {
    status: "provisioned",
    organizationId,
    machineId: getTelemetryId(provisioned),
    registrationCode,
    note: `Telemetry machine provisioned in organization ${organizationId}.${telemetryNoteSuffix}`,
  };
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const session = await getPortalSessionFromApiRequest(req).catch(() => null);
  const isExistingAccount = session?.access === "client";
  // Strapi serials may have an internal suffix (for example, 25081725-rfaa8).
  // Registration and ownership lookup are based only on the numeric prefix.
  const serialNumber = getMachineSerialBase(asString(req.body?.serialNumber));
  const requestedNickname = normalizeNickname(
    req.body?.nickname || req.body?.company,
  );
  const nickname = isExistingAccount
    ? session.client.company
    : requestedNickname;
  const country = asString(req.body?.country);
  const state = asString(req.body?.state);
  const city = asString(req.body?.city);
  const contactName = isExistingAccount
    ? session.user.username || nickname
    : asString(req.body?.contactName);
  const email = isExistingAccount
    ? session.user.email.toLowerCase()
    : asString(req.body?.email).toLowerCase();
  const messengerType = asString(req.body?.messengerType);
  const messengerCountryCode = asString(req.body?.messengerCountryCode);
  const messengerValue = asString(req.body?.messengerValue);
  const password = asString(req.body?.password);
  const passwordConfirmation = asString(req.body?.passwordConfirmation);
  const currencyId = asString(req.body?.currencyId);

  if (!serialNumber || !nickname || !country || !state || !city || !currencyId) {
    return res.status(400).json({
      error: "missing_required_fields",
      message: "Nickname, country, state/region, city, currency, and serial number are required.",
    });
  }

  if (!/^\d+$/.test(serialNumber)) {
    return res.status(400).json({
      error: "invalid_serial_number",
      message: "Serial number must contain digits only.",
    });
  }

  if (!isValidNickname(nickname)) {
    return res.status(400).json({
      error: "invalid_nickname",
      message:
        "Nickname must use 3–32 letters, numbers, hyphens, or underscores with no spaces.",
    });
  }

  if (
    isExistingAccount &&
    requestedNickname &&
    requestedNickname.toLowerCase() !== nickname.toLowerCase()
  ) {
    return res.status(403).json({
      error: "nickname_mismatch",
      message: "The nickname does not match the signed-in account.",
    });
  }

  if (
    !isExistingAccount &&
    (!contactName ||
      !email ||
      !messengerType ||
      !messengerValue ||
      !password ||
      !passwordConfirmation)
  ) {
    return res.status(400).json({
      error: "missing_account_fields",
      message: "Contact, email, WhatsApp, and password are required.",
    });
  }

  if (!isExistingAccount && password !== passwordConfirmation) {
    return res.status(400).json({
      error: "password_mismatch",
      message: "Passwords do not match.",
    });
  }

  if (!isExistingAccount && password.length < 8) {
    return res.status(400).json({
      error: "invalid_password",
      message: "Use at least 8 characters for the password.",
    });
  }

  if (!isExistingAccount && messengerType !== "whatsapp") {
    return res.status(400).json({
      error: "invalid_messenger",
      message: "WhatsApp is required for registration.",
    });
  }

  if (
    !isExistingAccount &&
    (!WHATSAPP_COUNTRY_CODE_REGEX.test(messengerCountryCode) ||
      !WHATSAPP_LOCAL_NUMBER_REGEX.test(messengerValue))
  ) {
    return res.status(400).json({
      error: "invalid_whatsapp",
      message: "Enter a valid WhatsApp number.",
    });
  }

  let matchedMachine: Machine | null;
  try {
    matchedMachine = await fetchMachineBySerialAsService(serialNumber);
  } catch (error) {
    if (error instanceof MachineSerialIssueError) {
      return res.status(409).json({
        error: "serial_number_issue",
        message:
          "This machine has a serial number issue. Please contact support.",
        supportUrl: WHATSAPP_SUPPORT_URL,
      });
    }

    console.error("[portal/register-machine] machine lookup failed:", error);
    matchedMachine = null;
  }

  if (!matchedMachine?.id) {
    return res.status(404).json({
      error: "machine_not_found",
      message: "This machine serial number was not found in Strapi.",
    });
  }

  const currency = await resolveRegistrationCurrency(currencyId);
  if (!currency?.id || currency.isActive === false) {
    return res.status(400).json({
      error: "invalid_currency",
      message: "Select an active currency.",
    });
  }

  if (
    matchedMachine.client?.id &&
    (!isExistingAccount ||
      String(matchedMachine.client.id) !== String(session.client.id))
  ) {
    return res.status(409).json({
      error: "machine_already_registered",
      message: "This machine is already registered. Sign in to its owner account.",
      redirectTo: "/login",
    });
  }

  let client: Client;
  let portalUserId = isExistingAccount ? session.user.id : null;
  let newAccountJwt = "";

  if (isExistingAccount) {
    client = session.client;
  } else {
    const [existingByNickname, existingByEmail] = await Promise.all([
      fetchClientByCompany(nickname),
      fetchClientByPortalEmail(email),
    ]);

    if (existingByNickname) {
      return res.status(409).json({
        error: "nickname_exists",
        message: "That nickname already has an account. Sign in to continue.",
        redirectTo: `/login?identifier=${encodeURIComponent(
          nickname.toLowerCase(),
        )}`,
      });
    }

    if (existingByEmail) {
      return res.status(409).json({
        error: "email_exists",
        message: "That email already has an account. Sign in to continue.",
        redirectTo: `/login?identifier=${encodeURIComponent(email)}`,
      });
    }

    try {
      client = await createClient({
        nickname,
        email,
        messengerType,
        messengerCountryCode,
        messengerValue,
        country,
        state,
        city,
        currencyId: currency.id,
      });
    } catch (error) {
      console.error("[portal/register-machine] client creation failed:", error);
      const payload = getErrorPayload(error);
      return res.status(payload.status).json({
        error: "client_creation_failed",
        message: payload.message,
        details: payload.details,
      });
    }

    let registerPayload: any = null;
    let registerError: any = null;
    try {
      registerPayload = await registerPortalUserAsService({
        username: nickname.toLowerCase(),
        email,
        password,
        client: client.id,
      });
    } catch (error) {
      registerError = error;
    }

    if (!registerPayload?.jwt) {
      await requestStrapiRestAsService(`/api/clients/${client.id}`, {
        method: "DELETE",
      }).catch((error) => {
        console.error(
          "[portal/register-machine] new client rollback failed:",
          error,
        );
      });
      const registerErrorPayload = getErrorPayload(
        registerError || new Error("Portal account creation returned no session."),
      );
      return res.status(registerErrorPayload.status || 500).json({
        error: "registration_submission_failed",
        message:
          registerErrorPayload.message ||
          "Portal account could not be created.",
        details: registerErrorPayload.details || null,
      });
    }

    portalUserId = registerPayload.user?.id || null;
    newAccountJwt = registerPayload.jwt;
    setPortalSession(res, newAccountJwt);
  }

  try {
    client =
      (await updateClientLocation(client.id, { country, state, city })) ||
      client;
  } catch (error) {
    console.error("[portal/register-machine] client location update failed:", error);
    const payload = getErrorPayload(error);
    return res.status(payload.status).json({
      error: "client_update_failed",
      message: payload.message,
      details: payload.details,
    });
  }

  let assignedMachine: Machine;
  try {
    assignedMachine = await updateMachineRegistrationData({
      client,
      machine: matchedMachine,
      nickname,
      country,
      stateRegion: state,
      city,
      currencyId: currency.id,
    });
  } catch (error) {
    console.error("[portal/register-machine] machine assignment failed:", error);
    const payload = getErrorPayload(error);
    return res.status(payload.status).json({
      error: "machine_assignment_failed",
      message: payload.message,
      details: payload.details,
    });
  }

  let presetResult: unknown = null;
  let presetNote = "";
  try {
    presetResult = await requestStrapiRestAsService(
      `/api/machines/${assignedMachine.id}/apply-preset`,
      { method: "POST", body: JSON.stringify({}) },
    );

    const result = presetResult as {
      applied?: boolean;
      reason?: string;
      preset?: { name?: string };
      lines?: { created?: unknown[] };
      products?: { created?: unknown[] };
      cells?: { created?: unknown[] };
    };
    presetNote = result.applied
      ? `Catalog seeded from preset "${result.preset?.name || "unknown"}": ${
          result.lines?.created?.length || 0
        } lines, ${result.products?.created?.length || 0} products, ${
          result.cells?.created?.length || 0
        } cells.`
      : `Catalog not seeded: ${result.reason || "preset was not applied"}.`;
  } catch (error) {
    // Non-fatal: the assigned machine can keep selling its preset until ops
    // re-runs catalog seeding.
    console.error("[portal/register-machine] preset apply failed:", error);
    const payload = getErrorPayload(error);
    presetNote = `Catalog not seeded: ${payload.message}.`;
  }

  let telemetryResult: {
    status: string;
    organizationId?: number | null;
    machineId?: number | null;
    registrationCode?: string;
    note?: string;
  } | null = null;
  let telemetryErrorNote = "";
  try {
    telemetryResult = await syncTelemetry({
      client,
      machine: assignedMachine,
      company: nickname,
      contactName,
      email,
      messengerType,
      messengerCountryCode,
      messengerValue,
      currency,
    });
  } catch (error) {
    console.error("[portal/register-machine] telemetry sync failed:", error);
    const payload = getTelemetryErrorPayload(error);
    telemetryErrorNote = `Telemetry sync pending: ${payload.message}`;
  }

  const data = {
    serial_number: serialNumber,
    machine_title: assignedMachine.title,
    company: nickname,
    contact_name: contactName,
    email,
    portal_auth_provider: "local",
    phone:
      messengerType === "whatsapp"
        ? `${messengerCountryCode} ${messengerValue}`.trim()
        : "",
    notes: [
      asString(req.body?.notes),
      messengerType && messengerValue
        ? `WhatsApp: ${messengerCountryCode} ${messengerValue}`.trim()
        : "",
      presetNote,
      telemetryResult?.note || "",
      telemetryErrorNote,
    ]
      .filter(Boolean)
      .join("\n"),
    requested_at: new Date().toISOString(),
    status: "pending",
    ...(matchedMachine?.id ? { machine: matchedMachine.id } : {}),
    ...(client?.id ? { client: client.id } : {}),
    ...(portalUserId ? { portal_user: portalUserId } : {}),
  };

  try {
    const response = await requestStrapiRestAsService(
      "/api/portal-registration-requests",
      {
        method: "POST",
        body: JSON.stringify({ data }),
      },
    );

    return res.status(200).json({
      ok: true,
      response,
      machine: assignedMachine,
      telemetry: telemetryResult || { status: "pending" },
      accountCreated: !isExistingAccount,
    });
  } catch (error) {
    console.error("[portal/register-machine] failed:", error);
    const payload = getErrorPayload(error);
    return res.status(payload.status).json({
      error: "registration_submission_failed",
      message: payload.message,
      details: payload.details,
    });
  }
}

export default withSupportPortalApi(handler);
