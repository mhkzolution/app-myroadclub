"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMemberProfile } from "../hooks/useMemberProfile";
import {
  applyTicketProfileDefaults,
  takeFirstRequestFormProfileDefaults,
} from "../../lib/member-profile-form";
import {
  requestErrorMessage,
  submitTicketRequest,
  validateTicketFiles,
  type RequestCreated,
  type TicketRequestPayload,
} from "../../lib/wp-requests";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { FormField } from "./ui/FormField";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { StatusBanner } from "./ui/StatusBanner";
import { Textarea } from "./ui/Textarea";

const ROADSIDE_PHONE =
  (typeof process !== "undefined" &&
    process.env &&
    process.env.NEXT_PUBLIC_ROADSIDE_PHONE) ||
  "+18005551234";

function telHref(phone: string) {
  const forTel = phone.trim().replace(/[^\d+]/g, "");
  if (!forTel) return "#";
  return `tel:${forTel}`;
}

const VIOLATION_TYPES = [
  "Speeding",
  "Parking",
  "Red light / stop sign",
  "HOV / carpool",
  "Registration / plates",
  "Cell phone / distracted",
  "Other",
] as const;

const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
];

export function GotTicketForm() {
  const { profile } = useMemberProfile();
  const [citationNumber, setCitationNumber] = useState("");
  const [violationDate, setViolationDate] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [violationType, setViolationType] = useState("");
  const [description, setDescription] = useState("");
  const [courtDate, setCourtDate] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState<RequestCreated | null>(null);
  const [ticketFiles, setTicketFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileDefaultsAppliedRef = useRef(false);

  useEffect(() => {
    const defaultsProfile = takeFirstRequestFormProfileDefaults(
      profileDefaultsAppliedRef.current,
      profile
    );
    if (!defaultsProfile) return;
    profileDefaultsAppliedRef.current = true;

    setFirstName((current) =>
      applyTicketProfileDefaults(
        { firstName: current, lastName: "", phone: "", email: "" },
        defaultsProfile
      ).firstName
    );
    setLastName((current) =>
      applyTicketProfileDefaults(
        { firstName: "", lastName: current, phone: "", email: "" },
        defaultsProfile
      ).lastName
    );
    setPhone((current) =>
      applyTicketProfileDefaults(
        { firstName: "", lastName: "", phone: current, email: "" },
        defaultsProfile
      ).phone
    );
    setEmail((current) =>
      applyTicketProfileDefaults(
        { firstName: "", lastName: "", phone: "", email: current },
        defaultsProfile
      ).email
    );
  }, [profile]);

  const previewUrls = useMemo(
    () =>
      ticketFiles.map((f) =>
        f.type.startsWith("image/") ? URL.createObjectURL(f) : ""
      ),
    [ticketFiles]
  );

  useEffect(() => {
    return () => {
      previewUrls.forEach((u) => {
        if (u) URL.revokeObjectURL(u);
      });
    };
  }, [previewUrls]);

  const payload = useMemo<TicketRequestPayload>(
    () => ({
      citationNumber,
      violationDate,
      state,
      city,
      violationType,
      description,
      courtDate,
      firstName,
      lastName,
      phone,
      email,
    }),
    [
      citationNumber,
      violationDate,
      state,
      city,
      violationType,
      description,
      courtDate,
      firstName,
      lastName,
      phone,
      email,
    ]
  );

  function onTicketFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list?.length) return;
    const next = [...ticketFiles, ...Array.from(list)];
    try {
      validateTicketFiles(next);
      setSubmitError(null);
      setTicketFiles(next);
    } catch (error) {
      setSubmitOk(null);
      setSubmitError(requestErrorMessage(error));
    }
    e.target.value = "";
  }

  function removeTicketFile(index: number) {
    setTicketFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitOk(null);
    setSubmitError(null);
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setSubmitError("Please enter your first name, last name, and phone number.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitTicketRequest(payload, ticketFiles);
      setSubmitOk(result);
    } catch (error) {
      setSubmitError(requestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-3xl border border-mrc-primary/20 bg-mrc-gradient-panel p-3 shadow-[0_8px_28px_var(--mrc-shadow-primary)] sm:p-5 lg:p-6">
      <header className="mb-5 flex flex-col items-center text-center">
        <div
          className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-mrc-primary/10 text-mrc-primary"
          aria-hidden
        >
          <svg
            className="size-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
            <path d="M10 9H8" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-mrc-text" id="got-ticket-title">
          Got a ticket?
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-mrc-muted">
          Tell us about your citation so our team can follow up with options and next steps.
        </p>
        <a
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-mrc-primary/30 bg-white px-4 py-2.5 text-sm font-bold text-mrc-primary transition hover:border-mrc-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mrc-cyan/30"
          href={telHref(ROADSIDE_PHONE)}
        >
          Call member services
        </a>
      </header>

      <form
        className="space-y-4"
        onSubmit={onSubmit}
        noValidate
        aria-labelledby="got-ticket-title"
      >
        <Card as="section">
          <h3 className="mb-4 text-lg font-bold text-mrc-text">Ticket details</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              id="ticket-citation"
              label="Citation or ticket number (if shown)"
              className="md:col-span-2"
            >
              {(controlProps) => (
                <Input
                  {...controlProps}
                  type="text"
                  value={citationNumber}
                  onChange={(e) => setCitationNumber(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                />
              )}
            </FormField>
            <FormField id="ticket-violation-date" label="Date of violation">
              {(controlProps) => (
                <Input
                  {...controlProps}
                  type="date"
                  value={violationDate}
                  onChange={(e) => setViolationDate(e.target.value)}
                />
              )}
            </FormField>
            <FormField id="ticket-court-date" label="Court date (if known)">
              {(controlProps) => (
                <Input
                  {...controlProps}
                  type="date"
                  value={courtDate}
                  onChange={(e) => setCourtDate(e.target.value)}
                />
              )}
            </FormField>
            <FormField id="ticket-state" label="State">
              {(controlProps) => (
                <Select
                  {...controlProps}
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  autoComplete="off"
                >
                  <option value="">Select state</option>
                  {US_STATES.map((stateCode) => (
                    <option key={stateCode} value={stateCode}>
                      {stateCode}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField id="ticket-city" label="City">
              {(controlProps) => (
                <Input
                  {...controlProps}
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  autoComplete="off"
                />
              )}
            </FormField>
            <FormField
              id="ticket-violation-type"
              label="Violation type"
              className="md:col-span-2"
            >
              {(controlProps) => (
                <Select
                  {...controlProps}
                  value={violationType}
                  onChange={(e) => setViolationType(e.target.value)}
                  autoComplete="off"
                >
                  <option value="">Select type</option>
                  {VIOLATION_TYPES.map((violation) => (
                    <option key={violation} value={violation}>
                      {violation}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField
              id="ticket-description"
              label="What happened? (optional)"
              className="md:col-span-2"
            >
              {(controlProps) => (
                <Textarea
                  {...controlProps}
                  rows={4}
                  placeholder="Brief description — location, officer notes on the ticket, etc."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  autoComplete="off"
                />
              )}
            </FormField>
            <FormField
              id="ticket-files"
              label="Photo or scan of your ticket (optional)"
              hint="Clear photo of the full ticket — JPG, PNG, or PDF. Up to 10 files, 10 MB each and 50 MB combined."
              className="min-w-0 md:col-span-2"
            >
              {(controlProps) => (
                <>
                  <Input
                    {...controlProps}
                    ref={fileInputRef}
                    type="file"
                    className="sr-only"
                    accept="image/jpeg,image/png,application/pdf"
                    multiple
                    onChange={onTicketFilesChange}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-3 w-full sm:w-auto"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <svg
                      className="mr-2 size-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" x2="12" y1="3" y2="15" />
                    </svg>
                    Upload ticket photos
                  </Button>
                  {ticketFiles.length > 0 && (
                    <ul
                      className="mt-3 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2"
                      aria-label="Selected files"
                    >
                      {ticketFiles.map((file, index) => (
                        <li
                          key={`${file.name}-${file.size}-${index}`}
                          className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-mrc-border bg-slate-50 p-2"
                        >
                          {file.type.startsWith("image/") && previewUrls[index] ? (
                            <img
                              src={previewUrls[index]}
                              alt=""
                              className="size-12 shrink-0 rounded-lg object-cover"
                            />
                          ) : (
                            <span
                              className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-red-50 text-xs font-bold text-red-700"
                              aria-hidden
                            >
                              PDF
                            </span>
                          )}
                          <span className="min-w-0 flex-1 break-all text-sm text-mrc-text">
                            {file.name}
                          </span>
                          <Button
                            type="button"
                            variant="secondary"
                            className="shrink-0 border-red-200 px-3 text-red-700 hover:border-red-400 focus-visible:ring-red-200"
                            onClick={() => removeTicketFile(index)}
                            aria-label={`Remove ${file.name}`}
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </FormField>
          </div>
        </Card>

        <Card as="section">
          <h3 className="mb-4 text-lg font-bold text-mrc-text">Your contact information</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField id="ticket-first-name" label="First name" required>
              {(controlProps) => (
                <Input
                  {...controlProps}
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  required
                />
              )}
            </FormField>
            <FormField id="ticket-last-name" label="Last name" required>
              {(controlProps) => (
                <Input
                  {...controlProps}
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  required
                />
              )}
            </FormField>
            <FormField id="ticket-phone" label="Phone number" required>
              {(controlProps) => (
                <Input
                  {...controlProps}
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  required
                />
              )}
            </FormField>
            <FormField id="ticket-email" label="Email">
              {(controlProps) => (
                <Input
                  {...controlProps}
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              )}
            </FormField>
          </div>
        </Card>

        {submitError && <StatusBanner tone="error">{submitError}</StatusBanner>}
        {submitOk && (
          <StatusBanner tone="success">
            Thanks — we received your information
            {ticketFiles.length > 0 ? " and your uploaded file(s)" : ""}. Reference:{" "}
            {submitOk.reference}. Someone will reach out using the phone number you provided.
          </StatusBanner>
        )}

        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? "Submitting…" : "Submit ticket info"}
        </Button>
        <p className="text-center text-xs leading-5 text-mrc-muted">
          This form does not constitute legal advice. By submitting, you agree we may contact you
          about this request using the information provided.
        </p>
      </form>
    </div>
  );
}
