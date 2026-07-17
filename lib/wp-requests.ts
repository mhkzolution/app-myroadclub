import { getAuthToken } from "./auth";

export type WordPressRequestErrorKind =
  | "auth"
  | "validation"
  | "size"
  | "network"
  | "server";

export class WordPressRequestError extends Error {
  constructor(
    public readonly kind: WordPressRequestErrorKind,
    message: string
  ) {
    super(message);
    this.name = "WordPressRequestError";
  }
}

export interface TicketRequestPayload {
  citationNumber: string;
  violationDate: string;
  state: string;
  city: string;
  violationType: string;
  description: string;
  courtDate: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

export interface RoadsideCustomer {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  isMember: boolean;
  accountName: string;
  membershipId: string;
}

export interface RoadsideVehicle {
  year: string;
  make: string;
  model: string;
  color: string;
  vin: string;
  plate: string;
  safeLocation: boolean;
}

export interface RoadsideLocation {
  address: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
}

export interface RoadsideAdditional {
  passengers: string;
  driveType: string;
  withVehicle: boolean;
}

export interface RoadsideRequestPayload {
  serviceType: string;
  serviceDetails: string;
  customer: RoadsideCustomer;
  vehicle: RoadsideVehicle;
  serviceLocation: RoadsideLocation;
  dropOff: RoadsideLocation | null;
  additional: RoadsideAdditional;
}

export interface RequestCreated {
  id: number;
  reference: string;
  status: "pending";
  createdAt: string;
}

interface WordPressErrorBody {
  code?: unknown;
  message?: unknown;
}

const WORDPRESS_URL = (
  process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://myroadclub.com"
).replace(/\/+$/, "");

const REQUEST_API_URL = `${WORDPRESS_URL}/wp-json/myroadclub/v1`;

const ERROR_MESSAGES: Record<WordPressRequestErrorKind, string> = {
  auth: "Your session has expired. Please sign in again before submitting.",
  validation: "Some information could not be accepted. Review the form and try again.",
  size: "The selected files exceed the upload limit. Remove or reduce files and try again.",
  network: "Could not reach My Road Club. Check your connection and try again.",
  server: "We could not save your request. Please try again or call member services.",
};

const ALLOWED_TICKET_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);
const MAX_TICKET_FILES = 10;
const MAX_TICKET_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TICKET_TOTAL_SIZE = 50 * 1024 * 1024;

export function getWordPressToken(): string | null {
  return getAuthToken();
}

export function requestErrorMessage(error: unknown): string {
  return error instanceof WordPressRequestError
    ? ERROR_MESSAGES[error.kind]
    : ERROR_MESSAGES.server;
}

export function validateTicketFiles(files: File[]): void {
  if (files.length > MAX_TICKET_FILES) throw requestError("size");

  if (files.some((file) => !ALLOWED_TICKET_FILE_TYPES.has(file.type))) {
    throw requestError("validation");
  }

  if (
    files.some((file) => file.size > MAX_TICKET_FILE_SIZE) ||
    files.reduce((total, file) => total + file.size, 0) > MAX_TICKET_TOTAL_SIZE
  ) {
    throw requestError("size");
  }
}

function requestError(kind: WordPressRequestErrorKind, message?: string) {
  return new WordPressRequestError(kind, message || ERROR_MESSAGES[kind]);
}

async function parseWordPressError(
  response: Response,
  allowedCodes: string[]
): Promise<string | undefined> {
  try {
    const body = (await response.json()) as WordPressErrorBody;
    if (
      body &&
      typeof body === "object" &&
      typeof body.code === "string" &&
      allowedCodes.includes(body.code) &&
      typeof body.message === "string" &&
      body.message.length > 0 &&
      body.message.length <= 500
    ) {
      return body.message;
    }
  } catch {
    // WordPress or an upstream proxy may return an empty or non-JSON error body.
  }
  return undefined;
}

function isRequestCreated(value: unknown): value is RequestCreated {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const expectedKeys = ["createdAt", "id", "reference", "status"];

  return (
    keys.length === expectedKeys.length &&
    keys.every((key, index) => key === expectedKeys[index]) &&
    Number.isInteger(record.id) &&
    (record.id as number) > 0 &&
    typeof record.reference === "string" &&
    record.reference.length > 0 &&
    record.status === "pending" &&
    typeof record.createdAt === "string" &&
    record.createdAt.length > 0
  );
}

async function sendRequest(url: string, init: RequestInit): Promise<RequestCreated> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw requestError("network");
  }

  if (response.status !== 201) {
    if (response.status === 401) throw requestError("auth");

    if (response.status === 413) {
      throw requestError(
        "size",
        await parseWordPressError(response, ["mrc_upload_too_large"])
      );
    }

    if (response.status === 422) {
      throw requestError(
        "validation",
        await parseWordPressError(response, [
          "mrc_validation_error",
          "mrc_request_error",
        ])
      );
    }

    throw requestError("server");
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw requestError("server");
  }

  if (!isRequestCreated(body)) throw requestError("server");
  return body;
}

function requireToken() {
  const token = getWordPressToken();
  if (!token) throw requestError("auth");
  return token;
}

export async function submitTicketRequest(
  payload: TicketRequestPayload,
  files: File[]
): Promise<RequestCreated> {
  validateTicketFiles(files);
  const token = requireToken();
  const body = new FormData();
  body.append("payload", JSON.stringify(payload));
  files.forEach((file) => body.append("attachments[]", file));

  return await sendRequest(`${REQUEST_API_URL}/ticket-requests`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
}

export async function submitRoadsideRequest(
  payload: RoadsideRequestPayload
): Promise<RequestCreated> {
  const token = requireToken();

  return await sendRequest(`${REQUEST_API_URL}/roadside-requests`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}
