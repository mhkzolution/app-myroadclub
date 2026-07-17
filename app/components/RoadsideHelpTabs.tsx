"use client";

import { useState } from "react";
import { GotTicketForm } from "./GotTicketForm";
import { RoadsideAssistanceForm } from "./RoadsideAssistanceForm";
import { PlanTripWebview } from "./PlanTripWebview";

type TabId = "ticket" | "roadside" | "plan";

export function RoadsideHelpTabs() {
  const [tab, setTab] = useState<TabId>("ticket");

  return (
    <div className="ra-help-tabs">
      <div className="ra-tablist ra-tablist-three" role="tablist" aria-label="Member services">
        <button
          type="button"
          role="tab"
          id="tab-ticket"
          aria-selected={tab === "ticket"}
          aria-controls="panel-ticket"
          className={`ra-tab ${tab === "ticket" ? "is-active" : ""}`}
          onClick={() => setTab("ticket")}
        >
          Got a ticket?
        </button>
        <button
          type="button"
          role="tab"
          id="tab-roadside"
          aria-selected={tab === "roadside"}
          aria-controls="panel-roadside"
          className={`ra-tab ${tab === "roadside" ? "is-active" : ""}`}
          onClick={() => setTab("roadside")}
        >
          Roadside Assistance
        </button>
        <button
          type="button"
          role="tab"
          id="tab-plan"
          aria-selected={tab === "plan"}
          aria-controls="panel-plan"
          className={`ra-tab ${tab === "plan" ? "is-active" : ""}`}
          onClick={() => setTab("plan")}
        >
          Plan a Trip
        </button>
      </div>

      {tab === "ticket" && (
        <div
          id="panel-ticket"
          role="tabpanel"
          aria-labelledby="tab-ticket"
          className="ra-tab-panel"
        >
          <GotTicketForm />
        </div>
      )}
      {tab === "roadside" && (
        <div
          id="panel-roadside"
          role="tabpanel"
          aria-labelledby="tab-roadside"
          className="ra-tab-panel"
        >
          <RoadsideAssistanceForm />
        </div>
      )}
      {tab === "plan" && (
        <div
          id="panel-plan"
          role="tabpanel"
          aria-labelledby="tab-plan"
          className="ra-tab-panel"
        >
          <PlanTripWebview />
        </div>
      )}
    </div>
  );
}
