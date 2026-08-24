import type { Metadata } from "next";
import ModeSelection from "@/components/ModeSelection";

export const metadata: Metadata = {
  title: "Record your intro",
  description: "Choose whether to introduce yourself by video or audio",
};

export default function HomePage() {
  return <ModeSelection />;
}
