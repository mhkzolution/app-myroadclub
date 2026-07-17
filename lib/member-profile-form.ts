import {
  applyProfileDefaults,
  type MemberProfile,
  type MemberProfileInput,
} from "./wp-profile";

export type TicketContactFields = Pick<
  MemberProfileInput,
  "firstName" | "lastName" | "phone" | "email"
>;

export interface RoadsideMemberFields extends TicketContactFields {
  accountName: string;
  membershipId: string;
  isMember: boolean;
}

export function applyTicketProfileDefaults(
  current: TicketContactFields,
  profile: MemberProfile
): TicketContactFields {
  return applyProfileDefaults<TicketContactFields>(current, {
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
    email: profile.email,
  });
}

export function applyRoadsideProfileDefaults(
  current: RoadsideMemberFields,
  profile: MemberProfile
): RoadsideMemberFields {
  return {
    ...applyProfileDefaults<RoadsideMemberFields>(current, {
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      email: profile.email,
      accountName: profile.displayName,
      membershipId: profile.membershipId,
    }),
    isMember: true,
  };
}

export function applyEditableProfileDefaults(
  current: MemberProfileInput,
  profile: MemberProfile
): MemberProfileInput {
  return applyProfileDefaults<MemberProfileInput>(current, {
    firstName: profile.firstName,
    lastName: profile.lastName,
    displayName: profile.displayName,
    email: profile.email,
    phone: profile.phone,
  });
}

/**
 * Request forms apply profile defaults once per mount.
 * Returns the first valid profile, then null for later updates (including
 * mrc:member-profile-updated) so typed contact fields and Member? stay intact.
 */
export function takeFirstRequestFormProfileDefaults(
  alreadyApplied: boolean,
  profile: MemberProfile | null
): MemberProfile | null {
  if (alreadyApplied || !profile) return null;
  return profile;
}

/**
 * Decide Member? after the first profile defaults application.
 * If the user already toggled Member?, keep their choice; otherwise select Yes.
 */
export function resolveRoadsideMemberToggleDefault(
  memberToggleTouched: boolean,
  currentIsMember: boolean
): boolean {
  return memberToggleTouched ? currentIsMember : true;
}

const LIMITS: Record<keyof MemberProfileInput, number> = {
  firstName: 100,
  lastName: 100,
  displayName: 100,
  email: 254,
  phone: 40,
};

function length(value: string): number {
  return Array.from(value).length;
}

export function validateMemberProfileFields(
  input: MemberProfileInput
): Partial<Record<keyof MemberProfileInput, string>> {
  const errors: Partial<Record<keyof MemberProfileInput, string>> = {};
  const values: MemberProfileInput = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    displayName: input.displayName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
  };

  if (!values.firstName) errors.firstName = "First name is required.";
  if (!values.lastName) errors.lastName = "Last name is required.";
  if (!values.displayName) errors.displayName = "Display name is required.";
  if (!values.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = "Enter a valid email address.";
  }

  for (const [field, limit] of Object.entries(LIMITS) as Array<
    [keyof MemberProfileInput, number]
  >) {
    if (length(values[field]) <= limit || errors[field]) continue;
    const label = field.replace(/([A-Z])/g, " $1").toLowerCase();
    errors[field] = `${label.charAt(0).toUpperCase()}${label.slice(
      1
    )} must be ${limit} characters or fewer.`;
  }

  return errors;
}

/** Backward-compatible single-string validation API (first field error, or null). */
export function validateMemberProfileInput(
  input: MemberProfileInput
): string | null {
  const errors = validateMemberProfileFields(input);
  return (Object.values(errors)[0] as string | undefined) ?? null;
}
