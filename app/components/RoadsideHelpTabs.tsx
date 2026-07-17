"use client";

import { type KeyboardEvent, useRef, useState } from "react";
import { GotTicketForm } from "./GotTicketForm";
import { RoadsideAssistanceForm } from "./RoadsideAssistanceForm";
import { PlanTripWebview } from "./PlanTripWebview";

type TabId = "ticket" | "roadside" | "plan";

const tabs: { id: TabId; label: string }[] = [
  { id: "ticket", label: "Got a ticket?" },
  { id: "roadside", label: "Roadside Assistance" },
  { id: "plan", label: "Plan a Trip" },
];

export function RoadsideHelpTabs() {
  const [tab, setTab] = useState<TabId>("ticket");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function selectAndFocus(index: number) {
    setTab(tabs[index].id);
    tabRefs.current[index]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | undefined;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (index + 1) % tabs.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (index - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    selectAndFocus(nextIndex);
  }

  return (
    <div>
      <div
        className="grid grid-cols-3 gap-1 rounded-2xl border border-mrc-border bg-white p-1 shadow-sm sm:gap-2"
        role="tablist"
        aria-label="Member services"
      >
        {tabs.map(({ id, label }, index) => {
          const active = tab === id;

          return (
            <button
              key={id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={active}
              aria-controls={`panel-${id}`}
              tabIndex={active ? 0 : -1}
              className={
                active
                  ? "min-h-10 rounded-xl border border-mrc-primary bg-mrc-primary px-1.5 py-2 text-[11px] font-semibold leading-tight text-white shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-mrc-primary focus-visible:ring-offset-2 sm:px-3 sm:text-sm md:min-h-12"
                  : "min-h-10 rounded-xl border border-transparent bg-transparent px-1.5 py-2 text-[11px] font-semibold leading-tight text-mrc-muted outline-none transition-colors hover:bg-mrc-tint hover:text-mrc-primary focus-visible:ring-2 focus-visible:ring-mrc-primary focus-visible:ring-offset-2 sm:px-3 sm:text-sm md:min-h-12"
              }
              onClick={() => setTab(id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === "ticket" && (
        <div
          id="panel-ticket"
          role="tabpanel"
          aria-labelledby="tab-ticket"
          className="mt-4"
        >
          <GotTicketForm />
        </div>
      )}
      {tab === "roadside" && (
        <div
          id="panel-roadside"
          role="tabpanel"
          aria-labelledby="tab-roadside"
          className="mt-4"
        >
          <RoadsideAssistanceForm />
        </div>
      )}
      {tab === "plan" && (
        <div
          id="panel-plan"
          role="tabpanel"
          aria-labelledby="tab-plan"
          className="mt-4"
        >
          <PlanTripWebview />
        </div>
      )}
    </div>
  );
}
