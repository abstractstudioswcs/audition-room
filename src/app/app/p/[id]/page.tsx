import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { Setup } from "./setup";

export const metadata: Metadata = { title: "Setup · Audition Room" };

export default function SetupPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Setup />
    </Suspense>
  );
}
