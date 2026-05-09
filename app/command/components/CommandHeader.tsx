import { clearSession } from "@/app/lib/auth";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faAnchor,
  faBell,
  faExclamationTriangle,
  faGlobe,
  faRightLong,
  faSatelliteDish,
  faShip,
  faWind,
  faChevronDown,
  faUserCircle,
} from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useState, useEffect } from "react";

export function CommandHeader({
  connected,
  openAlertsCount,
  distressedCount,
  adverseCount,
  router,
}: {
  connected: boolean;
  openAlertsCount: number;
  distressedCount: number;
  adverseCount: number;
  router: AppRouterInstance;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const statsCards = [
    {
      title: "Active Ships",
      value: "15",
      total: "15",
      icon: faShip,
      gradient: "from-sky-500 to-blue-600",
      bgGradient: "from-sky-50 to-blue-50",
      borderColor: "border-sky-200",
      iconBg: "bg-gradient-to-br from-sky-500 to-blue-600",
    },
    {
      title: "Open Alerts",
      value: openAlertsCount,
      icon: faBell,
      gradient: "from-rose-500 to-red-600",
      bgGradient: "from-rose-50 to-red-50",
      borderColor: "border-rose-200",
      iconBg: "bg-gradient-to-br from-rose-500 to-red-600",
      pulse: openAlertsCount > 0,
    },
    {
      title: "Distressed Vessels",
      value: distressedCount,
      icon: faExclamationTriangle,
      gradient: "from-amber-500 to-orange-600",
      bgGradient: "from-amber-50 to-orange-50",
      borderColor: "border-amber-200",
      iconBg: "bg-gradient-to-br from-amber-500 to-orange-600",
    },
    {
      title: "Adverse Weather",
      value: adverseCount,
      icon: faWind,
      gradient: "from-violet-500 to-purple-600",
      bgGradient: "from-violet-50 to-purple-50",
      borderColor: "border-violet-200",
      iconBg: "bg-gradient-to-br from-violet-500 to-purple-600",
    },
  ];

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 shadow-xl backdrop-blur-md"
          : "bg-white/80 shadow-lg backdrop-blur-sm"
      }`}
    >
      {/* Top Navigation Bar */}
      <div className="border-b border-slate-200 bg-white/50">
        <div className="mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Logo & Brand */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 opacity-20 blur-md" />
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 shadow-lg">
                  <FontAwesomeIcon
                    icon={faAnchor}
                    className="text-lg text-white drop-shadow-sm"
                  />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  Fleet Command
                </h1>
                <p className="text-xs text-slate-500">Hormuz Crisis · Live Ops</p>
              </div>
            </div>

            {/* Connection Status */}
            <div className="hidden items-center gap-3 md:flex">
              <div
                className={`flex items-center gap-2 rounded-full px-3 py-1 ${
                  connected
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                <div
                  className={`h-2 w-2 rounded-full ${
                    connected ? "bg-emerald-500" : "bg-amber-500"
                  } ${connected ? "animate-pulse" : ""}`}
                />
                <span className="text-xs font-medium">
                  {connected ? "Live Connection" : "Reconnecting"}
                </span>
                <FontAwesomeIcon
                  icon={faSatelliteDish}
                  className={`text-xs ${connected ? "text-emerald-500" : "text-amber-500"}`}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1 transition-all hover:bg-slate-100"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-white">
                    <FontAwesomeIcon icon={faUserCircle} className="text-lg" />
                  </div>
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    className={`text-xs text-slate-400 transition-transform duration-200 ${
                      showUserMenu ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {showUserMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowUserMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 z-50 w-48 rounded-lg border border-slate-200 bg-white shadow-lg">
                      <div className="p-2">
                        <Link
                          href="/command/api"
                          onClick={() => setShowUserMenu(false)}
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
                        >
                          <FontAwesomeIcon icon={faGlobe} className="w-4" />
                          Add API
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setShowUserMenu(false);
                            clearSession();
                            router.push("/");
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
                        >
                          <FontAwesomeIcon icon={faRightLong} className="w-4" />
                          Logout
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards Section */}
      <div className="mx-auto px-6 py-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statsCards.map((card, index) => (
            <div
              key={index}
              className={`group relative overflow-hidden rounded-xl border ${card.borderColor} bg-gradient-to-br ${card.bgGradient} p-4 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5`}
            >
              {/* Animated Background */}
              <div
                className={`absolute inset-0 bg-gradient-to-r ${card.gradient} opacity-0 transition-opacity duration-500 group-hover:opacity-5`}
              />
              
              <div className="relative flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {card.title}
                  </p>
                  <div className="mt-2 flex items-baseline gap-1">
                    <p className="text-3xl font-bold text-slate-900">
                      {card.value}
                    </p>
                    {card.total && (
                      <span className="text-sm text-slate-500">
                        /{card.total}
                      </span>
                    )}
                  </div>
                </div>
                
                <div
                  className={`rounded-lg ${card.iconBg} p-2.5 shadow-md ${
                    card.pulse ? "animate-pulse" : ""
                  }`}
                >
                  <FontAwesomeIcon
                    icon={card.icon}
                    className="text-base text-white"
                  />
                </div>
              </div>

              {/* Trend Indicator (optional) */}
              {card.title === "Active Ships" && (
                <div className="mt-3 flex items-center gap-1 text-xs text-emerald-600">
                  <span>▲ 100%</span>
                  <span className="text-slate-400">operational</span>
                </div>
              )}
              {card.title === "Open Alerts" && openAlertsCount > 0 && (
                <div className="mt-3 flex items-center gap-1 text-xs text-rose-600">
                  <span>⚠ {openAlertsCount}</span>
                  <span className="text-slate-400">requires attention</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="border-t border-slate-200 bg-white/30 px-6 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
              All systems operational
            </span>
            <span className="hidden sm:flex">Last updated: Just now</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-xs text-slate-500 transition-colors hover:text-slate-700">
              View Full Report →
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}