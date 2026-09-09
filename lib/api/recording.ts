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

/**
 * The instruction the recruiter set for this particular request, if any.
 *
 * Every request used to show the same generic "Tell us about yourself", so a
 * role that needed a script read or one specific question answered had no way
 * to ask. The recruiter app stores the instruction against the candidate and
 * this reads it back by the same capability token that authorises the upload.
 *
 * Never throws and never blocks recording: no token, an expired one, or an API
 * that is down all mean "no custom instruction", and the recorder falls back to
 * its default question.
 */
export async function fetchIntroPrompt(
  token?: string | null
): Promise<string | null> {
  if (!token) return null;
  try {
    const res = await fetch(
      `${API_URL}/resume/intro-prompt?token=${encodeURIComponent(token)}`
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { prompt?: string | null } };
    const prompt = json?.data?.prompt;
    return typeof prompt === "string" && prompt.trim() ? prompt.trim() : null;
  } catch {
    return null;
  }
}

export async function uploadRecording(
  mode: RecordingMode,
  blob: Blob,
  duration: number,
  filename: string,
  token?: string | null
): Promise<RecordingUploadResponse> {
  const { path, field } = ENDPOINTS[mode];

  const formData = new FormData();
  formData.append(field, blob, filename);
  formData.append("duration", String(duration));
  // When the recorder was opened from a recruiter-minted link
  // (…/record?token=…), forward the token so the API can attach the finished
  // recording to that candidate. Absent it, this is a stand-alone recording.
  if (token) formData.append("token", token);

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
