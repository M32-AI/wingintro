import type { Metadata } from "next";
import VoiceRecordingClient from "../components/VoiceRecordingClient";

export const metadata: Metadata = {
  title: "Voice Recording",
  description: "Record and upload your voice introduction",
};

export default function RecordPage() {
  return <VoiceRecordingClient />;
}
