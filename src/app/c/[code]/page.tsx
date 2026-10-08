import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { CheckIn } from "./check-in";

export const metadata: Metadata = { title: "Check in · Audition Room" };

export default function CheckInPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <CheckIn />
    </Suspense>
  );
}
