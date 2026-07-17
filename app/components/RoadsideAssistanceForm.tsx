"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMemberProfile } from "../hooks/useMemberProfile";
import {
  applyRoadsideProfileDefaults,
  resolveRoadsideMemberToggleDefault,
  takeFirstRequestFormProfileDefaults,
} from "../../lib/member-profile-form";
import { googleMapsEmbedUrl, googleMapsUrl } from "../../lib/maps";
import {
  requestErrorMessage,
  submitRoadsideRequest,
  type RequestCreated,
  type RoadsideRequestPayload,
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

const SERVICE_TYPES = [
  {
    id: "jump-start",
    label: "Jump Start",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
  {
    id: "flat-tire",
    label: "Flat Tire",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    id: "fuel",
    label: "Fuel Delivery",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M3 22V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
        <path d="M19 8h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2" />
        <path d="M7 10h4" />
      </svg>
    ),
  },
  {
    id: "lockout",
    label: "Lockout",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    id: "winch",
    label: "Winch-out",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M12 22V8" />
        <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
        <circle cx="12" cy="5" r="3" />
      </svg>
    ),
  },
  {
    id: "towing",
    label: "Towing",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
        <path d="M15 18H9" />
        <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
        <circle cx="17" cy="18" r="2" />
        <circle cx="7" cy="18" r="2" />
      </svg>
    ),
  },
  {
    id: "battery",
    label: "Battery",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M16 18h2a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2" />
        <path d="M8 18H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2" />
        <path d="M12 6v12" />
      </svg>
    ),
  },
  {
    id: "other",
    label: "Other",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </svg>
    ),
  },
] as const;

type ServiceId = (typeof SERVICE_TYPES)[number]["id"];

const YEARS = Array.from({ length: 2026 - 1985 + 1 }, (_, i) => String(2026 - i));
const PASSENGERS = ["0", "1", "2", "3", "4", "5", "6", "7", "8+"];
const DRIVE_TYPES = ["FWD", "RWD", "AWD", "4WD", "Other"];

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <div
        className="grid grid-cols-2 overflow-hidden rounded-xl border border-mrc-border"
        role="group"
        aria-label={label}
      >
        <button
          type="button"
          className={
            value
              ? "min-h-11 min-w-20 bg-mrc-primary px-4 py-2.5 text-sm font-bold text-white focus-visible:z-10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mrc-cyan/30"
              : "min-h-11 min-w-20 bg-white px-4 py-2.5 text-sm font-bold text-mrc-text hover:bg-slate-50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mrc-cyan/30"
          }
          onClick={() => onChange(true)}
          aria-pressed={value}
        >
          Yes
        </button>
        <button
          type="button"
          className={
            !value
              ? "min-h-11 min-w-20 border-l border-mrc-border bg-mrc-primary px-4 py-2.5 text-sm font-bold text-white focus-visible:z-10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mrc-cyan/30"
              : "min-h-11 min-w-20 border-l border-mrc-border bg-white px-4 py-2.5 text-sm font-bold text-mrc-text hover:bg-slate-50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mrc-cyan/30"
          }
          onClick={() => onChange(false)}
          aria-pressed={!value}
        >
          No
        </button>
      </div>
    </div>
  );
}

export function RoadsideAssistanceForm() {
  const { profile } = useMemberProfile();
  const [serviceType, setServiceType] = useState<ServiceId | "">("");
  const [serviceDetails, setServiceDetails] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isMember, setIsMember] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [membershipId, setMembershipId] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vin, setVin] = useState("");
  const [plate, setPlate] = useState("");
  const [safeLocation, setSafeLocation] = useState(true);
  const [serviceAddress, setServiceAddress] = useState("");
  const [serviceCity, setServiceCity] = useState("");
  const [serviceState, setServiceState] = useState("");
  const [serviceZip, setServiceZip] = useState("");
  const [serviceCoords, setServiceCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [serviceGpsLoading, setServiceGpsLoading] = useState(false);
  const [serviceGpsError, setServiceGpsError] = useState<string | null>(null);

  const [destAddress, setDestAddress] = useState("");
  const [destCity, setDestCity] = useState("");
  const [destState, setDestState] = useState("");
  const [destZip, setDestZip] = useState("");
  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [destGpsLoading, setDestGpsLoading] = useState(false);
  const [destGpsError, setDestGpsError] = useState<string | null>(null);

  const [passengers, setPassengers] = useState("");
  const [driveType, setDriveType] = useState("");
  const [withVehicle, setWithVehicle] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState<RequestCreated | null>(null);
  const profileDefaultsAppliedRef = useRef(false);
  const memberToggleTouchedRef = useRef(false);

  useEffect(() => {
    const defaultsProfile = takeFirstRequestFormProfileDefaults(
      profileDefaultsAppliedRef.current,
      profile
    );
    if (!defaultsProfile) return;
    profileDefaultsAppliedRef.current = true;

    const defaultsFor = (
      field: keyof Omit<
        ReturnType<typeof applyRoadsideProfileDefaults>,
        "isMember"
      >,
      value: string
    ) =>
      applyRoadsideProfileDefaults(
        {
          firstName: "",
          lastName: "",
          phone: "",
          email: "",
          accountName: "",
          membershipId: "",
          isMember: false,
          [field]: value,
        },
        defaultsProfile
      )[field];

    setFirstName((current) => defaultsFor("firstName", current));
    setLastName((current) => defaultsFor("lastName", current));
    setPhone((current) => defaultsFor("phone", current));
    setEmail((current) => defaultsFor("email", current));
    setAccountName((current) => defaultsFor("accountName", current));
    setMembershipId((current) => defaultsFor("membershipId", current));
    setIsMember((current) =>
      resolveRoadsideMemberToggleDefault(memberToggleTouchedRef.current, current)
    );
  }, [profile]);

  const showTowingDest = serviceType === "towing";

  const fillFromReverse = useCallback(
    async (lat: number, lng: number, which: "service" | "dest") => {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(
          String(lat)
        )}&lon=${encodeURIComponent(String(lng))}&format=json`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) return;
        const data = (await res.json()) as { address?: Record<string, string> };
        const a = data.address;
        if (!a) return;
        const line = [a.house_number, a.road].filter(Boolean).join(" ").trim();
        const city = a.city || a.town || a.village || a.hamlet || "";
        const state = a.state || "";
        const zip = a.postcode || "";
        if (which === "service") {
          if (line) setServiceAddress(line);
          if (city) setServiceCity(city);
          if (state) setServiceState(state);
          if (zip) setServiceZip(zip);
        } else {
          if (line) setDestAddress(line);
          if (city) setDestCity(city);
          if (state) setDestState(state);
          if (zip) setDestZip(zip);
        }
      } catch {
        /* Address fields stay editable if reverse geocode is unavailable */
      }
    },
    []
  );

  const getServiceLocation = useCallback(() => {
    setServiceGpsError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setServiceGpsError("Location is not supported in this browser.");
      return;
    }
    setServiceGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setServiceCoords({ lat, lng });
        setServiceGpsLoading(false);
        await fillFromReverse(lat, lng, "service");
      },
      (err) => {
        setServiceGpsLoading(false);
        setServiceGpsError(
          err.message || "Could not get your location. Enable GPS and try again."
        );
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }, [fillFromReverse]);

  const getDestLocation = useCallback(() => {
    setDestGpsError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setDestGpsError("Location is not supported in this browser.");
      return;
    }
    setDestGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setDestCoords({ lat, lng });
        setDestGpsLoading(false);
        await fillFromReverse(lat, lng, "dest");
      },
      (err) => {
        setDestGpsLoading(false);
        setDestGpsError(
          err.message || "Could not get your location. Enable GPS and try again."
        );
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }, [fillFromReverse]);

  const payload = useMemo<RoadsideRequestPayload>(
    () => ({
      serviceType,
      serviceDetails,
      customer: {
        firstName,
        lastName,
        phone,
        email,
        isMember,
        accountName: isMember ? accountName : "",
        membershipId: isMember ? membershipId : "",
      },
      vehicle: {
        year: vehicleYear,
        make: vehicleMake,
        model: vehicleModel,
        color: vehicleColor,
        vin,
        plate,
        safeLocation,
      },
      serviceLocation: {
        address: serviceAddress,
        city: serviceCity,
        state: serviceState,
        zip: serviceZip,
        lat: serviceCoords?.lat,
        lng: serviceCoords?.lng,
      },
      dropOff: showTowingDest
        ? {
            address: destAddress,
            city: destCity,
            state: destState,
            zip: destZip,
            lat: destCoords?.lat,
            lng: destCoords?.lng,
          }
        : null,
      additional: {
        passengers,
        driveType,
        withVehicle,
      },
    }),
    [
      serviceType,
      serviceDetails,
      firstName,
      lastName,
      phone,
      email,
      isMember,
      accountName,
      membershipId,
      vehicleYear,
      vehicleMake,
      vehicleModel,
      vehicleColor,
      vin,
      plate,
      safeLocation,
      serviceAddress,
      serviceCity,
      serviceState,
      serviceZip,
      serviceCoords,
      showTowingDest,
      destAddress,
      destCity,
      destState,
      destZip,
      destCoords,
      passengers,
      driveType,
      withVehicle,
    ]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitOk(null);
    setSubmitError(null);
    if (!serviceType) {
      setSubmitError("Please select a service type.");
      return;
    }
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setSubmitError("Please enter your first name, last name, and phone number.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitRoadsideRequest(payload);
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
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-2.7.6-4.5 1.1C10.7 11.3 10 12.1 10 13v3c0 .6.4 1 1 1h2" />
            <path d="M14 10a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v5" />
            <path d="M6 10v5" />
            <path d="M4 18h16" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-mrc-text" id="roadside-request-title">
          Roadside Assistance Request
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-mrc-muted">
          Complete the form below for the fastest dispatch. For emergencies, call us 24/7.
        </p>
        <a
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-mrc-primary/30 bg-white px-4 py-2.5 text-sm font-bold text-mrc-primary transition hover:border-mrc-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mrc-cyan/30"
          href={telHref(ROADSIDE_PHONE)}
        >
          Call dispatch now
        </a>
      </header>

      <form
        className="space-y-4"
        onSubmit={onSubmit}
        noValidate
        aria-labelledby="roadside-request-title"
      >
        <Card as="section">
          <h3 className="mb-4 text-lg font-bold text-mrc-text">Select service type</h3>
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            role="group"
            aria-label="Select service type"
          >
            {SERVICE_TYPES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={
                  serviceType === s.id
                    ? "flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl border border-mrc-primary bg-mrc-primary/10 px-2 py-3 text-center text-sm font-bold text-mrc-primary shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mrc-cyan/30"
                    : "flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl border border-mrc-border bg-white px-2 py-3 text-center text-sm font-bold text-mrc-text transition hover:border-mrc-primary hover:text-mrc-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mrc-cyan/30"
                }
                onClick={() => setServiceType(s.id)}
                aria-pressed={serviceType === s.id}
              >
                <span className="size-6 [&>svg]:size-6" aria-hidden>
                  {s.icon}
                </span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
          <FormField id="roadside-service-details" label="Service details" className="mt-4">
            {(controlProps) => (
              <Textarea
                {...controlProps}
                rows={4}
                placeholder="Describe the problem (e.g. left headlight on, flat rear driver-side tire)"
                value={serviceDetails}
                onChange={(e) => setServiceDetails(e.target.value)}
                autoComplete="off"
              />
            )}
          </FormField>
        </Card>

        <Card as="section">
          <h3 className="mb-4 text-lg font-bold text-mrc-text">Customer information</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField id="roadside-first-name" label="First name" required>
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
            <FormField id="roadside-last-name" label="Last name" required>
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
            <FormField id="roadside-phone" label="Phone number" required>
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
            <FormField id="roadside-email" label="Email">
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
          <div className="mt-4">
            <ToggleRow
              label="Member?"
              value={isMember}
              onChange={(value) => {
                memberToggleTouchedRef.current = true;
                setIsMember(value);
              }}
            />
          </div>
          {isMember && (
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField id="roadside-account-name" label="Account name">
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    autoComplete="name"
                  />
                )}
              </FormField>
              <FormField id="roadside-membership-id" label="Membership ID">
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    type="text"
                    value={membershipId}
                    onChange={(e) => setMembershipId(e.target.value)}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                  />
                )}
              </FormField>
            </div>
          )}
        </Card>

        <Card as="section">
          <h3 className="mb-4 text-lg font-bold text-mrc-text">Vehicle information</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField id="roadside-vehicle-year" label="Year">
              {(controlProps) => (
                <Select
                  {...controlProps}
                  value={vehicleYear}
                  onChange={(e) => setVehicleYear(e.target.value)}
                  autoComplete="off"
                >
                  <option value="">Select year</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField id="roadside-vehicle-make" label="Make">
              {(controlProps) => (
                <Input
                  {...controlProps}
                  type="text"
                  value={vehicleMake}
                  onChange={(e) => setVehicleMake(e.target.value)}
                  autoComplete="off"
                />
              )}
            </FormField>
            <FormField id="roadside-vehicle-model" label="Model">
              {(controlProps) => (
                <Input
                  {...controlProps}
                  type="text"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  autoComplete="off"
                />
              )}
            </FormField>
            <FormField id="roadside-vehicle-color" label="Color">
              {(controlProps) => (
                <Input
                  {...controlProps}
                  type="text"
                  value={vehicleColor}
                  onChange={(e) => setVehicleColor(e.target.value)}
                  autoComplete="off"
                />
              )}
            </FormField>
            <FormField id="roadside-vin" label="VIN">
              {(controlProps) => (
                <Input
                  {...controlProps}
                  type="text"
                  value={vin}
                  onChange={(e) => setVin(e.target.value)}
                  maxLength={17}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                />
              )}
            </FormField>
            <FormField id="roadside-license-plate" label="License plate">
              {(controlProps) => (
                <Input
                  {...controlProps}
                  type="text"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                />
              )}
            </FormField>
          </div>
          <div className="mt-4">
            <ToggleRow
              label="Vehicle is at a safe location?"
              value={safeLocation}
              onChange={setSafeLocation}
            />
          </div>
        </Card>

        <Card as="section">
          <h3 className="mb-4 text-lg font-bold text-mrc-text">
            Service location (current location)
          </h3>
          <Button
            type="button"
            onClick={getServiceLocation}
            loading={serviceGpsLoading}
            className="w-full sm:w-auto"
          >
            {serviceGpsLoading ? "Getting location…" : "Get current GPS location"}
          </Button>
          {serviceGpsError && (
            <p className="mt-2 text-sm text-red-700" role="alert">
              {serviceGpsError}
            </p>
          )}
          <div className="mt-4">
            <FormField id="roadside-service-address" label="Address">
              {(controlProps) => (
                <Input
                  {...controlProps}
                  type="text"
                  value={serviceAddress}
                  onChange={(e) => setServiceAddress(e.target.value)}
                  autoComplete="section-service street-address"
                />
              )}
            </FormField>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormField id="roadside-service-city" label="City">
              {(controlProps) => (
                <Input
                  {...controlProps}
                  type="text"
                  value={serviceCity}
                  onChange={(e) => setServiceCity(e.target.value)}
                  autoComplete="section-service address-level2"
                />
              )}
            </FormField>
            <FormField id="roadside-service-state" label="State">
              {(controlProps) => (
                <Input
                  {...controlProps}
                  type="text"
                  value={serviceState}
                  onChange={(e) => setServiceState(e.target.value)}
                  autoComplete="section-service address-level1"
                />
              )}
            </FormField>
            <FormField id="roadside-service-zip" label="ZIP code">
              {(controlProps) => (
                <Input
                  {...controlProps}
                  type="text"
                  inputMode="numeric"
                  value={serviceZip}
                  onChange={(e) => setServiceZip(e.target.value)}
                  autoComplete="section-service postal-code"
                />
              )}
            </FormField>
          </div>
          {serviceCoords && (
            <>
              <div className="mt-4 overflow-hidden rounded-xl border border-mrc-border">
                <iframe
                  className="h-64 w-full"
                  title="Service location on map"
                  src={googleMapsEmbedUrl(serviceCoords.lat, serviceCoords.lng)}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <p className="mt-2 text-sm text-mrc-muted">
                GPS: {serviceCoords.lat.toFixed(6)}, {serviceCoords.lng.toFixed(6)}{" "}
                <a
                  className="font-semibold text-mrc-primary underline-offset-2 hover:underline"
                  href={googleMapsUrl(serviceCoords.lat, serviceCoords.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Google Maps
                </a>
              </p>
            </>
          )}
        </Card>

        {showTowingDest && (
          <Card as="section">
            <h3 className="mb-4 text-lg font-bold text-mrc-text">
              Drop-off location (for towing)
            </h3>
            <Button
              type="button"
              variant="secondary"
              onClick={getDestLocation}
              loading={destGpsLoading}
              className="w-full sm:w-auto"
            >
              {destGpsLoading ? "Getting location…" : "Select destination location"}
            </Button>
            {destGpsError && (
              <p className="mt-2 text-sm text-red-700" role="alert">
                {destGpsError}
              </p>
            )}
            <div className="mt-4">
              <FormField id="roadside-destination-address" label="Destination address">
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    type="text"
                    value={destAddress}
                    onChange={(e) => setDestAddress(e.target.value)}
                    autoComplete="section-destination street-address"
                  />
                )}
              </FormField>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormField id="roadside-destination-city" label="Destination city">
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    type="text"
                    value={destCity}
                    onChange={(e) => setDestCity(e.target.value)}
                    autoComplete="section-destination address-level2"
                  />
                )}
              </FormField>
              <FormField id="roadside-destination-state" label="Destination state">
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    type="text"
                    value={destState}
                    onChange={(e) => setDestState(e.target.value)}
                    autoComplete="section-destination address-level1"
                  />
                )}
              </FormField>
              <FormField id="roadside-destination-zip" label="Destination ZIP code">
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    type="text"
                    inputMode="numeric"
                    value={destZip}
                    onChange={(e) => setDestZip(e.target.value)}
                    autoComplete="section-destination postal-code"
                  />
                )}
              </FormField>
            </div>
            {destCoords && (
              <>
                <div className="mt-4 overflow-hidden rounded-xl border border-mrc-border">
                  <iframe
                    className="h-64 w-full"
                    title="Destination on map"
                    src={googleMapsEmbedUrl(destCoords.lat, destCoords.lng)}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
                <p className="mt-2 text-sm text-mrc-muted">
                  GPS: {destCoords.lat.toFixed(6)}, {destCoords.lng.toFixed(6)}
                </p>
              </>
            )}
          </Card>
        )}

        <Card as="section">
          <h3 className="mb-4 text-lg font-bold text-mrc-text">Additional options</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField id="roadside-passengers" label="Number of passengers">
              {(controlProps) => (
                <Select
                  {...controlProps}
                  value={passengers}
                  onChange={(e) => setPassengers(e.target.value)}
                >
                  <option value="">Select</option>
                  {PASSENGERS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField id="roadside-drive-type" label="Vehicle drive type">
              {(controlProps) => (
                <Select
                  {...controlProps}
                  value={driveType}
                  onChange={(e) => setDriveType(e.target.value)}
                >
                  <option value="">Select</option>
                  {DRIVE_TYPES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>
          <div className="mt-4">
            <ToggleRow
              label="Are you with the vehicle?"
              value={withVehicle}
              onChange={setWithVehicle}
            />
          </div>
        </Card>

        {submitError && <StatusBanner tone="error">{submitError}</StatusBanner>}
        {submitOk && (
          <StatusBanner tone="success">
            Thank you. Your request was received. Reference: {submitOk.reference}. If you need
            immediate help, call dispatch.
          </StatusBanner>
        )}

        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? "Submitting…" : "Submit service request"}
        </Button>
        <p className="text-center text-xs leading-5 text-mrc-muted">
          By submitting, you agree we may contact you about this request using the information
          provided. Service subject to membership and program terms.
        </p>
      </form>
    </div>
  );
}
