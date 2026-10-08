import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { Accompanist } from "./accompanist";

export const metadata: Metadata = { title: "Accompanist · Audition Room" };

export default function AccompanistPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Accompanist />
    </Suspense>
  );
}
