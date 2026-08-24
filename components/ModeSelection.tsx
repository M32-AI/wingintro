"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Video, Mic, ArrowRight, Check } from "lucide-react";
import { MAX_SECONDS, MODE_COPY, RECORDING_MODES, type RecordingMode } from "@/lib/recording";

const ICONS: Record<RecordingMode, typeof Video> = { video: Video, audio: Mic };

export default function ModeSelection() {
  const [selected, setSelected] = useState<RecordingMode | null>(null);
  const router = useRouter();

  const handleContinue = () => {
    if (!selected) return;
    router.push(`/permissions?mode=${selected}`);
  };

  return (
    <main className="flex-grow flex flex-col items-center justify-center px-6 py-12 w-full max-w-2xl mx-auto gap-10">
      <header className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Record your intro</h1>
        <p className="mt-3 text-slate-500">How would you like to introduce yourself?</p>
      </header>

      <div className="grid gap-4 w-full sm:grid-cols-2">
        {RECORDING_MODES.map((mode) => {
          const Icon = ICONS[mode];
          const copy = MODE_COPY[mode];
          const isSelected = selected === mode;

          return (
            <button
              key={mode}
              type="button"
              onClick={() => setSelected(mode)}
              aria-pressed={isSelected}
              className={`relative flex flex-col items-start gap-3 rounded-2xl border-2 bg-white p-6 text-left transition-all ${
                isSelected
                  ? "border-indigo-600 shadow-[0_8px_30px_rgb(99,102,241,0.15)]"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              {isSelected && (
                <span className="absolute top-4 right-4 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}

              <span
                className={`flex h-12 w-12 items-center justify-center rounded-full ${
                  isSelected ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600"
                }`}
              >
                <Icon className="h-6 w-6" />
              </span>

              <span className="text-lg font-semibold text-slate-900">{copy.label}</span>
              <span className="text-sm leading-relaxed text-slate-500">{copy.blurb}</span>
              <span className="mt-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                Up to {MAX_SECONDS[mode]}s
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleContinue}
        disabled={!selected}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 sm:w-auto sm:px-10"
      >
        Continue
        <ArrowRight className="h-4 w-4" />
      </button>
    </main>
  );
}
