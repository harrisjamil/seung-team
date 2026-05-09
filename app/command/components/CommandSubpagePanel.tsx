import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { ReactNode } from "react";

export type CommandSubpageBadge = {
  label: string;
  icon?: IconDefinition;
};

type CommandSubpagePanelProps = {
  icon: IconDefinition;
  title: string;
  subtitle: string;
  badges?: CommandSubpageBadge[];
  /** Optional right-side slot (e.g. small action) */
  headerAside?: ReactNode;
  children: ReactNode;
};

/**
 * Panel chrome aligned with {@link CommandMapPanel} / command dashboard cards.
 */
export function CommandSubpagePanel({
  icon,
  title,
  subtitle,
  badges,
  headerAside,
  children,
}: CommandSubpagePanelProps) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/20 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4 dark:border-slate-700 dark:from-slate-800/80 dark:to-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-sky-600">
              <FontAwesomeIcon icon={icon} className="text-sm" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                {title}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {badges?.map((b) => (
              <span
                key={b.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                {b.icon ? (
                  <FontAwesomeIcon icon={b.icon} className="text-[10px] text-slate-500 dark:text-slate-400" />
                ) : null}
                {b.label}
              </span>
            ))}
            {headerAside}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
