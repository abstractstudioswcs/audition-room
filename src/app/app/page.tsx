import type { Metadata } from "next";
import { Dashboard } from "./dashboard";

export const metadata: Metadata = { title: "Your theatres · Audition Room" };

export default function AppHome() {
  return <Dashboard />;
}
