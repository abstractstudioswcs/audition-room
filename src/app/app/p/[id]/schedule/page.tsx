import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { ScheduleBoard } from "./schedule-board";

export const metadata: Metadata = { title: "Schedule · Audition Room" };

export default function SchedulePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ScheduleBoard />
    </Suspense>
  );
}
