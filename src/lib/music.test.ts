import { describe, expect, it } from "vitest";
import { fit, fitNotes, isNoteOrEmpty, midi, roleSpec } from "./music";

describe("midi", () => {
  it("reads naturals, sharps and flats in scientific pitch", () => {
    expect(midi("C4")).toBe(60);
    expect(midi("A4")).toBe(69);
    expect(midi("Bb3")).toBe(58);
    expect(midi("B♭3")).toBe(58);
    expect(midi("F#5")).toBe(78);
    expect(midi("c6")).toBe(84);
    expect(midi(" G 3 ")).toBe(55);
  });
  it("rejects anything that isn't a note", () => {
    for (const bad of ["", "H4", "C", "C10", "middle C", null, undefined]) expect(midi(bad)).toBeNull();
  });
  it("treats empty as acceptable input", () => {
    expect(isNoteOrEmpty("")).toBe(true);
    expect(isNoteOrEmpty("Eb5")).toBe(true);
    expect(isNoteOrEmpty("E flat")).toBe(false);
  });
});

describe("fit", () => {
  const mezzo = { low: "G3", high: "E5" };

  it("is a full fit when the singer covers the whole range", () => {
    expect(fitNotes(mezzo, { low: "G3", high: "E5" }).kind).toBe("full");
    expect(fitNotes(mezzo, { low: "A3", high: "D5" }).kind).toBe("full");
  });
  it("names which end is short and by how much", () => {
    expect(fitNotes(mezzo, { low: "F3", high: "C5" })).toEqual({ kind: "partial", text: "Low end short by 2" });
    expect(fitNotes(mezzo, { low: "C4", high: "G5" })).toEqual({ kind: "partial", text: "Top short by 3" });
    expect(fitNotes(mezzo, { low: "F3", high: "F5" })).toEqual({ kind: "partial", text: "Short both ends" });
  });
  it("is not a fit when far off or outside entirely", () => {
    expect(fitNotes(mezzo, { low: "C4", high: "A5" }).kind).toBe("none"); // top short by 5
    expect(fitNotes(mezzo, { low: "A2", high: "G4" }).kind).toBe("none");
    expect(fitNotes({ low: "A2", high: "F4" }, { low: "C5", high: "C6" }).kind).toBe("none");
  });
  it("works with only a top note, as directors usually give it", () => {
    expect(fitNotes({ low: "C3", high: "A4" }, { high: "G4" }).kind).toBe("full");
    expect(fitNotes({ low: "C3", high: "E4" }, { high: "G4" })).toEqual({ kind: "partial", text: "Top short by 3" });
    expect(fitNotes({ low: "C3", high: "E4" }, { low: "D3" }).kind).toBe("full");
  });
  it("says what's missing instead of guessing", () => {
    expect(fitNotes({}, { high: "G4" }).text).toBe("Range not logged");
    expect(fitNotes(mezzo, {}).text).toBe("No range set");
    expect(fit(55, null, 60, 72).kind).toBe("unknown");
  });
});

describe("roleSpec", () => {
  it("summarizes voice and range", () => {
    expect(roleSpec({ voice: "Tenor", high_note: "G4" })).toBe("Tenor, up to G4");
    expect(roleSpec({ voice: "Mezzo", low_note: "G3", high_note: "E5" })).toBe("Mezzo, G3 to E5");
    expect(roleSpec({ low_note: "E2" })).toBe("down to E2");
    expect(roleSpec({})).toBe("");
  });
});
