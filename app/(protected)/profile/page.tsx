"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useMemberProfile } from "@/app/hooks/useMemberProfile";
import {
  applyEditableProfileDefaults,
  validateMemberProfileInput,
} from "@/lib/member-profile-form";
import {
  MemberProfileError,
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
  const [fieldsInvalid, setFieldsInvalid] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm((current) => applyEditableProfileDefaults(current, profile));
  }, [profile]);

  function changeField(field: keyof MemberProfileInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setSaveError(null);
    setFieldsInvalid(false);
    setSaved(false);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    setSaveError(null);
    setFieldsInvalid(false);

    const validationError = validateMemberProfileInput(form);
    if (validationError) {
      setSaveError(validationError);
      setFieldsInvalid(true);
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
      setFieldsInvalid(
        error instanceof MemberProfileError && error.kind === "validation"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mrc-profile-page">
      <div className="mrc-profile-shell">
        <Link className="mrc-profile-back" href="/">
          ← Back to home
        </Link>

        <header className="mrc-profile-header">
          <p className="mrc-profile-kicker">My Road Club</p>
          <h1>Member profile</h1>
          <p>Keep your contact information current for faster member support.</p>
        </header>

        {loading && !profile && (
          <div className="mrc-profile-card mrc-profile-state" role="status">
            <span className="mrc-profile-spinner" aria-hidden />
            Loading your profile…
          </div>
        )}

        {loadError && !profile && (
          <div className="mrc-profile-card">
            <p className="ra-banner-error" role="alert">
              {memberProfileErrorMessage(loadError)}
            </p>
            <Link className="mrc-profile-secondary" href="/login">
              Sign in again
            </Link>
          </div>
        )}

        {profile && (
          <form
            className="mrc-profile-card"
            onSubmit={onSubmit}
            noValidate
            aria-busy={saving || undefined}
          >
            <section className="mrc-profile-readonly" aria-label="Membership details">
              <div>
                <span>Username</span>
                <strong>{profile.username}</strong>
              </div>
              <div>
                <span>Membership ID</span>
                <strong>{profile.membershipId || "Not assigned"}</strong>
              </div>
            </section>

            <div className="mrc-profile-grid">
              <label className="ra-field">
                <span className="ra-field-label">First name</span>
                <input
                  className="ra-input"
                  value={form.firstName}
                  onChange={(event) => changeField("firstName", event.target.value)}
                  autoComplete="given-name"
                  maxLength={100}
                  disabled={saving}
                  required
                  aria-invalid={fieldsInvalid || undefined}
                />
              </label>
              <label className="ra-field">
                <span className="ra-field-label">Last name</span>
                <input
                  className="ra-input"
                  value={form.lastName}
                  onChange={(event) => changeField("lastName", event.target.value)}
                  autoComplete="family-name"
                  maxLength={100}
                  disabled={saving}
                  required
                  aria-invalid={fieldsInvalid || undefined}
                />
              </label>
              <label className="ra-field mrc-profile-full">
                <span className="ra-field-label">Display name</span>
                <input
                  className="ra-input"
                  value={form.displayName}
                  onChange={(event) => changeField("displayName", event.target.value)}
                  autoComplete="name"
                  maxLength={100}
                  disabled={saving}
                  required
                  aria-invalid={fieldsInvalid || undefined}
                />
              </label>
              <label className="ra-field mrc-profile-full">
                <span className="ra-field-label">Email</span>
                <input
                  className="ra-input"
                  type="email"
                  value={form.email}
                  onChange={(event) => changeField("email", event.target.value)}
                  autoComplete="email"
                  maxLength={254}
                  disabled={saving}
                  required
                  aria-invalid={fieldsInvalid || undefined}
                />
              </label>
              <label className="ra-field mrc-profile-full">
                <span className="ra-field-label">Phone number</span>
                <input
                  className="ra-input"
                  type="tel"
                  value={form.phone}
                  onChange={(event) => changeField("phone", event.target.value)}
                  autoComplete="tel"
                  maxLength={40}
                  disabled={saving}
                  aria-invalid={fieldsInvalid || undefined}
                />
              </label>
            </div>

            {saveError && (
              <p className="ra-banner-error" role="alert">
                {saveError}
              </p>
            )}
            {saved && (
              <p className="ra-banner-success" role="status">
                Your profile has been updated.
              </p>
            )}

            <button className="ra-submit" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
