import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { CastingBoard } from "./casting-board";

export const metadata: Metadata = { title: "Casting · Audition Room" };

export default function CastPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <CastingBoard />
    </Suspense>
  );
}
