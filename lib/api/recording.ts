import type { RecordingMode } from "../recording";

export interface RecordingUploadResponse {
  success: boolean;
  data?: { s3Url: string; id: string };
  message?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

const ENDPOINTS: Record<RecordingMode, { path: string; field: string }> = {
  video: { path: "video-recording", field: "video" },
  audio: { path: "voice-recording", field: "audio" },
};

export async function uploadRecording(
  mode: RecordingMode,
  blob: Blob,
  duration: number,
  filename: string
): Promise<RecordingUploadResponse> {
  const { path, field } = ENDPOINTS[mode];

  const formData = new FormData();
  formData.append(field, blob, filename);
  formData.append("duration", String(duration));

  const response = await fetch(`${API_URL}/${path}/upload`, {
    method: "POST",
    body: formData,
  });

  // The API reports rejections (unsupported format, too long, rate limited) as
  // a JSON `message`, so read the body before falling back to the status line.
  const body = (await response.json().catch(() => null)) as RecordingUploadResponse | null;

  if (!response.ok) {
    throw new Error(body?.message ?? `Upload failed (${response.status} ${response.statusText})`);
  }

  if (!body) {
    throw new Error("Upload failed: the server returned an unreadable response.");
  }

  return body;
}
