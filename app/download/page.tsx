import type { Metadata } from "next";
import { DownloadExperience } from "@/components/install/DownloadExperience";

export const metadata: Metadata = {
  title: "Get Hierarchy Class",
  description:
    "Install Hierarchy Class on your device - Android, Windows, Linux, iPhone and iPad.",
};

export default function DownloadPage() {
  return <DownloadExperience />;
}
