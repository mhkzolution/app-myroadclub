"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { FormField } from "@/app/components/ui/FormField";
import { Input } from "@/app/components/ui/Input";
import { StatusBanner } from "@/app/components/ui/StatusBanner";
import { useMemberProfile } from "@/app/hooks/useMemberProfile";
import {
  applyEditableProfileDefaults,
  validateMemberProfileFields,
} from "@/lib/member-profile-form";
import {
  memberProfileErrorMessage,
  saveMemberProfile,
  type MemberProfileInput,
} from "@/lib/wp-profile";

const EMPTY_PROFILE: MemberProfileInput = {
  firstName: "",
  lastName: "",
  displayName: "",
  email: "",
  phone: "",
};

export default function ProfilePage() {
  const { profile, loading, error: loadError } = useMemberProfile();
  const [form, setForm] = useState<MemberProfileInput>(EMPTY_PROFILE);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof MemberProfileInput, string>>
  >({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm((current) => applyEditableProfileDefaults(current, profile));
  }, [profile]);

  function changeField(field: keyof MemberProfileInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setSaveError(null);
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setSaved(false);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    setSaveError(null);
    setFieldErrors({});

    const validationErrors = validateMemberProfileFields(form);
    const firstValidationError = Object.values(validationErrors)[0];
    if (firstValidationError) {
      setSaveError(firstValidationError);
      setFieldErrors(validationErrors);
      return;
    }

    setSaving(true);
    try {
      const updated = await saveMemberProfile(form);
      setForm({
        firstName: updated.firstName,
        lastName: updated.lastName,
        displayName: updated.displayName,
        email: updated.email,
        phone: updated.phone,
      });
      setSaved(true);
    } catch (error) {
      setSaveError(memberProfileErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-dvh bg-mrc-soft px-4 py-6 md:py-10">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          className="inline-flex min-h-11 items-center rounded-lg text-sm font-bold text-mrc-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mrc-cyan/30"
          href="/"
        >
          ← Back to home
        </Link>

        <header className="mb-5 mt-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-mrc-primary">
            My Road Club
          </p>
          <h1 className="mt-1 text-2xl font-bold text-mrc-text md:text-3xl">
            Member profile
          </h1>
          <p className="mt-2 text-sm leading-6 text-mrc-muted">
            Keep your contact information current for faster member support.
          </p>
        </header>

        {loading && !profile && (
          <Card className="flex min-h-32 items-center justify-center gap-3" role="status">
            <span
              className="size-6 animate-spin rounded-full border-2 border-slate-200 border-t-mrc-primary motion-reduce:animate-none"
              aria-hidden
            />
            <span className="text-sm text-mrc-muted">Loading your profile…</span>
          </Card>
        )}

        {loadError && !profile && (
          <Card>
            <StatusBanner tone="error">{memberProfileErrorMessage(loadError)}</StatusBanner>
            <Link
              className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-mrc-border bg-white px-4 py-2.5 text-sm font-bold text-mrc-text focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mrc-cyan/30"
              href="/login"
            >
              Sign in again
            </Link>
          </Card>
        )}

        {profile && (
          <Card
            as="section"
            className="p-4 md:p-6"
          >
            <form onSubmit={onSubmit} noValidate aria-busy={saving || undefined}>
              <section
                className="grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-2"
                aria-label="Membership details"
              >
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-mrc-muted">
                    Username
                  </span>
                  <strong className="mt-1 block break-words text-sm text-mrc-text">
                    {profile.username}
                  </strong>
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-mrc-muted">
                    Membership ID
                  </span>
                  <strong className="mt-1 block break-words text-sm text-mrc-text">
                    {profile.membershipId || "Not assigned"}
                  </strong>
                </div>
              </section>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  id="profile-first-name"
                  label="First name"
                  error={fieldErrors.firstName}
                >
                  {(controlProps) => (
                    <Input
                      {...controlProps}
                      type="text"
                      value={form.firstName}
                      onChange={(event) => changeField("firstName", event.target.value)}
                      autoComplete="given-name"
                      disabled={saving}
                      required
                    />
                  )}
                </FormField>
                <FormField
                  id="profile-last-name"
                  label="Last name"
                  error={fieldErrors.lastName}
                >
                  {(controlProps) => (
                    <Input
                      {...controlProps}
                      type="text"
                      value={form.lastName}
                      onChange={(event) => changeField("lastName", event.target.value)}
                      autoComplete="family-name"
                      disabled={saving}
                      required
                    />
                  )}
                </FormField>
                <FormField
                  id="profile-display-name"
                  label="Display name"
                  error={fieldErrors.displayName}
                  className="md:col-span-2"
                >
                  {(controlProps) => (
                    <Input
                      {...controlProps}
                      type="text"
                      value={form.displayName}
                      onChange={(event) => changeField("displayName", event.target.value)}
                      autoComplete="name"
                      disabled={saving}
                      required
                    />
                  )}
                </FormField>
                <FormField
                  id="profile-email"
                  label="Email"
                  error={fieldErrors.email}
                  className="md:col-span-2"
                >
                  {(controlProps) => (
                    <Input
                      {...controlProps}
                      type="email"
                      inputMode="email"
                      value={form.email}
                      onChange={(event) => changeField("email", event.target.value)}
                      autoComplete="email"
                      disabled={saving}
                      required
                    />
                  )}
                </FormField>
                <FormField
                  id="profile-phone"
                  label="Phone number"
                  error={fieldErrors.phone}
                  className="md:col-span-2"
                >
                  {(controlProps) => (
                    <Input
                      {...controlProps}
                      type="tel"
                      inputMode="tel"
                      value={form.phone}
                      onChange={(event) => changeField("phone", event.target.value)}
                      autoComplete="tel"
                      disabled={saving}
                    />
                  )}
                </FormField>
              </div>

              {saveError && (
                <StatusBanner tone="error" className="mt-5">
                  {saveError}
                </StatusBanner>
              )}
              {saved && (
                <StatusBanner tone="success" className="mt-5">
                  Your profile has been updated.
                </StatusBanner>
              )}

              <Button type="submit" loading={saving} className="mt-5 w-full md:w-auto">
                {saving ? "Saving…" : "Save profile"}
              </Button>
            </form>
          </Card>
        )}
      </div>
    </main>
  );
}
