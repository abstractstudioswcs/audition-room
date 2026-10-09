import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { ConflictsBoard } from "./conflicts-board";

export const metadata: Metadata = { title: "Conflicts · Audition Room" };

export default function ConflictsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ConflictsBoard />
    </Suspense>
  );
}
