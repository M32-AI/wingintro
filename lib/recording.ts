export type RecordingMode = "video" | "audio";

export const RECORDING_MODES: readonly RecordingMode[] = ["video", "audio"] as const;

export function isRecordingMode(value: unknown): value is RecordingMode {
  return value === "video" || value === "audio";
}

export const MAX_SECONDS: Record<RecordingMode, number> = {
  video: 60,
  audio: 30,
};

export const INTRO_QUESTION = "Tell us about yourself";
export const INTRO_PROMPT =
  "Who you are, what you do, and what you're looking for. Keep it natural — like you're introducing yourself to a new colleague.";

export const MODE_COPY: Record<
  RecordingMode,
  { label: string; blurb: string; devices: string; deviceBlurb: string }
> = {
  video: {
    label: "Video intro",
    blurb: "Record up to one minute of video. Best if you want to be seen as well as heard.",
    devices: "Camera and microphone",
    deviceBlurb: "We need your camera and microphone to record your video intro.",
  },
  audio: {
    label: "Audio intro",
    blurb: "Record up to thirty seconds of audio. Quicker, and no need to be on camera.",
    devices: "Microphone",
    deviceBlurb: "We need your microphone to record your audio intro.",
  },
};

export const MEDIA_CONSTRAINTS: Record<RecordingMode, MediaStreamConstraints> = {
  video: {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
      facingMode: "user",
    },
    audio: true,
  },
  audio: { audio: true },
};

// Chrome defaults to roughly 2.5 Mbps of video, which puts a full minute at
// ~18 MB — past the server's upload limit. Pinning the bitrate keeps a 60 s
// 720p clip around 8 MB, which is plenty for a talking head.
export const RECORDER_OPTIONS: Record<RecordingMode, MediaRecorderOptions> = {
  video: { videoBitsPerSecond: 1_000_000, audioBitsPerSecond: 64_000 },
  audio: { audioBitsPerSecond: 128_000 },
};

// VP8 before VP9: noticeably cheaper to encode on low-end machines, and at
// this bitrate the quality difference on a webcam feed is not worth dropped
// frames. Safari only offers MP4, so it sits last as the fallback.
const MIME_CANDIDATES: Record<RecordingMode, string[]> = {
  video: ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm", "video/mp4"],
  audio: ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"],
};

export function pickMimeType(mode: RecordingMode): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_CANDIDATES[mode].find((type) => MediaRecorder.isTypeSupported(type));
}

export function fileExtensionFor(mimeType: string | undefined): string {
  const container = (mimeType ?? "").split(";")[0].split("/")[1];
  return container === "mp4" ? "mp4" : "webm";
}

export function formatTime(totalSeconds: number): string {
  const whole = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(whole / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (whole % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/**
 * Turns a getUserMedia rejection into something a person can act on. The
 * browser reports these as DOMExceptions whose `name` is the useful part —
 * the `message` is vendor-specific and often empty.
 */
export function mediaErrorMessage(error: unknown, mode: RecordingMode): string {
  const name = error instanceof DOMException ? error.name : "";
  const devices = mode === "video" ? "camera and microphone" : "microphone";

  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return `Access was blocked. Allow ${devices} access for this site in your browser settings, then try again.`;
    case "NotFoundError":
    case "DevicesNotFoundError":
      return `No ${devices} found. Connect a device and try again.`;
    case "NotReadableError":
    case "TrackStartError":
      return `Your ${devices} is already in use by another app. Close it and try again.`;
    case "OverconstrainedError":
      return `Your ${devices} doesn't support the required settings.`;
    default:
      return `Couldn't access your ${devices}. Please try again.`;
  }
}
