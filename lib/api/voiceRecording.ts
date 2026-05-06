export interface VoiceUploadResponse {
  success: boolean;
  data?: { s3Url: string; id: string };
  message?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export async function uploadVoiceRecording(
  blob: Blob,
  duration: number
): Promise<VoiceUploadResponse> {
  const formData = new FormData();
  formData.append("audio", blob, "recording.webm");
  formData.append("duration", String(duration));

  const response = await fetch(`${API_URL}/voice-recording/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  return response.json() as Promise<VoiceUploadResponse>;
}
