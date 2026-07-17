"use client";

export const PLAN_TRIP_URL = "https://myroadclub.com";

export function PlanTripWebview() {
  return (
    <div className="ra-plan-shell">
      <div className="ra-plan-iframe-wrap">
        <iframe
          title="Plan a Trip"
          src={PLAN_TRIP_URL}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
