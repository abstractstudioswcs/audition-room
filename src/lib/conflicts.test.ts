import { describe, expect, it } from "vitest";
import { conflictSummary, formatConflict, formatDay, formatSpan, formatTime, sortConflicts } from "./conflicts";

describe("conflict formatting", () => {
  it("formats days without shifting time zones", () => {
    expect(formatDay("2026-11-03")).toBe("Tue, Nov 3");
    expect(formatDay("2026-01-01")).toBe("Thu, Jan 1");
  });
  it("formats times and spans", () => {
    expect(formatTime("18:00")).toBe("6:00 pm");
    expect(formatTime("00:30")).toBe("12:30 am");
    expect(formatTime("12:15")).toBe("12:15 pm");
    expect(formatSpan({ start: "", end: "" })).toBe("All day");
    expect(formatSpan({ start: "18:00", end: "21:00" })).toBe("6:00 pm to 9:00 pm");
    expect(formatSpan({ start: "17:00", end: "" })).toBe("from 5:00 pm");
  });
  it("reads as one line", () => {
    expect(formatConflict({ date: "2026-11-03", start: "18:00", end: "21:00", note: "Work" })).toBe("Tue, Nov 3, 6:00 pm to 9:00 pm (Work)");
  });
  it("sorts by date then time", () => {
    const out = sortConflicts([
      { date: "2026-11-07", start: "", end: "", note: "" },
      { date: "2026-11-03", start: "19:00", end: "", note: "" },
      { date: "2026-11-03", start: "", end: "", note: "" },
    ]);
    expect(out.map((c) => `${c.date} ${c.start}`)).toEqual(["2026-11-03 ", "2026-11-03 19:00", "2026-11-07 "]);
  });
  it("summarizes for lists", () => {
    expect(conflictSummary({ conflicts: [], conflict_notes: "", no_conflicts: true })).toBe("None");
    expect(conflictSummary({ conflicts: [], conflict_notes: "", no_conflicts: false })).toBe("Not answered");
    expect(conflictSummary({ conflicts: [], conflict_notes: "Out Thanksgiving", no_conflicts: false })).toBe("See note");
    expect(conflictSummary({ conflicts: [{ date: "2026-11-03", start: "", end: "", note: "" }], conflict_notes: "", no_conflicts: false })).toBe("1 date");
  });
});
