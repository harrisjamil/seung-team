function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/80 ${className}`} />;
}

export function CommandHeaderSkeleton() {
  return (
    <div className="sticky top-0 z-[100] w-full border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto flex h-12 max-w-[1920px] items-center justify-between gap-3 px-3 sm:h-14 sm:px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <Pulse className="h-8 w-8 rounded-full dark:bg-slate-600" />
          <Pulse className="h-6 w-24 dark:bg-slate-600" />
        </div>
        <div className="hidden gap-2 md:flex">
          <Pulse className="h-8 w-14 rounded-lg dark:bg-slate-600" />
          <Pulse className="h-8 w-20 rounded-lg dark:bg-slate-600" />
          <Pulse className="h-8 w-16 rounded-lg dark:bg-slate-600" />
        </div>
        <div className="flex items-center gap-2">
          <Pulse className="h-10 w-10 rounded-lg dark:bg-slate-600" />
          <Pulse className="h-9 w-24 rounded-full dark:bg-slate-600" />
        </div>
      </div>
    </div>
  );
}

export function CommandCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex h-[150px] flex-col justify-between">
            <div className="flex justify-between">
              <Pulse className="h-5 w-8" />
              <Pulse className="h-5 w-24" />
            </div>
            <div className="space-y-2">
              <Pulse className="h-4 w-20" />
              <Pulse className="h-10 w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CommandAlertsFeedSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <Pulse className="h-14 w-full" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: 3 }).map((_, idx) => (
          <Pulse key={idx} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}

export function CommandLeftSidebarSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <Pulse className="mb-3 h-14 w-full" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, idx) => (
          <Pulse key={idx} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}

export function CommandMapPanelSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4">
        <Pulse className="h-12 w-full" />
      </div>
      <Pulse className="h-[560px] w-full rounded-none" />
    </div>
  );
}

export function CommandRightSidebarSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <Pulse className="mb-4 h-14 w-full" />
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Pulse key={idx} className="h-20 w-full" />
        ))}
      </div>
      <Pulse className="mt-4 h-48 w-full" />
    </div>
  );
}
