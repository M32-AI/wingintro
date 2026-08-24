"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Video, Mic, ShieldCheck, AlertCircle, ArrowLeft } from "lucide-react";
import {
  MEDIA_CONSTRAINTS,
  MODE_COPY,
  mediaErrorMessage,
  type RecordingMode,
} from "@/lib/recording";

type Status = "idle" | "requesting" | "error";

export default function PermissionsClient({ mode }: { mode: RecordingMode }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const copy = MODE_COPY[mode];

  const requestAccess = async () => {
    setStatus("requesting");
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS[mode]);
      // Release the devices straight away — the grant persists for this origin,
      // so the record page re-acquires without prompting again. Holding the
      // stream across a route change would leave the camera light on here and
      // would not survive a reload anyway.
      stream.getTracks().forEach((track) => track.stop());
      router.push(`/record?mode=${mode}`);
    } catch (err) {
      setError(mediaErrorMessage(err, mode));
      setStatus("error");
    }
  };

  return (
    <main className="flex-grow flex flex-col items-center justify-center px-6 py-12 w-full max-w-xl mx-auto">
      <section className="w-full rounded-[32px] bg-white p-10 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
          <ShieldCheck className="h-8 w-8" />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {copy.devices} access
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">{copy.deviceBlurb}</p>

        <ul className="my-8 flex flex-col gap-3 text-left">
          {mode === "video" && (
            <li className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <Video className="h-5 w-5 flex-shrink-0 text-indigo-600" />
              <span className="text-sm font-medium text-slate-700">Camera</span>
            </li>
          )}
          <li className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
            <Mic className="h-5 w-5 flex-shrink-0 text-indigo-600" />
            <span className="text-sm font-medium text-slate-700">Microphone</span>
          </li>
        </ul>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-left">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
            <p className="text-sm leading-relaxed text-red-900">{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={requestAccess}
          disabled={status === "requesting"}
          className="w-full rounded-full bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
        >
          {status === "requesting"
            ? "Waiting for permission…"
            : status === "error"
              ? "Try again"
              : "Allow access"}
        </button>

        <p className="mt-5 text-xs text-slate-400">
          Your browser will ask you to confirm. Nothing is recorded until you press record.
        </p>
      </section>

      <Link
        href="/"
        className="mt-6 flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-slate-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Choose a different format
      </Link>
    </main>
  );
}
