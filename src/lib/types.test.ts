import { describe, expect, it } from "vitest";
import { AUDIO_TYPES, maxBytesFor, normalizeType } from "./types";

describe("normalizeType", () => {
  it("maps the different WAV labels browsers use to one type", () => {
    for (const t of ["audio/wav", "audio/wave", "audio/vnd.wave", "audio/x-pn-wav", "AUDIO/WAV"]) {
      expect(normalizeType("cut.wav", t)).toBe("audio/wav");
    }
    expect(AUDIO_TYPES).toContain(normalizeType("cut.wav", "audio/wave"));
  });
  it("falls back to the extension when the browser sends no type", () => {
    expect(normalizeType("Corner of the Sky.WAV", "")).toBe("audio/wav");
    expect(normalizeType("track.mp3", "application/octet-stream")).toBe("audio/mpeg");
    expect(normalizeType("cut.pdf", "")).toBe("application/pdf");
  });
  it("leaves standard types alone", () => {
    expect(normalizeType("a.mp3", "audio/mpeg")).toBe("audio/mpeg");
    expect(normalizeType("a.m4a", "audio/x-m4a")).toBe("audio/x-m4a");
    expect(normalizeType("p.jpg", "image/jpeg")).toBe("image/jpeg");
  });
});

describe("maxBytesFor", () => {
  it("allows bigger audio than sheet music", () => {
    expect(maxBytesFor("audio/wav")).toBe(50 * 1024 * 1024);
    expect(maxBytesFor("application/pdf")).toBe(20 * 1024 * 1024);
  });
});
