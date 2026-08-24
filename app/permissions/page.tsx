import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PermissionsClient from "@/components/PermissionsClient";
import { isRecordingMode } from "@/lib/recording";

export const metadata: Metadata = {
  title: "Allow access",
  description: "Grant camera and microphone access to record your intro",
};

export default async function PermissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  if (!isRecordingMode(mode)) redirect("/");

  return <PermissionsClient mode={mode} />;
}
