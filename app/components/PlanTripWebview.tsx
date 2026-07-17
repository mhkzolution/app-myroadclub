"use client";

export const PLAN_TRIP_URL = "https://myroadclub.com";

export function PlanTripWebview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-mrc-primary/20 bg-[var(--mrc-gradient-panel)] shadow-[0_8px_28px_var(--mrc-shadow-primary)]">
      <div className="relative h-[68dvh] min-h-80 max-h-[620px] w-full bg-white">
        <iframe
          className="absolute inset-0 size-full border-0"
          title="Plan a Trip"
          src={PLAN_TRIP_URL}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
