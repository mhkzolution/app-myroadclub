"use client";

import { useCallback, useMemo, useState } from "react";
import { googleMapsEmbedUrl, googleMapsUrl } from "../../lib/maps";
import {
  requestErrorMessage,
  submitRoadsideRequest,
  type RequestCreated,
  type RoadsideRequestPayload,
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
    <div className="ra-toggle-row">
      <span className="ra-toggle-label">{label}</span>
      <div className="ra-toggle" role="group" aria-label={label}>
        <button
          type="button"
          className={`ra-toggle-opt ${value ? "is-on" : ""}`}
          onClick={() => onChange(true)}
          aria-pressed={value}
        >
          Yes
        </button>
        <button
          type="button"
          className={`ra-toggle-opt ${!value ? "is-on" : ""}`}
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
    <div className="ra-form-shell">
      <header className="ra-form-header">
        <div className="ra-form-header-icon" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-2.7.6-4.5 1.1C10.7 11.3 10 12.1 10 13v3c0 .6.4 1 1 1h2" />
            <path d="M14 10a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v5" />
            <path d="M6 10v5" />
            <path d="M4 18h16" />
          </svg>
        </div>
        <h2 className="ra-form-title">Roadside Assistance Request</h2>
        <p className="ra-form-intro">
          Complete the form below for the fastest dispatch. For emergencies, call us 24/7.
        </p>
        <a className="ra-call-pill" href={telHref(ROADSIDE_PHONE)}>
          Call dispatch now
        </a>
      </header>

      <form className="ra-form" onSubmit={onSubmit} noValidate>
        <section className="ra-card">
          <h3 className="ra-card-title">Select service type</h3>
          <div className="ra-service-grid" role="list">
            {SERVICE_TYPES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="listitem"
                className={`ra-service-tile ${serviceType === s.id ? "is-selected" : ""}`}
                onClick={() => setServiceType(s.id)}
                aria-pressed={serviceType === s.id}
              >
                <span className="ra-service-icon">{s.icon}</span>
                <span className="ra-service-label">{s.label}</span>
              </button>
            ))}
          </div>
          <label className="ra-field">
            <span className="ra-field-label">Service details</span>
            <textarea
              className="ra-textarea"
              rows={4}
              placeholder="Describe the problem (e.g. left headlight on, flat rear driver-side tire)"
              value={serviceDetails}
              onChange={(e) => setServiceDetails(e.target.value)}
            />
          </label>
        </section>

        <section className="ra-card">
          <h3 className="ra-card-title">Customer information</h3>
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
          <div className="ra-row-2">
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
          <ToggleRow label="Member?" value={isMember} onChange={setIsMember} />
          {isMember && (
            <div className="ra-row-2 ra-mt">
              <label className="ra-field">
                <span className="ra-field-label">Account name</span>
                <input
                  className="ra-input"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                />
              </label>
              <label className="ra-field">
                <span className="ra-field-label">Membership ID</span>
                <input
                  className="ra-input"
                  value={membershipId}
                  onChange={(e) => setMembershipId(e.target.value)}
                />
              </label>
            </div>
          )}
        </section>

        <section className="ra-card">
          <h3 className="ra-card-title">Vehicle information</h3>
          <div className="ra-row-2">
            <label className="ra-field">
              <span className="ra-field-label">Year</span>
              <select
                className="ra-select"
                value={vehicleYear}
                onChange={(e) => setVehicleYear(e.target.value)}
              >
                <option value="">Select year</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label className="ra-field">
              <span className="ra-field-label">Make</span>
              <input
                className="ra-input"
                value={vehicleMake}
                onChange={(e) => setVehicleMake(e.target.value)}
              />
            </label>
          </div>
          <div className="ra-row-2">
            <label className="ra-field">
              <span className="ra-field-label">Model</span>
              <input
                className="ra-input"
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
              />
            </label>
            <label className="ra-field">
              <span className="ra-field-label">Color</span>
              <input
                className="ra-input"
                value={vehicleColor}
                onChange={(e) => setVehicleColor(e.target.value)}
              />
            </label>
          </div>
          <div className="ra-row-2">
            <label className="ra-field">
              <span className="ra-field-label">VIN</span>
              <input
                className="ra-input"
                value={vin}
                onChange={(e) => setVin(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="ra-field">
              <span className="ra-field-label">License plate</span>
              <input
                className="ra-input"
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
              />
            </label>
          </div>
          <ToggleRow
            label="Vehicle is at a safe location?"
            value={safeLocation}
            onChange={setSafeLocation}
          />
        </section>

        <section className="ra-card">
          <h3 className="ra-card-title">Service location (current location)</h3>
          <button
            type="button"
            className="ra-btn ra-btn-orange"
            onClick={getServiceLocation}
            disabled={serviceGpsLoading}
          >
            {serviceGpsLoading ? "Getting location…" : "Get current GPS location"}
          </button>
          {serviceGpsError && (
            <p className="ra-inline-error" role="alert">
              {serviceGpsError}
            </p>
          )}
          <div className="ra-row-2 ra-mt">
            <label className="ra-field ra-field-full">
              <span className="ra-field-label">Address</span>
              <input
                className="ra-input"
                value={serviceAddress}
                onChange={(e) => setServiceAddress(e.target.value)}
                autoComplete="street-address"
              />
            </label>
          </div>
          <div className="ra-row-3">
            <label className="ra-field">
              <span className="ra-field-label">City</span>
              <input
                className="ra-input"
                value={serviceCity}
                onChange={(e) => setServiceCity(e.target.value)}
              />
            </label>
            <label className="ra-field">
              <span className="ra-field-label">State</span>
              <input
                className="ra-input"
                value={serviceState}
                onChange={(e) => setServiceState(e.target.value)}
              />
            </label>
            <label className="ra-field">
              <span className="ra-field-label">ZIP code</span>
              <input
                className="ra-input"
                value={serviceZip}
                onChange={(e) => setServiceZip(e.target.value)}
              />
            </label>
          </div>
          {serviceCoords && (
            <>
              <div className="ra-map-wrap">
                <iframe
                  title="Service location on map"
                  src={googleMapsEmbedUrl(serviceCoords.lat, serviceCoords.lng)}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <p className="ra-coords">
                GPS: {serviceCoords.lat.toFixed(6)}, {serviceCoords.lng.toFixed(6)}{" "}
                <a
                  className="ra-link"
                  href={googleMapsUrl(serviceCoords.lat, serviceCoords.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Google Maps
                </a>
              </p>
            </>
          )}
        </section>

        {showTowingDest && (
          <section className="ra-card">
            <h3 className="ra-card-title">Drop-off location (for towing)</h3>
            <button
              type="button"
              className="ra-btn ra-btn-blue"
              onClick={getDestLocation}
              disabled={destGpsLoading}
            >
              {destGpsLoading ? "Getting location…" : "Select destination location"}
            </button>
            {destGpsError && (
              <p className="ra-inline-error" role="alert">
                {destGpsError}
              </p>
            )}
            <div className="ra-row-2 ra-mt">
              <label className="ra-field ra-field-full">
                <span className="ra-field-label">Destination address</span>
                <input
                  className="ra-input"
                  value={destAddress}
                  onChange={(e) => setDestAddress(e.target.value)}
                />
              </label>
            </div>
            <div className="ra-row-3">
              <label className="ra-field">
                <span className="ra-field-label">City</span>
                <input
                  className="ra-input"
                  value={destCity}
                  onChange={(e) => setDestCity(e.target.value)}
                />
              </label>
              <label className="ra-field">
                <span className="ra-field-label">State</span>
                <input
                  className="ra-input"
                  value={destState}
                  onChange={(e) => setDestState(e.target.value)}
                />
              </label>
              <label className="ra-field">
                <span className="ra-field-label">ZIP code</span>
                <input
                  className="ra-input"
                  value={destZip}
                  onChange={(e) => setDestZip(e.target.value)}
                />
              </label>
            </div>
            {destCoords && (
              <>
                <div className="ra-map-wrap">
                  <iframe
                    title="Destination on map"
                    src={googleMapsEmbedUrl(destCoords.lat, destCoords.lng)}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
                <p className="ra-coords">
                  GPS: {destCoords.lat.toFixed(6)}, {destCoords.lng.toFixed(6)}
                </p>
              </>
            )}
          </section>
        )}

        <section className="ra-card">
          <h3 className="ra-card-title">Additional options</h3>
          <div className="ra-row-2">
            <label className="ra-field">
              <span className="ra-field-label">Number of passengers</span>
              <select
                className="ra-select"
                value={passengers}
                onChange={(e) => setPassengers(e.target.value)}
              >
                <option value="">Select</option>
                {PASSENGERS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="ra-field">
              <span className="ra-field-label">Vehicle drive type</span>
              <select
                className="ra-select"
                value={driveType}
                onChange={(e) => setDriveType(e.target.value)}
              >
                <option value="">Select</option>
                {DRIVE_TYPES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ToggleRow
            label="Are you with the vehicle?"
            value={withVehicle}
            onChange={setWithVehicle}
          />
        </section>

        {submitError && (
          <p className="ra-banner-error" role="alert">
            {submitError}
          </p>
        )}
        {submitOk && (
          <p className="ra-banner-success" role="status">
            Thank you. Your request was received. Reference: {submitOk.reference}. If you need
            immediate help, call dispatch.
          </p>
        )}

        <button type="submit" className="ra-submit" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit service request"}
        </button>
        <p className="ra-disclaimer">
          By submitting, you agree we may contact you about this request using the information
          provided. Service subject to membership and program terms.
        </p>
      </form>
    </div>
  );
}
