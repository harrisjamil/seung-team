import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBell,
  faCheckCircle,
  faChevronDown,
  faClock,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import type { AlertRecord } from "@/lib/sim-types";
import { useState } from "react";

export function CommandAlertsFeed({
  alerts,
  openAlertsCount,
  onAcknowledgeAlert,
  filterShipId,
  allowAcknowledge = true,
}: {
  alerts: AlertRecord[];
  openAlertsCount: number;
  onAcknowledgeAlert: (alertId: string, resolved: boolean) => void;
  /** When set, only show alerts that reference this ship. */
  filterShipId?: string | null;
  /** Command can ack/resolve; captains see read-only stream. */
  allowAcknowledge?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const visibleAlerts = filterShipId
    ? alerts.filter((a) => a.shipIds.includes(filterShipId))
    : alerts;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
            <FontAwesomeIcon icon={faBell} className="text-sm" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Alerts Feed</p>
            <p className="text-[11px] text-slate-500">Real-time incident stream</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700">
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-rose-500" />
            {openAlertsCount}
          </span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {expanded ? "Collapse" : "Expand"}
            <FontAwesomeIcon
              icon={faChevronDown}
              className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {expanded && (
        <ul className="hide-scrollbar mt-3 max-h-[280px] space-y-2 overflow-y-auto">
          {visibleAlerts.map((a) => (
            <li
              key={a.id}
              className={`rounded-xl border p-3 transition-all ${
                a.resolved ? "border-slate-200 bg-slate-50 opacity-70" : "border-rose-200 bg-white shadow-sm"
              }`}
            >
              <div className="mb-1 flex items-start gap-2">
                <FontAwesomeIcon
                  icon={a.resolved ? faCheckCircle : faExclamationTriangle}
                  className={`mt-0.5 ${a.resolved ? "text-slate-400" : "text-rose-500"}`}
                />
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">{a.title}</div>
                  <div className="mt-0.5 text-xs text-slate-600">{a.detail}</div>
                </div>
              </div>
              {!a.resolved && allowAcknowledge && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-100 disabled:opacity-50"
                    onClick={() => onAcknowledgeAlert(a.id, false)}
                    disabled={a.acknowledged}
                  >
                    <FontAwesomeIcon icon={faClock} className="mr-1" />
                    {a.acknowledged ? "Acknowledged" : "Acknowledge"}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-all hover:bg-emerald-100"
                    onClick={() => onAcknowledgeAlert(a.id, true)}
                  >
                    <FontAwesomeIcon icon={faCheckCircle} className="mr-1" />
                    Resolve
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
