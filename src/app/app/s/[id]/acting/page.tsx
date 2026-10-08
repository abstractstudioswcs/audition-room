import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { Acting } from "./acting";

export const metadata: Metadata = { title: "Acting · Audition Room" };

export default function ActingPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Acting />
    </Suspense>
  );
}
