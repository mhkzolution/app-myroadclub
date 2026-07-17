import { getAuthToken } from "./auth";

export interface MemberProfile {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  phone: string;
  membershipId: string;
}

export type MemberProfileInput = Pick<
  MemberProfile,
  "firstName" | "lastName" | "displayName" | "email" | "phone"
>;

export type MemberProfileErrorKind =
  | "auth"
  | "validation"
  | "network"
  | "server";

export class MemberProfileError extends Error {
  constructor(
    public readonly kind: MemberProfileErrorKind,
    message: string
  ) {
    super(message);
    this.name = "MemberProfileError";
  }
}

export const MEMBER_PROFILE_UPDATED_EVENT = "mrc:member-profile-updated";

const WORDPRESS_URL = (
  process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://myroadclub.com"
).replace(/\/+$/, "");
const PROFILE_URL = `${WORDPRESS_URL}/wp-json/myroadclub/v1/member-profile`;

const ERROR_MESSAGES: Record<MemberProfileErrorKind, string> = {
  auth: "Your session has expired. Please sign in again.",
  validation:
    "Some profile information could not be accepted. Review your details and try again.",
  network: "Could not reach My Road Club. Check your connection and try again.",
  server: "We could not load or save your profile. Please try again.",
};

let cachedProfile: Promise<MemberProfile> | null = null;

function profileError(kind: MemberProfileErrorKind): MemberProfileError {
  return new MemberProfileError(kind, ERROR_MESSAGES[kind]);
}

export function memberProfileErrorMessage(error: unknown): string {
  return error instanceof MemberProfileError
    ? ERROR_MESSAGES[error.kind]
    : ERROR_MESSAGES.server;
}

function isMemberProfile(value: unknown): value is MemberProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const record = value as Record<string, unknown>;
  const expectedKeys = [
    "displayName",
    "email",
    "firstName",
    "id",
    "lastName",
    "membershipId",
    "phone",
    "username",
  ];
  const keys = Object.keys(record).sort();

  return (
    keys.length === expectedKeys.length &&
    keys.every((key, index) => key === expectedKeys[index]) &&
    Number.isInteger(record.id) &&
    (record.id as number) > 0 &&
    typeof record.username === "string" &&
    typeof record.firstName === "string" &&
    typeof record.lastName === "string" &&
    typeof record.displayName === "string" &&
    typeof record.email === "string" &&
    typeof record.phone === "string" &&
    typeof record.membershipId === "string"
  );
}

function requireToken(): string {
  const token = getAuthToken();
  if (!token) throw profileError("auth");
  return token;
}

async function sendProfileRequest(
  method: "GET" | "PATCH",
  body?: MemberProfileInput
): Promise<MemberProfile> {
  const token = requireToken();
  let response: Response;

  try {
    response = await fetch(PROFILE_URL, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw profileError("network");
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw profileError("auth");
    }
    if (response.status === 400 || response.status === 422) {
      throw profileError("validation");
    }
    throw profileError("server");
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    throw profileError("server");
  }

  if (!isMemberProfile(responseBody)) throw profileError("server");
  return responseBody;
}

export function getMemberProfile(force = false): Promise<MemberProfile> {
  if (!force && cachedProfile) return cachedProfile;

  const pending = sendProfileRequest("GET");
  const cacheEntry = pending.catch((error: unknown) => {
    if (cachedProfile === cacheEntry) cachedProfile = null;
    throw error;
  });
  cachedProfile = cacheEntry;
  return cacheEntry;
}

export async function saveMemberProfile(
  input: MemberProfileInput
): Promise<MemberProfile> {
  const editableInput: MemberProfileInput = {
    firstName: input.firstName,
    lastName: input.lastName,
    displayName: input.displayName,
    email: input.email,
    phone: input.phone,
  };
  const profile = await sendProfileRequest("PATCH", editableInput);

  cachedProfile = Promise.resolve(profile);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(MEMBER_PROFILE_UPDATED_EVENT));
  }
  return profile;
}

export function applyProfileDefaults<T extends Record<string, unknown>>(
  current: T,
  defaults: Partial<T>
): T {
  const result = { ...current };

  for (const key of Object.keys(defaults) as Array<keyof T>) {
    const value = current[key];
    if (value === "" || value === null || value === undefined) {
      result[key] = defaults[key] as T[keyof T];
    }
  }

  return result;
}

/**
 * Returns value only when the request generation is still current.
 * Lets useMemberProfile drop stale in-flight loads after a newer update.
 */
export function takeIfCurrentGeneration<T>(
  requestGeneration: number,
  currentGeneration: number,
  value: T
): T | null {
  return requestGeneration === currentGeneration ? value : null;
}
