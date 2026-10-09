"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type StandPage = { src: string; label: string };

type WakeLock = { release: () => Promise<void> };

/**
 * Full-screen sheet music for a tablet on a piano. One page at a time, or two
 * side by side on a landscape screen. Turn pages by tapping the right or left
 * side, swiping, or with a Bluetooth page-turn pedal (arrow and page keys).
 * Keeps the screen awake while open.
 */
export function MusicStand({
  pages,
  start = 0,
  title,
  extras,
  onClose,
}: {
  pages: StandPage[];
  start?: number;
  title: string;
  extras?: ReactNode;
  onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [landscape, setLandscape] = useState(false);
  const [twoUp, setTwoUp] = useState<boolean | null>(null); // null = automatic
  const [fit, setFit] = useState<"page" | "width">("page");
  const [index, setIndex] = useState(start);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const spread = (twoUp ?? landscape) && pages.length > 1 ? 2 : 1;
  const first = Math.min(Math.floor(index / spread) * spread, Math.max(0, pages.length - 1));
  const shown = pages.slice(first, first + spread);
  const atStart = first === 0;
  const atEnd = first + spread >= pages.length;

  const go = useCallback(
    (dir: 1 | -1) => {
      setIndex((i) => {
        const base = Math.floor(i / spread) * spread;
        const next = base + dir * spread;
        if (next < 0 || next >= pages.length) return i;
        return next;
      });
      root.current?.querySelector(".stand-pages")?.scrollTo({ top: 0 });
    },
    [pages.length, spread],
  );

  // Orientation decides one or two pages when the viewer hasn't chosen.
  useEffect(() => {
    const check = () => setLandscape(window.innerWidth > window.innerHeight * 1.15 && window.innerWidth >= 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Page-turn pedals send arrow or page keys; Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) {
        e.preventDefault();
        go(1);
      } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Home") {
        setIndex(0);
      } else if (e.key === "End") {
        setIndex(pages.length - 1);
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, pages.length]);

  // Full screen, page scroll locked, and the screen kept awake while open.
  useEffect(() => {
    const el = root.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null;
    try {
      if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
      else el?.webkitRequestFullscreen?.();
    } catch {
      // Not every tablet browser allows full screen. The overlay still covers the page.
    }
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let lock: WakeLock | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLock> } };
    nav.wakeLock?.request("screen").then((l) => (lock = l), () => {});
    el?.focus();
    return () => {
      document.body.style.overflow = overflow;
      lock?.release().catch(() => {});
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  const tap = (e: React.MouseEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    go(e.clientX - box.left < box.width / 3 ? -1 : 1);
  };

  const pageLabel =
    shown.length === 2 ? `Pages ${first + 1} and ${first + 2} of ${pages.length}` : `Page ${first + 1} of ${pages.length}`;

  // Only ever opened by a tap, so it renders in the browser; guard anyway for server rendering.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div ref={root} className="stand" role="dialog" aria-modal="true" aria-label={`Music stand: ${title}`} tabIndex={-1}>
      <div className="stand-bar">
        <strong className="stand-title">{title}</strong>
        <span className="stand-count" aria-live="polite">{pageLabel}</span>
        <span className="stand-tools">
          {extras}
          {pages.length > 1 && (
            <button type="button" className="stand-btn stand-two" aria-pressed={spread === 2} onClick={() => setTwoUp(spread !== 2)}>
              {spread === 2 ? "One page" : "Two pages"}
            </button>
          )}
          <button type="button" className="stand-btn" onClick={() => setFit(fit === "page" ? "width" : "page")}>
            {fit === "page" ? "Fit width" : "Fit page"}
          </button>
          <button type="button" className="stand-btn stand-close" onClick={onClose}>Close</button>
        </span>
      </div>
      <div
        className={`stand-pages fit-${fit}${spread === 2 ? " two" : ""}`}
        onClick={tap}
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const t = touch.current;
          touch.current = null;
          if (!t) return;
          const dx = e.changedTouches[0].clientX - t.x;
          const dy = e.changedTouches[0].clientY - t.y;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            e.preventDefault();
            go(dx < 0 ? 1 : -1);
          }
        }}
      >
        {shown.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element -- local page image
          <img key={p.src} src={p.src} alt={p.label} draggable={false} />
        ))}
      </div>
      <div className="stand-nav">
        <button type="button" className="stand-btn" disabled={atStart} onClick={() => go(-1)} aria-label="Previous page">
          ‹ Back
        </button>
        <span className="hint" style={{ color: "#C4CAD4" }}>Tap the right side or use a page-turn pedal to go forward</span>
        <button type="button" className="stand-btn" disabled={atEnd} onClick={() => go(1)} aria-label="Next page">
          Next ›
        </button>
      </div>
    </div>,
    document.body,
  );
}
