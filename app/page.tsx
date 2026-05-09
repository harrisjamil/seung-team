import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-slate-100">
      <div className="max-w-xl text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-sky-400">
          Hormuz fleet · Code Rush baseline
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Strait crisis command system
        </h1>
        <p className="mt-4 text-slate-400">
          fifteen ships · websocket sync · routing & restricted zones · weather-aware fuel burn ·
          captain / command roles · optional distress NLP
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            href="/command"
            className="rounded-full bg-sky-600 px-6 py-3 text-sm font-medium text-white shadow hover:bg-sky-500"
          >
            Open command
          </Link>
          <Link
            href="/captain?ship=BRV-001"
            className="rounded-full border border-slate-600 px-6 py-3 text-sm font-medium text-slate-100 hover:border-slate-400"
          >
            Captain console
          </Link>
          <Link
            href="/playback"
            className="rounded-full border border-slate-600 px-6 py-3 text-sm font-medium text-slate-100 hover:border-slate-400"
          >
            Playback
          </Link>
        </div>
        <p className="mt-10 text-xs text-slate-500">
          Run the stack with Docker Compose (see README). Simulator defaults to{" "}
          <code className="text-slate-400">ws://localhost:8080</code>.
        </p>
      </div>
    </div>
  );
}
