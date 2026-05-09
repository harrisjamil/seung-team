"use client";

import { MobileNavDrawer } from "@/app/components/MobileNavDrawer";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { clearSession } from "@/app/lib/auth";
import { useCommunicationUnreadCount } from "@/app/lib/useCommunicationUnreadCount";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faAsterisk,
  faBars,
  faEnvelope,
  faRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

/** Same as `useRouter()` from App Router — avoid deep `next/dist` imports for types. */
type AppRouterInstance = ReturnType<
  typeof import("next/navigation").useRouter
>;

export function CommandHeader({
  connected: _connected,
  openAlertsCount: _openAlertsCount,
  distressedCount: _distressedCount,
  adverseCount: _adverseCount,
  router,
}: {
  connected: boolean;
  openAlertsCount: number;
  distressedCount: number;
  adverseCount: number;
  router: AppRouterInstance;
}) {
  const pathname = usePathname();
  const { count: commUnread } = useCommunicationUnreadCount();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navItems = [
    {
      label: "Home",
      href: "/command",
      active: pathname === "/command",
    },
    {
      label: "Communication",
      href: "/command/communication",
      active: pathname.startsWith("/command/communication"),
    },
    {
      label: "Assignments",
      href: "/command/assignments",
      active: pathname.startsWith("/command/assignments"),
    },
    {
      label: "Fleet ships",
      href: "/command/ships",
      active: pathname.startsWith("/command/ships"),
    },
    {
      label: "Users",
      href: "/command/users",
      active: pathname.startsWith("/command/users"),
    },
    {
      label: "Add API",
      href: "/command/api",
      active: pathname.startsWith("/command/api"),
    },
  ];

  const linkCommBadge =
    commUnread > 0 ? (
      <>
        <FontAwesomeIcon
          icon={faEnvelope}
          className="text-[10px] text-rose-100 dark:text-rose-200"
        />
        <span className="inline-flex min-h-[1rem] min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white">
          {commUnread > 99 ? "99+" : commUnread}
        </span>
      </>
    ) : null;

  return (
    <>
      <header className="sticky top-0 z-[100] w-full border-b border-slate-200/90 bg-white/95 shadow-[0_1px_0_rgba(15,23,42,0.06)] backdrop-blur-md supports-[backdrop-filter]:bg-white/90 dark:border-slate-700/90 dark:bg-slate-900/95 dark:shadow-[0_1px_0_rgba(0,0,0,0.35)] dark:supports-[backdrop-filter]:bg-slate-900/90">
        <div className="mx-auto flex h-12 w-full max-w-[1920px] items-center gap-2 px-3 sm:h-14 sm:gap-3 sm:px-4 lg:px-6">
          <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white dark:bg-sky-600">
              <FontAwesomeIcon icon={faAsterisk} className="text-xs" />
            </div>
            <span className="truncate text-base font-semibold text-slate-900 sm:text-lg dark:text-slate-100">
              Seung
            </span>
            <span className="hidden rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:inline">
              Command
            </span>
          </div>

          <nav
            aria-label="Command sections"
            className="hide-scrollbar hidden min-w-0 flex-1 items-center justify-center overflow-x-auto md:flex"
          >
            <ul className="flex w-max max-w-full items-center gap-0.5 sm:gap-1">
              {navItems.map((item) => (
                <li key={item.href} className="shrink-0">
                  <Link
                    href={item.href}
                    className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-2 text-[12px] font-semibold transition-colors sm:px-3 sm:text-[13px] ${
                      item.active
                        ? "bg-slate-900 text-white shadow-sm dark:bg-sky-600 dark:text-white"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.label === "Communication" ? linkCommBadge : null}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle />

            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 md:hidden"
              aria-label="Open navigation menu"
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen(true)}
            >
              <FontAwesomeIcon icon={faBars} className="text-lg" />
            </button>

            <button
              type="button"
              onClick={() => {
                clearSession();
                router.push("/");
              }}
              className="group inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 active:translate-y-px dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 sm:px-3 sm:text-xs"
            >
              <FontAwesomeIcon
                icon={faRightFromBracket}
                className="text-sm text-slate-600 dark:text-slate-300"
                aria-hidden
              />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <MobileNavDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} title="Command">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileNavOpen(false)}
            className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium ${
              item.active
                ? "bg-slate-900 text-white dark:bg-sky-600"
                : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <span>{item.label}</span>
            {item.label === "Communication" ? linkCommBadge : null}
          </Link>
        ))}
      </MobileNavDrawer>
    </>
  );
}
