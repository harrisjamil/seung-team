import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faCheckCircle,
  faExclamationTriangle,
  faPen,
  faShip,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import type { FleetShipRuntime } from "@/lib/sim-types";
import { useEffect, useRef, useState } from "react";
import { shipTypeVisual } from "./shipVisuals";

export function CommandLeftSidebar({
  ships,
  selectedId,
  onSelectShip,
  shipManagementEnabled = false,
  onEditShip,
  onDeleteShip,
}: {
  ships: FleetShipRuntime[];
  selectedId: string | null;
  onSelectShip: (id: string) => void;
  shipManagementEnabled?: boolean;
  onEditShip?: (ship: FleetShipRuntime) => void;
  onDeleteShip?: (ship: FleetShipRuntime) => void;
}) {
  const rosterListRef = useRef<HTMLUListElement | null>(null);
  const [showRosterScrollHint, setShowRosterScrollHint] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    ship: FleetShipRuntime;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = rosterListRef.current;
    if (!el) return;
    const hasMoreBelow = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    setShowRosterScrollHint(hasMoreBelow);
  }, [ships.length]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      close();
    };
    const t = window.setTimeout(() => {
      window.addEventListener("mousedown", onDown, true);
    }, 0);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) return;
    const el = menuRef.current;
    if (!el) return;
    const pad = 8;
    const rw = el.offsetWidth || 160;
    const rh = el.offsetHeight || 100;
    let left = contextMenu.x;
    let top = contextMenu.y;
    if (left + rw > window.innerWidth - pad) left = window.innerWidth - rw - pad;
    if (top + rh > window.innerHeight - pad) top = window.innerHeight - rh - pad;
    if (left < pad) left = pad;
    if (top < pad) top = pad;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, s: FleetShipRuntime) => {
    if (!shipManagementEnabled || (!onEditShip && !onDeleteShip)) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, ship: s });
  };

  return (
    <>
      <aside className="flex flex-col gap-4 overflow-hidden rounded-2xl border border-slate-200/60 bg-white/80 shadow-lg shadow-slate-200/20 backdrop-blur-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white">
                <FontAwesomeIcon icon={faShip} className="text-sm" />
              </div>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                  Fleet Roster
                </h2>
                <p className="text-xs font-medium text-slate-500">{ships.length} Vessels</p>
              </div>
              <span className="ml-auto rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white">
                Live
              </span>
            </div>
            {shipManagementEnabled ? (
              <p className="mt-2 text-[11px] leading-snug text-slate-500">
                Right-click a vessel to edit or remove.
              </p>
            ) : null}
          </div>
        </div>

        <div className="relative px-3 pb-3">
          <ul
            ref={rosterListRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              const hasMoreBelow = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
              setShowRosterScrollHint(hasMoreBelow);
            }}
            className="hide-scrollbar max-h-[460px] space-y-2 overflow-y-auto pb-8"
          >
            {ships.map((s) => {
              const typeVisual = shipTypeVisual(s);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSelectShip(s.id)}
                    onContextMenu={(e) => handleContextMenu(e, s)}
                    className={`group w-full rounded-2xl border px-3.5 py-3 text-left transition-all duration-200 ${
                      selectedId === s.id
                        ? "border-sky-300 bg-gradient-to-r from-sky-100 to-blue-50 shadow-md shadow-sky-100/60"
                        : s.status === "distressed"
                          ? "animate-pulse border-red-300 bg-gradient-to-r from-red-50 to-rose-50 hover:border-red-400"
                          : "border-slate-200/80 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:bg-gradient-to-r hover:from-slate-50 hover:to-gray-50 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                          s.status === "distressed"
                            ? "bg-red-100"
                            : selectedId === s.id
                              ? "bg-sky-100"
                              : "bg-slate-100 group-hover:bg-slate-200"
                        }`}
                      >
                        <FontAwesomeIcon
                          icon={typeVisual.icon}
                          className={`text-sm ${
                            s.status === "distressed"
                              ? "text-red-500"
                              : selectedId === s.id
                                ? "text-sky-600"
                                : typeVisual.accentClass
                          }`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-semibold text-slate-900">
                          {s.name}
                        </div>
                        <div className="text-xs font-medium capitalize text-slate-500">
                          {s.status} · {s.fuelTonnes.toFixed(0)}t fuel
                        </div>
                      </div>
                      {s.status === "distressed" && (
                        <FontAwesomeIcon
                          icon={faExclamationTriangle}
                          className="animate-pulse text-red-500"
                        />
                      )}
                      {selectedId === s.id && (
                        <FontAwesomeIcon icon={faCheckCircle} className="text-sky-500" />
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          {showRosterScrollHint && (
            <div className="pointer-events-none absolute bottom-2 left-3 right-3 flex justify-center bg-gradient-to-t from-white via-white/80 to-transparent py-2">
              <div className="grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-white shadow-md">
                <FontAwesomeIcon
                  icon={faChevronDown}
                  className="animate-bounce text-[10px]"
                />
              </div>
            </div>
          )}
        </div>
      </aside>

      {contextMenu && shipManagementEnabled ? (
        <div
          ref={menuRef}
          className="fixed z-[100] min-w-[160px] rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {onEditShip ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
              onClick={() => {
                onEditShip(contextMenu.ship);
                setContextMenu(null);
              }}
            >
              <FontAwesomeIcon icon={faPen} className="text-slate-500" />
              Edit vessel
            </button>
          ) : null}
          {onDeleteShip ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-rose-700 hover:bg-rose-50"
              onClick={() => {
                onDeleteShip(contextMenu.ship);
                setContextMenu(null);
              }}
            >
              <FontAwesomeIcon icon={faTrash} className="text-rose-500" />
              Delete vessel
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
