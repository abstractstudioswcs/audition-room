import { describe, expect, it } from "vitest";
import { addMonths, byDate, eventName, eventTime, initialMonth, monthGrid, monthLabel, repeatDates, shortTime, todayIso } from "./calendar";

describe("month grid", () => {
  it("starts on Sunday and covers the whole month", () => {
    const weeks = monthGrid("2026-11"); // Nov 1, 2026 is a Sunday
    expect(weeks[0][0]).toEqual({ date: "2026-11-01", inMonth: true });
    expect(weeks.flat().filter((d) => d.inMonth)).toHaveLength(30);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.at(-1)!.at(-1)!.date).toBe("2026-12-05");
  });
  it("pads with the previous month", () => {
    const weeks = monthGrid("2026-10"); // Oct 1, 2026 is a Thursday
    expect(weeks[0].slice(0, 4).map((d) => d.date)).toEqual(["2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30"]);
    expect(weeks[0][4]).toEqual({ date: "2026-10-01", inMonth: true });
  });
  it("handles February in a leap year", () => {
    expect(monthGrid("2028-02").flat().filter((d) => d.inMonth)).toHaveLength(29);
  });
});

describe("months", () => {
  it("moves across years", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(monthLabel("2026-11")).toBe("November 2026");
  });
  it("opens on the next upcoming event", () => {
    const ev = [{ date: "2026-09-10" }, { date: "2026-11-02" }, { date: "2026-12-12" }];
    expect(initialMonth(ev, "2026-10-10")).toBe("2026-11");
    expect(initialMonth(ev, "2027-01-01")).toBe("2026-09");
    expect(initialMonth([], "2026-10-10")).toBe("2026-10");
  });
  it("reads today in local time", () => {
    expect(todayIso(new Date(2026, 9, 10, 23, 30))).toBe("2026-10-10");
  });
});

describe("repeating schedule", () => {
  it("picks the chosen weekdays between two dates", () => {
    // Mon to Thu, Nov 2 to Nov 12, 2026
    expect(repeatDates("2026-11-02", "2026-11-12", [1, 2, 3, 4])).toEqual([
      "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05",
      "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12",
    ]);
  });
  it("returns nothing for empty or backwards ranges", () => {
    expect(repeatDates("2026-11-10", "2026-11-01", [1])).toEqual([]);
    expect(repeatDates("2026-11-01", "2026-11-10", [])).toEqual([]);
  });
  it("is capped so a typo can't create thousands of dates", () => {
    expect(repeatDates("2026-01-01", "2030-12-31", [0, 1, 2, 3, 4, 5, 6])).toHaveLength(200);
  });
});

describe("event text", () => {
  it("describes times", () => {
    expect(eventTime({ start_time: "18:00", end_time: "21:00" })).toBe("6:00 pm to 9:00 pm");
    expect(eventTime({ start_time: "", end_time: "" })).toBe("Time to be announced");
    expect(shortTime({ start_time: "18:00", end_time: "21:00" })).toBe("6–9p");
    expect(shortTime({ start_time: "10:30", end_time: "13:00" })).toBe("10:30a–1p");
    expect(shortTime({ start_time: "19:30", end_time: "" })).toBe("7:30p");
    expect(shortTime({ start_time: "", end_time: "" })).toBe("");
  });
  it("names events", () => {
    expect(eventName({ kind: "tech", title: "Cue to cue" })).toBe("Tech: Cue to cue");
    expect(eventName({ kind: "performance", title: "" })).toBe("Performance");
  });
  it("groups by date in time order", () => {
    const m = byDate([
      { date: "2026-11-02", start_time: "19:00" },
      { date: "2026-11-02", start_time: "10:00" },
      { date: "2026-11-01", start_time: "" },
    ]);
    expect([...m.keys()]).toEqual(["2026-11-01", "2026-11-02"]);
    expect(m.get("2026-11-02")!.map((e) => e.start_time)).toEqual(["10:00", "19:00"]);
  });
});
