import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { SessionHub } from "./hub";

export const metadata: Metadata = { title: "Session · Audition Room" };

export default function SessionPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <SessionHub />
    </Suspense>
  );
}
