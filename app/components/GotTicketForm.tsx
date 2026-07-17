"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMemberProfile } from "../hooks/useMemberProfile";
import { applyTicketProfileDefaults } from "../../lib/member-profile-form";
import {
  requestErrorMessage,
  submitTicketRequest,
  validateTicketFiles,
  type RequestCreated,
  type TicketRequestPayload,
} from "../../lib/wp-requests";

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

  useEffect(() => {
    if (!profile) return;

    setFirstName((current) =>
      applyTicketProfileDefaults(
        { firstName: current, lastName: "", phone: "", email: "" },
        profile
      ).firstName
    );
    setLastName((current) =>
      applyTicketProfileDefaults(
        { firstName: "", lastName: current, phone: "", email: "" },
        profile
      ).lastName
    );
    setPhone((current) =>
      applyTicketProfileDefaults(
        { firstName: "", lastName: "", phone: current, email: "" },
        profile
      ).phone
    );
    setEmail((current) =>
      applyTicketProfileDefaults(
        { firstName: "", lastName: "", phone: "", email: current },
        profile
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
    <div className="ra-form-shell">
      <header className="ra-form-header">
        <div className="ra-form-header-icon ra-form-header-icon-ticket" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
            <path d="M10 9H8" />
          </svg>
        </div>
        <h2 className="ra-form-title" id="got-ticket-title">
          Got a ticket?
        </h2>
        <p className="ra-form-intro">
          Tell us about your citation so our team can follow up with options and next steps.
        </p>
        <a className="ra-call-pill" href={telHref(ROADSIDE_PHONE)}>
          Call member services
        </a>
      </header>

      <form className="ra-form" onSubmit={onSubmit} noValidate aria-labelledby="got-ticket-title">
        <section className="ra-card">
          <h3 className="ra-card-title">Ticket details</h3>
          <label className="ra-field">
            <span className="ra-field-label">Citation or ticket number (if shown)</span>
            <input
              className="ra-input"
              value={citationNumber}
              onChange={(e) => setCitationNumber(e.target.value)}
              autoComplete="off"
            />
          </label>
          <div className="ra-row-2 ra-mt">
            <label className="ra-field">
              <span className="ra-field-label">Date of violation</span>
              <input
                className="ra-input"
                type="date"
                value={violationDate}
                onChange={(e) => setViolationDate(e.target.value)}
              />
            </label>
            <label className="ra-field">
              <span className="ra-field-label">Court date (if known)</span>
              <input
                className="ra-input"
                type="date"
                value={courtDate}
                onChange={(e) => setCourtDate(e.target.value)}
              />
            </label>
          </div>
          <div className="ra-row-2 ra-mt">
            <label className="ra-field">
              <span className="ra-field-label">State</span>
              <select
                className="ra-select"
                value={state}
                onChange={(e) => setState(e.target.value)}
              >
                <option value="">Select state</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="ra-field">
              <span className="ra-field-label">City</span>
              <input
                className="ra-input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </label>
          </div>
          <label className="ra-field ra-mt">
            <span className="ra-field-label">Violation type</span>
            <select
              className="ra-select"
              value={violationType}
              onChange={(e) => setViolationType(e.target.value)}
            >
              <option value="">Select type</option>
              {VIOLATION_TYPES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="ra-field ra-mt">
            <span className="ra-field-label">What happened? (optional)</span>
            <textarea
              className="ra-textarea"
              rows={4}
              placeholder="Brief description — location, officer notes on the ticket, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div className="ra-field ra-mt ra-ticket-upload">
            <span className="ra-field-label">Photo or scan of your ticket (optional)</span>
            <p className="ra-ticket-upload-hint">
              Clear photo of the full ticket — JPG, PNG, or PDF. Up to 10 files, 10 MB each and 50
              MB combined.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              className="ra-file-input-hidden"
              accept="image/jpeg,image/png,application/pdf"
              multiple
              onChange={onTicketFilesChange}
            />
            <button
              type="button"
              className="ra-file-upload-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" x2="12" y1="3" y2="15" />
              </svg>
              Upload ticket photos
            </button>
            {ticketFiles.length > 0 && (
              <ul className="ra-file-preview-list" aria-label="Selected files">
                {ticketFiles.map((file, index) => (
                  <li key={`${file.name}-${file.size}-${index}`} className="ra-file-preview-item">
                    {file.type.startsWith("image/") && previewUrls[index] ? (
                      <img
                        src={previewUrls[index]}
                        alt=""
                        className="ra-file-preview-thumb"
                      />
                    ) : (
                      <span className="ra-file-preview-pdf" aria-hidden>
                        PDF
                      </span>
                    )}
                    <span className="ra-file-preview-name">{file.name}</span>
                    <button
                      type="button"
                      className="ra-file-remove"
                      onClick={() => removeTicketFile(index)}
                      aria-label={`Remove ${file.name}`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="ra-card">
          <h3 className="ra-card-title">Your contact information</h3>
          <div className="ra-row-2">
            <label className="ra-field">
              <span className="ra-field-label">First name</span>
              <input
                className="ra-input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                required
              />
            </label>
            <label className="ra-field">
              <span className="ra-field-label">Last name</span>
              <input
                className="ra-input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                required
              />
            </label>
          </div>
          <div className="ra-row-2 ra-mt">
            <label className="ra-field">
              <span className="ra-field-label">Phone number</span>
              <input
                className="ra-input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                required
              />
            </label>
            <label className="ra-field">
              <span className="ra-field-label">Email</span>
              <input
                className="ra-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
          </div>
        </section>

        {submitError && (
          <p className="ra-banner-error" role="alert">
            {submitError}
          </p>
        )}
        {submitOk && (
          <p className="ra-banner-success" role="status">
            Thanks — we received your information
            {ticketFiles.length > 0 ? " and your uploaded file(s)" : ""}. Reference:{" "}
            {submitOk.reference}. Someone will reach out using the phone number you provided.
          </p>
        )}

        <button type="submit" className="ra-submit" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit ticket info"}
        </button>
        <p className="ra-disclaimer">
          This form does not constitute legal advice. By submitting, you agree we may contact you
          about this request using the information provided.
        </p>
      </form>
    </div>
  );
}
