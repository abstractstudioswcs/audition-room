"use client";

import { useEffect, useState, type ReactNode } from "react";
import { MusicStand, type StandPage } from "@/components/music-stand";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { MusicFile } from "@/lib/types";

const LINK_HOURS = 4;
const linkCache = new Map<string, { url: string; expires: number }>();

/** Signed, short-lived link to a private file (music or headshot), reused while fresh. */
export function useSignedUrl(path: string) {
  const [url, setUrl] = useState<string | null>(() => {
    const hit = linkCache.get(path);
    return hit && hit.expires > Date.now() ? hit.url : null;
  });
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!path) return;
    const hit = linkCache.get(path);
    if (hit && hit.expires > Date.now()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reuse a cached link
      setUrl(hit.url);
      return;
    }
    let alive = true;
    supabaseBrowser()
      .storage.from("music")
      .createSignedUrl(path, 60 * 60 * LINK_HOURS)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error || !data) return setFailed(true);
        linkCache.set(path, { url: data.signedUrl, expires: Date.now() + (LINK_HOURS - 0.5) * 3600 * 1000 });
        setUrl(data.signedUrl);
      });
    return () => {
      alive = false;
    };
  }, [path]);
  return { url, failed };
}

/** Download a private file to this device, under its original name. */
export async function downloadFile(file: { path: string; name: string }): Promise<boolean> {
  const { data, error } = await supabaseBrowser()
    .storage.from("music")
    .createSignedUrl(file.path, 60 * 10, { download: file.name || true });
  if (error || !data) return false;
  const a = document.createElement("a");
  a.href = data.signedUrl;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

export function DownloadButton({ file, small = true }: { file: MusicFile; small?: boolean }) {
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  return (
    <button
      type="button"
      className={`btn${small ? " small" : ""}`}
      disabled={state === "busy"}
      aria-label={`Download ${file.name}`}
      onClick={async () => {
        setState("busy");
        setState((await downloadFile(file)) ? "idle" : "failed");
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
      </svg>
      {state === "busy" ? "Preparing…" : state === "failed" ? "Try again" : "Download"}
    </button>
  );
}

const isSheet = (f: MusicFile) => f.type === "application/pdf" || f.type.startsWith("image/");

/**
 * A singer's uploaded music: sheet music pages (with the full-screen music stand)
 * and backing tracks, each downloadable.
 */
export function MusicFiles({ files, song, standExtras }: { files: MusicFile[]; song: string; standExtras?: ReactNode }) {
  const sheets = files.filter(isSheet);
  const tracks = files.filter((f) => f.type.startsWith("audio/"));
  return (
    <>
      {sheets.length > 0 && <SheetMusic files={sheets} song={song} standExtras={standExtras} />}
      {tracks.map((f) => (
        <AudioTrack key={f.path} file={f} label={song} />
      ))}
    </>
  );
}

function AudioTrack({ file, label }: { file: MusicFile; label: string }) {
  const { url, failed } = useSignedUrl(file.path);
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="spread" style={{ alignItems: "center" }}>
        <span className="label">Backing track · {file.name}</span>
        <DownloadButton file={file} />
      </div>
      {failed ? (
        <div className="missing-box">{file.name} couldn’t be opened. Try Download, or ask the singer to play it from their phone.</div>
      ) : url ? (
        <audio controls preload="auto" src={url} aria-label={`Backing track: ${label}`} style={{ width: "100%" }} />
      ) : (
        <p className="hint">Loading {file.name}…</p>
      )}
    </div>
  );
}

function SheetMusic({ files, song, standExtras }: { files: MusicFile[]; song: string; standExtras?: ReactNode }) {
  const { pages, loading, failed } = useSheetPages(files);
  const [standAt, setStandAt] = useState<number | null>(null);
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="spread" style={{ alignItems: "center" }}>
        <span className="label">
          Sheet music{pages.length ? ` · ${pages.length === 1 ? "1 page" : `${pages.length} pages`}` : ""}
        </span>
        <span className="inline">
          {files.map((f) => (
            <DownloadButton key={f.path} file={f} />
          ))}
          <button type="button" className="btn primary small" disabled={pages.length === 0} onClick={() => setStandAt(0)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
            Music stand
          </button>
        </span>
      </div>
      {failed.map((name) => (
        <div key={name} className="missing-box">{name} couldn’t be shown here. Use Download to open it on this device.</div>
      ))}
      {loading && <p className="hint">Preparing pages…</p>}
      <div className="stack" style={{ gap: 10 }}>
        {pages.map((p, i) => (
          <button key={p.src} type="button" className="page-thumb" onClick={() => setStandAt(i)}
            aria-label={`Open ${p.label} on the music stand`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- local page image */}
            <img src={p.src} alt={p.label} />
          </button>
        ))}
      </div>
      {standAt !== null && pages.length > 0 && (
        <MusicStand pages={pages} start={standAt} title={song} extras={standExtras} onClose={() => setStandAt(null)} />
      )}
    </div>
  );
}

/**
 * Turns uploaded sheet music into page images, in upload order: photos are used
 * as they are, and each PDF page is rendered sharp enough for a full-screen tablet.
 */
function useSheetPages(files: MusicFile[]) {
  const key = files.map((f) => f.path).join("|");
  const [state, setState] = useState<{ key: string; pages: StandPage[]; loading: boolean; failed: string[] }>({
    key: "",
    pages: [],
    loading: true,
    failed: [],
  });

  useEffect(() => {
    let cancelled = false;
    const made: string[] = [];
    const list = key ? key.split("|").map((path) => files.find((f) => f.path === path)!).filter(Boolean) : [];
    (async () => {
      const sb = supabaseBrowser();
      const pages: StandPage[] = [];
      const failed: string[] = [];
      const longest = Math.max(window.screen.width, window.screen.height) * Math.min(window.devicePixelRatio || 1, 2);
      const targetWidth = Math.min(2400, Math.max(1400, longest));
      for (const f of list) {
        if (cancelled) return;
        const { data } = await sb.storage.from("music").createSignedUrl(f.path, 60 * 60 * 4);
        if (!data) {
          failed.push(f.name);
          continue;
        }
        if (f.type.startsWith("image/")) {
          pages.push({ src: data.signedUrl, label: `${f.name}` });
          continue;
        }
        try {
          const pdfjs = await import("pdfjs-dist");
          pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
          const doc = await pdfjs.getDocument({ url: data.signedUrl }).promise;
          for (let n = 1; n <= doc.numPages && !cancelled; n++) {
            const page = await doc.getPage(n);
            const base = page.getViewport({ scale: 1 });
            const viewport = page.getViewport({ scale: targetWidth / base.width });
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(viewport.width);
            canvas.height = Math.round(viewport.height);
            await page.render({ canvas, viewport }).promise;
            const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
            canvas.width = canvas.height = 0;
            if (!blob) throw new Error("render");
            const src = URL.createObjectURL(blob);
            made.push(src);
            pages.push({ src, label: `${f.name}, page ${n} of ${doc.numPages}` });
            if (!cancelled) setState({ key, pages: [...pages], loading: true, failed: [...failed] });
          }
        } catch {
          failed.push(f.name);
        }
      }
      if (!cancelled) setState({ key, pages, loading: false, failed });
    })();
    return () => {
      cancelled = true;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
    // files is rebuilt on every refresh; key captures what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state.key === key ? state : { pages: [], loading: true, failed: [] };
}
