import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { MusicDirector } from "./music-director";

export const metadata: Metadata = { title: "Music director · Audition Room" };

export default function MusicDirectorPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <MusicDirector />
    </Suspense>
  );
}
