"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Square, Upload, Copy, CheckCircle, Link2, Loader2 } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { uploadRecording } from "@/lib/api/recording";
import {
  INTRO_PROMPT,
  INTRO_QUESTION,
  MAX_SECONDS,
  MEDIA_CONSTRAINTS,
  RECORDER_OPTIONS,
  fileExtensionFor,
  formatTime,
  pickMimeType,
  type RecordingMode,
} from "@/lib/recording";

type Status = "preparing" | "ready" | "recording" | "recorded" | "uploading" | "done";

const WAVEFORM_HEIGHTS = [16, 32, 48, 24, 40, 64, 40, 24, 48, 32, 16, 40, 20, 56, 28, 12];

export default function RecorderClient({ mode }: { mode: RecordingMode }) {
  const maxSeconds = MAX_SECONDS[mode];

  const [status, setStatus] = useState<Status>("preparing");
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [s3Url, setS3Url] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const router = useRouter();
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const startTimeRef = useRef(0);
  const mediaUrlRef = useRef<string | null>(null);
  const livePreviewRef = useRef<HTMLVideoElement | null>(null);
  // Bumped whenever a stream request is superseded (re-record, unmount, React
  // Strict Mode's double-invoke) so a late-resolving getUserMedia can tell that
  // its stream is no longer wanted and shut it down instead of leaking it.
  const requestIdRef = useRef(0);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const cancelPendingRequest = useCallback(() => {
    requestIdRef.current++;
  }, []);

  /**
   * Detaches the recorder's handlers before stopping it. Ending the stream's
   * tracks makes MediaRecorder queue `dataavailable` and `stop`, so on unmount
   * those handlers would otherwise still fire — creating an object URL after
   * the revoking cleanup has already run, or, on an empty blob, re-acquiring
   * the camera for a component that no longer exists.
   */
  const teardownRecorder = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;

    recorder.ondataavailable = null;
    recorder.onstop = null;
    if (recorder.state !== "inactive") recorder.stop();
    recorderRef.current = null;
  }, []);

  /**
   * Puts a live stream on `streamRef`, resolving true once it is ready and
   * false when the request was superseded or the devices are unavailable.
   * Owns no React state on purpose: callers update status from the
   * continuation, which keeps the mount effect free of a synchronous setState.
   */
  const acquireStream = useCallback(async (): Promise<boolean> => {
    const requestId = ++requestIdRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS[mode]);
      if (requestId !== requestIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      streamRef.current = stream;
      return true;
    } catch {
      if (requestId === requestIdRef.current) {
        // Permission was revoked, or the device is unavailable. The permissions
        // screen is the place that explains why and offers a retry.
        router.replace(`/permissions?mode=${mode}`);
      }
      return false;
    }
  }, [mode, router]);

  const restartPreview = useCallback(() => {
    setStatus("preparing");
    acquireStream().then((ready) => {
      if (ready) setStatus("ready");
    });
  }, [acquireStream]);

  useEffect(() => {
    acquireStream().then((ready) => {
      if (ready) setStatus("ready");
    });
    return () => {
      cancelPendingRequest();
      teardownRecorder();
      releaseStream();
    };
  }, [acquireStream, cancelPendingRequest, teardownRecorder, releaseStream]);

  // Revoke the last object URL only when the component goes away; swapping
  // recordings revokes the previous URL inline.
  useEffect(() => {
    return () => {
      if (mediaUrlRef.current) URL.revokeObjectURL(mediaUrlRef.current);
    };
  }, []);

  // The live preview element mounts and unmounts as the status changes, so
  // re-attach the stream whenever it comes back.
  useEffect(() => {
    if (livePreviewRef.current && streamRef.current) {
      livePreviewRef.current.srcObject = streamRef.current;
    }
  }, [status]);

  // Drive the timer off a start timestamp rather than an incrementing counter —
  // interval callbacks are throttled in background tabs, so a counter would
  // under-report and let a recording run past its limit.
  useEffect(() => {
    if (status !== "recording") return;

    const interval = setInterval(() => {
      const seconds = (Date.now() - startTimeRef.current) / 1000;
      setElapsed(Math.min(seconds, maxSeconds));
      if (seconds >= maxSeconds && recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
    }, 200);

    return () => clearInterval(interval);
  }, [status, maxSeconds]);

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;

    chunksRef.current = [];
    const mimeType = pickMimeType(mode);
    const recorder = new MediaRecorder(stream, {
      ...RECORDER_OPTIONS[mode],
      ...(mimeType ? { mimeType } : {}),
    });
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      const type = recorder.mimeType || mimeType || `${mode === "video" ? "video" : "audio"}/webm`;
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      releaseStream();

      if (blob.size === 0) {
        toast.error("Nothing was recorded. Please try again.");
        restartPreview();
        return;
      }

      const seconds = Math.min(Math.round((Date.now() - startTimeRef.current) / 1000), maxSeconds);
      blobRef.current = blob;
      setDuration(seconds);

      if (mediaUrlRef.current) URL.revokeObjectURL(mediaUrlRef.current);
      const url = URL.createObjectURL(blob);
      mediaUrlRef.current = url;
      setMediaUrl(url);
      setStatus("recorded");
    };

    // No timeslice: MediaRecorder emits a single chunk when it stops.
    recorder.start();
    startTimeRef.current = Date.now();
    setElapsed(0);
    setStatus("recording");
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const handleUpload = async () => {
    const blob = blobRef.current;
    if (!blob) return;

    setStatus("uploading");
    try {
      const filename = `intro.${fileExtensionFor(blob.type)}`;
      const result = await uploadRecording(mode, blob, duration, filename);

      if (!result.success || !result.data?.s3Url) {
        throw new Error(result.message || "Upload failed");
      }
      setS3Url(result.data.s3Url);
      setStatus("done");
    } catch (error: unknown) {
      setStatus("recorded");
      toast.error(error instanceof Error ? error.message : "Upload failed. Please try again.");
    }
  };

  const handleCopy = async () => {
    if (!s3Url) return;
    await navigator.clipboard.writeText(s3Url);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    if (mediaUrlRef.current) URL.revokeObjectURL(mediaUrlRef.current);
    mediaUrlRef.current = null;
    blobRef.current = null;
    setMediaUrl(null);
    setS3Url(null);
    setDuration(0);
    setElapsed(0);
    setCopied(false);
    restartPreview();
  };

  const isVideo = mode === "video";
  const showsLivePreview = isVideo && (status === "preparing" || status === "ready" || status === "recording");
  const timerSeconds = status === "recording" ? elapsed : status === "ready" || status === "preparing" ? 0 : duration;

  return (
    <div className="flex min-h-full flex-grow flex-col bg-slate-50 text-slate-900 antialiased">
      <Toaster position="top-center" />

      <main className="mx-auto flex w-full max-w-2xl flex-grow flex-col items-center justify-center gap-6 px-6 py-10">
        {status !== "done" && (
          <>
            {/* The question being answered */}
            <section className="w-full rounded-2xl border border-indigo-100 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                Your question
              </p>
              <h1 className="mt-2 text-xl font-semibold text-slate-900">{INTRO_QUESTION}</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{INTRO_PROMPT}</p>
            </section>

            <section className="relative w-full overflow-hidden rounded-[32px] bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div
                className="pointer-events-none absolute inset-0 opacity-20"
                style={{
                  background: "radial-gradient(circle at 50% 50%, #c7d2fe 0%, transparent 50%)",
                  mixBlendMode: "multiply",
                }}
              />

              <div className="relative flex flex-col items-center gap-6">
                {/* Timer */}
                <div className="flex items-baseline gap-2 font-mono tabular-nums">
                  <span className="text-5xl font-semibold tracking-tighter">
                    {formatTime(timerSeconds)}
                  </span>
                  <span className="text-lg text-slate-400">/ {formatTime(maxSeconds)}</span>
                </div>

                {/* Progress toward the limit */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-[width] duration-200 ease-linear"
                    style={{ width: `${Math.min(100, (timerSeconds / maxSeconds) * 100)}%` }}
                  />
                </div>

                {/* Viewfinder (video) or waveform (audio) */}
                {isVideo ? (
                  <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-slate-900">
                    {showsLivePreview && (
                      <video
                        ref={livePreviewRef}
                        autoPlay
                        muted
                        playsInline
                        className="h-full w-full scale-x-[-1] object-cover"
                      />
                    )}
                    {status === "recorded" || status === "uploading" ? (
                      mediaUrl && <video controls src={mediaUrl} className="h-full w-full object-contain" />
                    ) : null}
                    {status === "preparing" && (
                      <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Starting camera…
                      </div>
                    )}
                    {status === "recording" && (
                      <span className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                        Rec
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex h-20 w-full items-center justify-center gap-1">
                    {WAVEFORM_HEIGHTS.map((height, index) => (
                      <div
                        key={index}
                        className={`w-1.5 rounded-full transition-all duration-300 ${
                          status === "recording" ? "animate-pulse bg-indigo-600" : "bg-indigo-200"
                        }`}
                        style={{ height: `${height}px`, animationDelay: `${index * 80}ms` }}
                      />
                    ))}
                  </div>
                )}

                {/* Audio playback sits below the waveform */}
                {!isVideo && (status === "recorded" || status === "uploading") && mediaUrl && (
                  <audio controls src={mediaUrl} className="w-full" />
                )}

                {/* Controls */}
                {status === "preparing" && (
                  <p className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Getting your {isVideo ? "camera" : "microphone"} ready…
                  </p>
                )}

                {status === "ready" && (
                  <div className="flex flex-col items-center gap-3">
                    <button
                      type="button"
                      onClick={startRecording}
                      className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-600 text-white shadow-[0_0_40px_rgba(99,102,241,0.3)] transition-all duration-300 hover:shadow-[0_0_60px_rgba(99,102,241,0.5)] active:scale-95"
                    >
                      <span className="h-6 w-6 rounded-full bg-white" />
                    </button>
                    <p className="text-sm text-slate-400">
                      Press to start — recording stops automatically at {maxSeconds}s
                    </p>
                  </div>
                )}

                {status === "recording" && (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="flex items-center gap-2 rounded-full bg-red-100 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-red-900 transition-colors hover:bg-red-200"
                  >
                    <Square className="h-4 w-4 fill-current" />
                    Stop
                  </button>
                )}

                {status === "recorded" && (
                  <div className="flex w-full gap-3">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="flex-1 rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      Re-record
                    </button>
                    <button
                      type="button"
                      onClick={handleUpload}
                      className="flex flex-1 items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                    >
                      <Upload className="h-4 w-4" />
                      Upload
                    </button>
                  </div>
                )}

                {status === "uploading" && (
                  <div className="flex items-center gap-3 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                    Converting and uploading…
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {status === "done" && s3Url && (
          <section className="flex w-full flex-col rounded-xl border border-indigo-50/60 bg-white p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Intro saved</h2>
                  <p className="text-sm text-slate-500">
                    Your {isVideo ? "video" : "audio"} is ready to share
                  </p>
                </div>
              </div>
              <span className="flex-shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold tracking-wide text-slate-500">
                {formatTime(duration)}
              </span>
            </div>

            <div className="mt-1 flex flex-col items-stretch gap-3 rounded-lg border border-slate-200/60 bg-slate-50 p-2 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-grow items-center gap-2 px-3 font-mono text-xs text-slate-500">
                <Link2 className="h-4 w-4 flex-shrink-0 text-slate-400" />
                <span className="truncate">{s3Url}</span>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold tracking-wide text-white transition-colors hover:bg-indigo-700"
              >
                {copied ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied!" : "Copy Link"}
              </button>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="mt-5 self-center text-sm text-slate-400 transition-colors hover:text-slate-600"
            >
              Record another
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
