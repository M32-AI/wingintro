import type { Metadata } from "next";
import { redirect } from "next/navigation";
import RecorderClient from "@/components/RecorderClient";
import { isRecordingMode } from "@/lib/recording";

export const metadata: Metadata = {
  title: "Record your intro",
  description: "Answer the question and record your introduction",
};

export default async function RecordPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  if (!isRecordingMode(mode)) redirect("/");

  return <RecorderClient mode={mode} />;
}
