import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { Overview } from "./overview";

export const metadata: Metadata = { title: "Overview · Audition Room" };

export default function OverviewPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Overview />
    </Suspense>
  );
}
