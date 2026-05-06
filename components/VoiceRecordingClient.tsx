"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Square, Upload, Copy, CheckCircle, Settings, Link2 } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { uploadVoiceRecording } from "../lib/api/voiceRecording";

type Status = "idle" | "requesting" | "recording" | "recorded" | "uploading" | "done";

const MAX_SECONDS = 30;

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `00:${m}:${s}`;
};

const WAVEFORM_HEIGHTS = [16, 32, 48, 24, 40, 64, 40, 24, 48, 32, 16, 40, 20, 56, 28, 12];

export default function VoiceRecordingClient() {
  const [status, setStatus] = useState<Status>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [s3Url, setS3Url] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [copied, setCopied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, []);

  useEffect(() => {
    if (status !== "recording") return;
    const interval = setInterval(() => {
      setElapsed((e) => {
        const next = e + 1;
        if (next >= MAX_SECONDS) {
          mediaRecorderRef.current?.stop();
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  const startRecording = async () => {
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      setElapsed(0);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const dur = Math.round((Date.now() - startTimeRef.current) / 1000);
        setRecordingDuration(Math.min(dur, MAX_SECONDS));
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setStatus("recorded");
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      startTimeRef.current = Date.now();
      setStatus("recording");
    } catch {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      chunksRef.current = [];
      mediaRecorderRef.current = null;
      setStatus("idle");
      toast.error("Microphone access denied. Please allow microphone access and try again.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  const handleUpload = async () => {
    if (!audioBlob) return;
    setStatus("uploading");
    try {
      const result = await uploadVoiceRecording(audioBlob, recordingDuration);
      if (result.success && result.data?.s3Url) {
        setS3Url(result.data.s3Url);
        setStatus("done");
      } else {
        throw new Error(result.message || "Upload failed");
      }
    } catch (err: unknown) {
      setStatus("recorded");
      toast.error(err instanceof Error ? err.message : "Upload failed. Please try again.");
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
    setStatus("idle");
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setS3Url(null);
    setElapsed(0);
    setCopied(false);
  };

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen flex flex-col font-sans antialiased">
      <Toaster position="top-center" />

      <main className="flex-grow flex flex-col items-center justify-center px-6 py-10 max-w-7xl mx-auto w-full gap-10 pb-28 md:pb-10">

        {/* Recording Card */}
        {status !== "done" && (
          <section className="flex flex-col items-center justify-center w-full max-w-2xl bg-white rounded-[32px] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{ background: "radial-gradient(circle at 50% 50%, #c7d2fe 0%, transparent 50%)", mixBlendMode: "multiply" }}
            />

            {/* Timer */}
            <div className="text-5xl font-mono font-semibold tracking-tighter text-slate-900 mb-10 tabular-nums">
              {formatTime(status === "recording" ? elapsed : status === "recorded" || status === "uploading" ? recordingDuration : 0)}
            </div>

            {/* Main action button */}
            {(status === "idle" || status === "requesting") && (
              <button
                onClick={startRecording}
                disabled={status === "requesting"}
                className="relative flex items-center justify-center w-32 h-32 rounded-full bg-indigo-600 text-white shadow-[0_0_40px_rgba(99,102,241,0.3)] hover:shadow-[0_0_60px_rgba(99,102,241,0.5)] transition-all duration-300 active:scale-95 mb-10 disabled:opacity-60"
              >
                <div className="absolute inset-0 rounded-full border-4 border-white/20 scale-110 opacity-50 pointer-events-none" />
                <Mic className="w-12 h-12" />
              </button>
            )}

            {status === "recording" && (
              <button
                onClick={stopRecording}
                className="relative flex items-center justify-center w-32 h-32 rounded-full bg-indigo-600 text-white shadow-[0_0_40px_rgba(99,102,241,0.3)] hover:shadow-[0_0_60px_rgba(99,102,241,0.5)] transition-all duration-300 active:scale-95 mb-10"
              >
                <div className="absolute inset-0 rounded-full border-4 border-white/20 scale-110 opacity-50 pointer-events-none" />
                <Square className="w-12 h-12 fill-current" />
              </button>
            )}

            {(status === "recorded" || status === "uploading") && (
              <div className="flex items-center justify-center w-32 h-32 rounded-full bg-indigo-50 mb-10">
                <Mic className="w-12 h-12 text-indigo-300" />
              </div>
            )}

            {/* Waveform */}
            <div className="w-full flex items-center justify-center gap-1 h-16">
              {WAVEFORM_HEIGHTS.map((h, i) => (
                <div
                  key={i}
                  className={`w-1.5 rounded-full transition-all duration-300 ${
                    status === "recording" ? "bg-indigo-600 animate-pulse" : "bg-indigo-200"
                  }`}
                  style={{ height: `${h}px`, animationDelay: `${i * 80}ms` }}
                />
              ))}
            </div>

            {/* Contextual controls */}
            <div className="flex items-center justify-center gap-4 mt-6 w-full">
              {status === "idle" && (
                <p className="text-sm text-slate-400">Click the button to start recording</p>
              )}
              {status === "requesting" && (
                <p className="text-sm text-slate-400">Requesting microphone access…</p>
              )}
              {status === "recording" && (
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-2 px-6 py-3 rounded-full bg-red-100 hover:bg-red-200 text-red-900 text-xs font-semibold tracking-wide uppercase transition-colors"
                >
                  <Square className="w-4 h-4" />
                  Stop
                </button>
              )}
              {status === "recorded" && audioUrl && (
                <div className="flex flex-col items-center gap-4 w-full">
                  <audio controls src={audioUrl} className="w-full" />
                  <div className="flex gap-3 w-full">
                    <button
                      onClick={handleReset}
                      className="flex-1 px-4 py-2.5 rounded-full border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
                    >
                      Re-record
                    </button>
                    <button
                      onClick={handleUpload}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Upload
                    </button>
                  </div>
                </div>
              )}
              {status === "uploading" && (
                <div className="flex items-center gap-3 text-slate-400 text-sm">
                  <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  Converting and uploading…
                </div>
              )}
            </div>
          </section>
        )}

        {/* Saved Card */}
        {status === "done" && s3Url && (
          <section className="flex flex-col w-full max-w-2xl bg-white rounded-xl p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-indigo-50/60">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Recording Saved</h3>
                  <p className="text-sm text-slate-500">Your audio is ready to share</p>
                </div>
              </div>
              <span className="text-xs font-semibold tracking-wide text-slate-500 px-3 py-1 bg-slate-100 rounded-full flex-shrink-0">
                {formatTime(recordingDuration)}
              </span>
            </div>

            {/* Link sharing */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-1 bg-slate-50 rounded-lg p-2 border border-slate-200/60">
              <div className="flex-grow flex items-center gap-2 px-3 text-slate-500 font-mono text-xs min-w-0">
                <Link2 className="w-4 h-4 flex-shrink-0 text-slate-400" />
                <span className="truncate">{s3Url}</span>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold tracking-wide hover:bg-indigo-700 transition-colors whitespace-nowrap"
              >
                {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy Link"}
              </button>
            </div>

            <button
              onClick={handleReset}
              className="mt-5 text-sm text-slate-400 hover:text-slate-600 transition-colors self-center"
            >
              Record another
            </button>
          </section>
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden bg-white/90 backdrop-blur-lg fixed bottom-0 left-0 w-full rounded-t-2xl border-t border-slate-100 shadow-[0_-8px_30px_rgb(0,0,0,0.04)] z-50 flex justify-around items-center px-4 pb-6 pt-3">
        <button className="flex flex-col items-center justify-center text-indigo-600">
          <Mic className="w-6 h-6 mb-1" />
          <span className="text-[10px] font-semibold uppercase tracking-wider">Record</span>
        </button>
        <button className="flex flex-col items-center justify-center text-slate-400 hover:text-indigo-500 transition-colors">
          <Settings className="w-6 h-6 mb-1" />
          <span className="text-[10px] font-semibold uppercase tracking-wider">Settings</span>
        </button>
      </nav>
    </div>
  );
}
